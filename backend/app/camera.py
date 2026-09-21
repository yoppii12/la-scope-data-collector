import io
import threading
import time
from datetime import datetime
from typing import Optional

try:
    from picamera2 import Picamera2
    from picamera2.encoders import H264Encoder, MJPEGEncoder
    from picamera2.outputs import FfmpegOutput, FileOutput
    PICAMERA2_AVAILABLE = True
except ImportError:
    PICAMERA2_AVAILABLE = False

from PIL import Image, ImageDraw


MOCK_RESOLUTIONS = ["640x480", "1280x720", "1920x1080"]
RPI_RESOLUTIONS = ["640x480", "1280x720", "1920x1080", "2028x1520", "4056x3040"]


def _parse_resolution(res: str) -> tuple[int, int]:
    try:
        w, h = res.split("x")
        return int(w), int(h)
    except Exception:
        return 1280, 720


class MockCamera:
    """Development mock — generates a test pattern without RPi hardware."""

    def __init__(self):
        self.is_recording = False
        self.settings = {
            "resolution": "1920x1080",
            "framerate": 30,
            "exposure": "auto",
            "white_balance": "auto",
        }
        self._frame: Optional[bytes] = None
        self._lock = threading.Lock()
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._recording_path: Optional[str] = None
        self._frame_count = 0

    def get_supported_resolutions(self) -> list[str]:
        return MOCK_RESOLUTIONS

    def start(self, initial_settings: dict = None):
        if initial_settings:
            self.settings.update(initial_settings)
        self._running = True
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def stop(self):
        self._running = False

    def _loop(self):
        while self._running:
            self._frame_count += 1
            img = Image.new("RGB", (1280, 720), color="#0a0a1e")
            draw = ImageDraw.Draw(img)
            for x in range(0, 1280, 128):
                draw.line([(x, 0), (x, 720)], fill="#16183a", width=1)
            for y in range(0, 720, 80):
                draw.line([(0, y), (1280, y)], fill="#16183a", width=1)
            cx, cy = 640, 360
            draw.ellipse([cx - 320, cy - 280, cx + 320, cy + 280], outline="#1e2050", width=3)
            draw.line([(cx, cy - 20), (cx, cy + 20)], fill="#F05A22", width=2)
            draw.line([(cx - 20, cy), (cx + 20, cy)], fill="#F05A22", width=2)
            ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            draw.text((20, 20), "MOCK CAMERA — LA-Scope", fill="#FFFFFF")
            draw.text((20, 44), f"Frame: {self._frame_count}  |  {ts}", fill="#888aaa")
            if self.is_recording:
                draw.ellipse([1220, 18, 1242, 40], fill="#F05A22")
                draw.text((1248, 22), "REC", fill="#F05A22")
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=80)
            with self._lock:
                self._frame = buf.getvalue()
            time.sleep(1 / 30)

    def get_frame(self) -> Optional[bytes]:
        with self._lock:
            return self._frame

    def capture_image(self, filepath: str) -> bool:
        try:
            img = Image.new("RGB", (1920, 1080), color="#0a0a1e")
            draw = ImageDraw.Draw(img)
            ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            draw.text((40, 40), f"CAPTURED: {ts}", fill="#FFFFFF")
            draw.ellipse([160, 80, 1760, 1000], outline="#1e2050", width=6)
            img.save(filepath, format="JPEG", quality=95)
            return True
        except Exception:
            return False

    def start_recording(self, filepath: str) -> bool:
        self._recording_path = filepath
        self.is_recording = True
        return True

    def stop_recording(self) -> bool:
        if self._recording_path:
            with open(self._recording_path, "wb") as f:
                f.write(b"MOCK_VIDEO_PLACEHOLDER")
        self.is_recording = False
        self._recording_path = None
        return True

    def apply_settings(self, settings: dict):
        self.settings.update(settings)


class _FrameSink(io.BufferedIOBase):
    """File-like object handed to FileOutput; just remembers the latest JPEG frame."""

    def __init__(self):
        super().__init__()
        self._lock = threading.Lock()
        self._frame: Optional[bytes] = None

    def write(self, buf):
        with self._lock:
            self._frame = bytes(buf)
        return len(buf)

    def get_frame(self) -> Optional[bytes]:
        with self._lock:
            return self._frame


class RPiCamera:
    """Raspberry Pi HQ Camera via picamera2.

    Live view and recording run as two fully independent encoders on two
    different streams, started/stopped separately via start_encoder /
    stop_encoder:
      - an MJPEGEncoder stays attached to the "lores" stream for the entire
        lifetime of the camera, continuously feeding `_sink` for live view.
      - an H264Encoder is attached to / detached from the "main" stream only
        for the duration of an actual recording.

    Earlier versions instead polled a single shared stream with a blocking
    capture_file() call from a Python thread while toggling the recording
    encoder on that same stream. That contention wedged libcamera itself —
    confirmed on-device by systemd having to SIGKILL the service (including
    its CameraManager child processes) because it stopped responding after
    a record start/stop cycle. Giving each purpose its own encoder and
    stream means starting or stopping a recording never touches the live
    view's pipeline at all.
    """

    LIVE_VIEW_SIZE = (1280, 720)

    def __init__(self):
        self.picam: Optional[Picamera2] = None
        self.is_recording = False
        self.settings = {
            "resolution": "1920x1080",
            "framerate": 30,
            "exposure": "auto",
            "white_balance": "auto",
        }
        self._sink = _FrameSink()
        self._cam_lock = threading.Lock()
        self._mjpeg_encoder: Optional[MJPEGEncoder] = None
        self._h264_encoder: Optional[H264Encoder] = None

    def get_supported_resolutions(self) -> list[str]:
        return RPI_RESOLUTIONS

    def _build_config(self, w: int, h: int):
        lw, lh = self.LIVE_VIEW_SIZE
        lw, lh = min(lw, w), min(lh, h)
        return self.picam.create_video_configuration(
            main={"size": (w, h), "format": "RGB888"},
            lores={"size": (lw, lh), "format": "YUV420"},
            encode="lores",
        )

    def _start_live_view(self):
        self._mjpeg_encoder = MJPEGEncoder()
        self.picam.start_encoder(self._mjpeg_encoder, FileOutput(self._sink), name="lores")

    def start(self, initial_settings: dict = None):
        if initial_settings:
            self.settings.update(initial_settings)
        w, h = _parse_resolution(self.settings.get("resolution", "1920x1080"))
        self.picam = Picamera2()
        config = self._build_config(w, h)
        self.picam.configure(config)
        fps = int(self.settings.get("framerate", 30))
        frame_duration = int(1_000_000 / fps)
        self.picam.set_controls({"FrameDurationLimits": (frame_duration, frame_duration)})
        self.picam.start()
        time.sleep(2)
        self._start_live_view()

    def stop(self):
        if self.picam:
            if self._mjpeg_encoder:
                self.picam.stop_encoder(self._mjpeg_encoder)
                self._mjpeg_encoder = None
            self.picam.stop()
            self.picam.close()

    def get_frame(self) -> Optional[bytes]:
        return self._sink.get_frame()

    def capture_image(self, filepath: str) -> bool:
        try:
            with self._cam_lock:
                self.picam.capture_file(filepath, format="jpeg", name="main")
            return True
        except Exception:
            return False

    def start_recording(self, filepath: str) -> bool:
        try:
            with self._cam_lock:
                self._h264_encoder = H264Encoder()
                output = FfmpegOutput(filepath)
                self.picam.start_encoder(self._h264_encoder, output, name="main")
            self.is_recording = True
            return True
        except Exception:
            return False

    def stop_recording(self) -> bool:
        try:
            with self._cam_lock:
                if self._h264_encoder:
                    self.picam.stop_encoder(self._h264_encoder)
                    self._h264_encoder = None
            self.is_recording = False
            return True
        except Exception:
            return False

    def apply_settings(self, settings: dict):
        if not self.picam:
            return
        new_res = settings.get("resolution", self.settings.get("resolution"))
        if new_res and new_res != self.settings.get("resolution"):
            if self._mjpeg_encoder:
                self.picam.stop_encoder(self._mjpeg_encoder)
                self._mjpeg_encoder = None
            self.picam.stop()
            w, h = _parse_resolution(new_res)
            config = self._build_config(w, h)
            self.picam.configure(config)
            self.picam.start()
            time.sleep(2)
            self._start_live_view()
        controls = {}
        if settings.get("exposure") == "auto":
            controls["AeEnable"] = True
        else:
            controls["AeEnable"] = False
            controls["ExposureTime"] = int(settings.get("exposure", "1000"))
        if settings.get("white_balance") == "auto":
            controls["AwbEnable"] = True
        else:
            controls["AwbEnable"] = False
        new_fps = int(settings.get("framerate", self.settings.get("framerate", 30)))
        frame_duration = int(1_000_000 / new_fps)
        controls["FrameDurationLimits"] = (frame_duration, frame_duration)
        self.picam.set_controls(controls)
        self.settings.update(settings)


def create_camera():
    if PICAMERA2_AVAILABLE:
        try:
            if Picamera2.global_camera_info():
                return RPiCamera()
        except Exception:
            pass
    return MockCamera()
