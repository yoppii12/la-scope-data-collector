import json
from pathlib import Path

CONFIG_PATH = Path(__file__).parent.parent / "settings.json"

DEFAULT_SETTINGS: dict = {
    "camera": {
        "resolution": "1920x1080",
        "framerate": 30,
        "exposure": "auto",
        "white_balance": "auto",
    },
    "interval": {
        "interval_seconds": 5,
        "max_shots": 100,
    },
    "annotation": {
        "default_sample_id": "",
        "default_note": "",
        "default_condition": "",
    },
}


def load_settings() -> dict:
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH) as f:
            saved = json.load(f)
        merged = {k: {**DEFAULT_SETTINGS[k]} for k in DEFAULT_SETTINGS}
        for section, values in saved.items():
            if section in merged and isinstance(values, dict):
                merged[section].update(values)
        return merged
    return {k: {**v} for k, v in DEFAULT_SETTINGS.items()}


def save_settings(settings: dict):
    with open(CONFIG_PATH, "w") as f:
        json.dump(settings, f, indent=2, ensure_ascii=False)
