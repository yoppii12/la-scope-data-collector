import csv
import io
import json
import shutil
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Optional

DATA_DIR = Path(__file__).parent.parent / "data"
DATA_DIR.mkdir(exist_ok=True)


def ensure_date_dir(date_str: str) -> Path:
    d = DATA_DIR / date_str
    d.mkdir(parents=True, exist_ok=True)
    return d


def get_today_str() -> str:
    return datetime.now().strftime("%y%m%d")


def make_filename(sample_id: str = "", ext: str = "jpg") -> tuple[str, str]:
    now = datetime.now()
    date_str = now.strftime("%y%m%d")
    time_str = now.strftime("%y%m%d-%H%M%S")
    fname = f"{time_str}_{sample_id}.{ext}" if sample_id else f"{time_str}.{ext}"
    return date_str, fname


def get_storage_info() -> dict:
    stat = shutil.disk_usage(DATA_DIR)
    return {
        "total": stat.total,
        "used": stat.used,
        "free": stat.free,
        "percent_used": round(stat.used / stat.total * 100, 1),
    }


def get_date_folders() -> list[dict]:
    if not DATA_DIR.exists():
        return []
    folders = []
    for d in sorted(DATA_DIR.iterdir(), reverse=True):
        if not d.is_dir():
            continue
        photos = list(d.glob("*.jpg"))
        videos = list(d.glob("*.mp4"))
        all_files = photos + videos
        folders.append({
            "date": d.name,
            "photo_count": len(photos),
            "video_count": len(videos),
            "total_size": sum(f.stat().st_size for f in all_files),
        })
    return folders


def get_files_in_folder(date_str: str) -> list[dict]:
    folder = DATA_DIR / date_str
    if not folder.exists():
        return []
    files = []
    for f in sorted(folder.iterdir(), reverse=True):
        if f.suffix.lower() not in (".jpg", ".mp4"):
            continue
        meta: dict = {}
        meta_path = f.with_suffix(".json")
        if meta_path.exists():
            with open(meta_path) as fp:
                meta = json.load(fp)
        files.append({
            "name": f.name,
            "type": "image" if f.suffix.lower() == ".jpg" else "video",
            "size": f.stat().st_size,
            "path": f"{date_str}/{f.name}",
            "metadata": meta,
        })
    return files


def get_file_path(relative_path: str) -> Optional[Path]:
    path = (DATA_DIR / relative_path).resolve()
    if path.exists() and str(path).startswith(str(DATA_DIR.resolve())):
        return path
    return None


def delete_file(relative_path: str) -> bool:
    path = get_file_path(relative_path)
    if not path:
        return False
    path.unlink()
    meta = path.with_suffix(".json")
    if meta.exists():
        meta.unlink()
    return True


def delete_folder(date_str: str) -> bool:
    folder = DATA_DIR / date_str
    resolved = folder.resolve()
    if not folder.is_dir() or not str(resolved).startswith(str(DATA_DIR.resolve())):
        return False
    shutil.rmtree(folder)
    return True


def create_zip(date_str: Optional[str] = None) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        if date_str:
            folder = DATA_DIR / date_str
            for f in sorted(folder.iterdir()):
                if f.is_file():
                    zf.write(f, f"{date_str}/{f.name}")
        else:
            for f in DATA_DIR.rglob("*"):
                if f.is_file():
                    zf.write(f, str(f.relative_to(DATA_DIR)))
    buf.seek(0)
    return buf.getvalue()


def export_csv(date_str: Optional[str] = None) -> bytes:
    if date_str:
        files = get_files_in_folder(date_str)
    else:
        files = []
        for folder in get_date_folders():
            files.extend(get_files_in_folder(folder["date"]))

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "filename", "date", "type", "size_bytes",
        "sample_id", "captured_at", "note",
        "resolution", "exposure", "white_balance",
    ])
    for f in files:
        meta = f.get("metadata", {})
        cam = meta.get("camera_settings", {})
        writer.writerow([
            f["name"],
            f["path"].split("/")[0],
            f["type"],
            f["size"],
            meta.get("sample_id", ""),
            meta.get("captured_at", ""),
            meta.get("note", ""),
            cam.get("resolution", ""),
            cam.get("exposure", ""),
            cam.get("white_balance", ""),
        ])
    return buf.getvalue().encode("utf-8-sig")


def get_today_counts() -> dict:
    folder = DATA_DIR / get_today_str()
    if not folder.exists():
        return {"photos": 0, "videos": 0, "total": 0}
    photos = len(list(folder.glob("*.jpg")))
    videos = len(list(folder.glob("*.mp4")))
    return {"photos": photos, "videos": videos, "total": photos + videos}


def get_total_counts() -> dict:
    photos = len(list(DATA_DIR.rglob("*.jpg")))
    videos = len(list(DATA_DIR.rglob("*.mp4")))
    return {"photos": photos, "videos": videos, "total": photos + videos}
