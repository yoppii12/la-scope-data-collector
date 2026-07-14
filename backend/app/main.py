import asyncio
import json
import socket
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import camera as cam_module
from . import storage
from .config import load_settings, save_settings

camera = None
interval_task: Optional[asyncio.Task] = None
interval_running = False
_ws_clients: list[WebSocket] = []

FRONTEND_DIST = Path(__file__).parent.parent.parent / "frontend" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    global camera
    camera = cam_module.create_camera()
    settings = load_settings()
    camera.start(initial_settings=settings.get("camera", {}))
    yield
    global interval_running
    interval_running = False
    if interval_task and not interval_task.done():
        interval_task.cancel()
    camera.stop()


app = FastAPI(title="LA-Scope Dataset Collector", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

if (FRONTEND_DIST / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")


# ---------- Stream ----------

async def _mjpeg_frames():
    while True:
        frame = camera.get_frame()
        if frame:
            yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + frame + b"\r\n"
        await asyncio.sleep(1 / 30)


@app.get("/api/stream")
async def stream():
    return StreamingResponse(
        _mjpeg_frames(),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


# ---------- Capture ----------

class CaptureRequest(BaseModel):
    sample_id: str = ""


@app.post("/api/capture")
async def capture_photo(req: CaptureRequest):
    date_str, fname = storage.make_filename(req.sample_id, "jpg")
    folder = storage.ensure_date_dir(date_str)
    filepath = str(folder / fname)

    ok = await asyncio.to_thread(camera.capture_image, filepath)
    if not ok:
        raise HTTPException(500, "Capture failed")

    annotation = load_settings().get("annotation", {})
    meta = {
        "filename": fname,
        "captured_at": datetime.now().astimezone().isoformat(),
        "sample_id": req.sample_id,
        "note": annotation.get("default_note", ""),
        "condition": annotation.get("default_condition", ""),
        "camera_settings": camera.settings.copy(),
    }
    json_path = folder / fname.replace(".jpg", ".json")
    json_path.write_text(json.dumps(meta, indent=2))

    await _broadcast()
    return {"filename": fname, "path": f"{date_str}/{fname}"}


# ---------- Recording ----------

@app.post("/api/record/start")
async def start_recording(req: CaptureRequest):
    if camera.is_recording:
        raise HTTPException(400, "Already recording")
    date_str, fname = storage.make_filename(req.sample_id, "mp4")
    folder = storage.ensure_date_dir(date_str)
    ok = camera.start_recording(str(folder / fname))
    if not ok:
        raise HTTPException(500, "Failed to start recording")
    await _broadcast()
    return {"filename": fname}


@app.post("/api/record/stop")
async def stop_recording():
    if not camera.is_recording:
        raise HTTPException(400, "Not recording")
    ok = camera.stop_recording()
    if not ok:
        raise HTTPException(500, "Failed to stop recording")
    await _broadcast()
    return {"ok": True}


# ---------- Interval ----------

class IntervalRequest(BaseModel):
    sample_id: str = ""
    interval_seconds: Optional[int] = None
    max_shots: Optional[int] = None


async def _interval_loop(sample_id: str, interval_secs: int, max_shots: int):
    count = 0
    while interval_running and (max_shots == 0 or count < max_shots):
        try:
            date_str, fname = storage.make_filename(sample_id, "jpg")
            folder = storage.ensure_date_dir(date_str)
            filepath = str(folder / fname)
            ok = await asyncio.to_thread(camera.capture_image, filepath)
            if ok:
                annotation = load_settings().get("annotation", {})
                meta = {
                    "filename": fname,
                    "captured_at": datetime.now().astimezone().isoformat(),
                    "sample_id": sample_id,
                    "note": annotation.get("default_note", ""),
                    "condition": annotation.get("default_condition", ""),
                    "camera_settings": camera.settings.copy(),
                }
                (folder / fname.replace(".jpg", ".json")).write_text(json.dumps(meta, indent=2))
                count += 1
                await _broadcast()
        except Exception:
            pass
        await asyncio.sleep(interval_secs)


@app.post("/api/interval/start")
async def start_interval(req: IntervalRequest):
    global interval_task, interval_running
    if interval_running:
        raise HTTPException(400, "Already running")
    settings = load_settings()
    secs = req.interval_seconds or settings["interval"]["interval_seconds"]
    max_s = req.max_shots if req.max_shots is not None else settings["interval"]["max_shots"]
    interval_running = True
    interval_task = asyncio.create_task(_interval_loop(req.sample_id, secs, max_s))
    await _broadcast()
    return {"ok": True}


@app.post("/api/interval/stop")
async def stop_interval():
    global interval_running, interval_task
    interval_running = False
    if interval_task and not interval_task.done():
        interval_task.cancel()
    await _broadcast()
    return {"ok": True}


# ---------- Info ----------

@app.get("/api/storage")
async def get_storage():
    return storage.get_storage_info()


@app.get("/api/counter")
async def get_counter():
    return {"today": storage.get_today_counts(), "total": storage.get_total_counts()}


@app.get("/api/network")
async def get_network():
    return {"ip": _get_ip(), "hostname": socket.gethostname()}


# ---------- Files ----------

@app.get("/api/files")
async def list_folders():
    return storage.get_date_folders()


@app.get("/api/files/{date_str}")
async def list_folder(date_str: str):
    return storage.get_files_in_folder(date_str)


@app.get("/api/files/{date_str}/{filename}")
async def get_file(date_str: str, filename: str):
    path = storage.get_file_path(f"{date_str}/{filename}")
    if not path:
        raise HTTPException(404, "Not found")
    return FileResponse(str(path))


@app.delete("/api/files/{date_str}")
async def delete_folder(date_str: str):
    if not storage.delete_folder(date_str):
        raise HTTPException(404, "Not found")
    return {"ok": True}


@app.delete("/api/files/{date_str}/{filename}")
async def delete_file(date_str: str, filename: str):
    if not storage.delete_file(f"{date_str}/{filename}"):
        raise HTTPException(404, "Not found")
    return {"ok": True}


@app.get("/api/files/{date_str}/download/zip")
async def zip_by_date(date_str: str):
    data = await asyncio.to_thread(storage.create_zip, date_str)
    return Response(data, media_type="application/zip",
                    headers={"Content-Disposition": f"attachment; filename={date_str}.zip"})


@app.get("/api/download/zip")
async def zip_all():
    data = await asyncio.to_thread(storage.create_zip)
    return Response(data, media_type="application/zip",
                    headers={"Content-Disposition": "attachment; filename=la-scope-all.zip"})


@app.get("/api/files/{date_str}/export/csv")
async def csv_by_date(date_str: str):
    data = storage.export_csv(date_str)
    return Response(data, media_type="text/csv",
                    headers={"Content-Disposition": f"attachment; filename={date_str}.csv"})


@app.get("/api/export/csv")
async def csv_all():
    data = storage.export_csv()
    return Response(data, media_type="text/csv",
                    headers={"Content-Disposition": "attachment; filename=la-scope-all.csv"})


# ---------- Camera capabilities ----------

@app.get("/api/camera/resolutions")
async def get_resolutions():
    return {"resolutions": camera.get_supported_resolutions()}


# ---------- Settings ----------

@app.get("/api/settings")
async def get_settings():
    return load_settings()


class SettingsUpdate(BaseModel):
    camera: Optional[dict] = None
    interval: Optional[dict] = None
    annotation: Optional[dict] = None


@app.put("/api/settings")
async def update_settings(update: SettingsUpdate):
    settings = load_settings()
    if update.camera:
        settings["camera"].update(update.camera)
        if hasattr(camera, "apply_settings"):
            camera.apply_settings(settings["camera"])
    if update.interval:
        settings["interval"].update(update.interval)
    if update.annotation:
        settings["annotation"].update(update.annotation)
    save_settings(settings)
    return settings


# ---------- WebSocket ----------

@app.websocket("/ws")
async def ws_endpoint(websocket: WebSocket):
    await websocket.accept()
    _ws_clients.append(websocket)
    try:
        while True:
            await websocket.send_json(_build_status())
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        pass
    finally:
        if websocket in _ws_clients:
            _ws_clients.remove(websocket)


def _build_status() -> dict:
    return {
        "recording": camera.is_recording if camera else False,
        "interval": interval_running,
        "counter": storage.get_today_counts(),
        "total": storage.get_total_counts(),
        "storage": storage.get_storage_info(),
        "network": {"ip": _get_ip(), "hostname": socket.gethostname()},
    }


async def _broadcast():
    if not _ws_clients:
        return
    status = _build_status()
    dead = []
    for ws in _ws_clients:
        try:
            await ws.send_json(status)
        except Exception:
            dead.append(ws)
    for ws in dead:
        if ws in _ws_clients:
            _ws_clients.remove(ws)


def _get_ip() -> str:
    # Direct interface query (Linux/RPi) — works even without internet
    try:
        import fcntl
        import struct
        for ifname in ("wlan0", "eth0", "wlan1"):
            try:
                s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                ip = socket.inet_ntoa(fcntl.ioctl(
                    s.fileno(), 0x8915,
                    struct.pack('256s', ifname[:15].encode())
                )[20:24])
                s.close()
                if not ip.startswith("127."):
                    return ip
            except Exception:
                continue
    except ImportError:
        pass
    # Fallback: routing-based (works on Mac/Windows dev environment)
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        if not ip.startswith("127."):
            return ip
    except Exception:
        pass
    return "127.0.0.1"


# ---------- SPA fallback ----------

@app.get("/{full_path:path}")
async def spa_fallback(full_path: str):
    index = FRONTEND_DIST / "index.html"
    if index.exists():
        return FileResponse(str(index))
    return Response(
        "LA-Scope Dataset Collector API — frontend not built yet.",
        media_type="text/plain",
    )
