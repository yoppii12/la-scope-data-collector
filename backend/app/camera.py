import io
import threading
import time
from datetime import datetime
from typing import Optional

try:
    from picamera2 import Picamera2
    from picamera2.encoders import H264Encoder
    from picamera2.outputs import FfmpegOutput
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


class RPiCamera:
    """Raspberry Pi HQ Camera via picamera2."""

    def __init__(self):
        self.picam: Optional[Picamera2] = None
        self.is_recording = False
        self.settings = {
            "resolution": "1920x1080",
            "framerate": 30,
            "exposure": "auto",
            "white_balance": "auto",
        }
        self._frame: Optional[bytes] = None
        self._lock = threading.Lock()
        self._cam_lock = threading.Lock()
        self._running = False
        self._thread: Optional[threading.Thread] = None

    def get_supported_resolutions(self) -> list[str]:
        return RPI_RESOLUTIONS

    def start(self, initial_settings: dict = None):
        if initial_settings:
            self.settings.update(initial_settings)
        w, h = _parse_resolution(self.settings.get("resolution", "1920x1080"))
        self.picam = Picamera2()
        config = self.picam.create_preview_configuration(
            main={"size": (w, h), "format": "RGB888"},
        )
        self.picam.configure(config)
        self.picam.start()
        fps = int(self.settings.get("framerate", 30))
        frame_duration = int(1_000_000 / fps)
        self.picam.set_controls({"FrameDurationLimits": (frame_duration, frame_duration)})
        time.sleep(2)
        self._running = True
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def stop(self):
        self._running = False
        if self.picam:
            self.picam.stop()
            self.picam.close()

    def _loop(self):
        while self._running:
            try:
                with self._cam_lock:
                    buf = io.BytesIO()
                    self.picam.capture_file(buf, format="jpeg")
                with self._lock:
                    self._frame = buf.getvalue()
            except Exception:
                pass
            time.sleep(1 / int(self.settings.get("framerate", 30)))

    def get_frame(self) -> Optional[bytes]:
        with self._lock:
            return self._frame

    def capture_image(self, filepath: str) -> bool:
        try:
            with self._lock:
                frame = self._frame
            if not frame:
                return False
            with open(filepath, "wb") as f:
                f.write(frame)
            return True
        except Exception:
            return False

    def start_recording(self, filepath: str) -> bool:
        try:
            encoder = H264Encoder()
            output = FfmpegOutput(filepath)
            self.picam.start_recording(encoder, output)
            self.is_recording = True
            return True
        except Exception:
            return False

    def stop_recording(self) -> bool:
        try:
            self.picam.stop_recording()
            self.is_recording = False
            return True
        except Exception:
            return False

    def apply_settings(self, settings: dict):
        if not self.picam:
            return
        new_res = settings.get("resolution", self.settings.get("resolution"))
        if new_res and new_res != self.settings.get("resolution"):
            self._running = False
            if self._thread:
                self._thread.join(timeout=2)
            self.picam.stop()
            w, h = _parse_resolution(new_res)
            config = self.picam.create_preview_configuration(
                main={"size": (w, h), "format": "RGB888"},
            )
            self.picam.configure(config)
            self.picam.start()
            time.sleep(2)
            self._running = True
            self._thread = threading.Thread(target=self._loop, daemon=True)
            self._thread.start()
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
