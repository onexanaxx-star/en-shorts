"""Перерисовать уже собранные английские ролики после правок шаблона - без новой озвучки (из archive/<id>).
Ролик заново рендерится, загружается в Telegram, в queue_en.json обновляется tg_video.
    python en_rerender.py                 # все ролики очереди с сегодняшнего дня и позже
    python en_rerender.py en_tsunami_p2   # только эти"""
import datetime as dt
import json
import sys

import requests

import en_lib as L
import en_prod as P


def fetch_bg(info, out):
    """Фон Pexels по сохранённому номеру (сами видео в репозиторий не кладём)."""
    r = requests.get(f"https://api.pexels.com/videos/videos/{info['id']}", headers={"Authorization": L.os.environ["PEXELS_API_KEY"]}, timeout=30).json()
    ok = lambda f: (f.get("fps") or 0) >= 29 and f.get("height", 0) >= 1280 and f["width"] < f["height"]
    fl = min([f for f in r["video_files"] if ok(f)], key=lambda f: abs(f["height"] - 1920))
    L.CACHE.mkdir(parents=True, exist_ok=True)
    src = L.CACHE / f"{info['id']}_{fl['height']}.mp4"
    if not src.exists():
        src.write_bytes(requests.get(fl["link"], timeout=180).content)
    L.ff("-stream_loop", "-1", "-i", src, "-t", f"{info['seconds']:.2f}", "-an", "-vf",
         "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30", "-c:v", "libx264", "-crf", "20", "-preset", "veryfast", out)


def rerender(vid):
    arc = P.ARCHIVE / vid
    if not (arc / "props.json").exists():
        print(f"  {vid}: нет в архиве - пропускаю")
        return None
    L.prepare_public()
    pub = L.PUBLIC / "auto" / vid
    pub.mkdir(parents=True, exist_ok=True)
    L.ff("-i", arc / "voice.mp3", "-ar", "44100", "-ac", "1", pub / "voice.wav")
    for f in ("props.json", "music.mp3"):
        if (arc / f).exists():
            L.shutil.copy(arc / f, pub / f)
    props = json.loads((arc / "props.json").read_text(encoding="utf-8"))
    comp = "Scenario" if "spec" in props else "AutoInfo"
    if comp == "AutoInfo" and (arc / "bg.json").exists():
        fetch_bg(json.loads((arc / "bg.json").read_text(encoding="utf-8")), pub / "bg.mp4")
    out = L.OUT / f"{vid}.mp4"
    L.OUT.mkdir(parents=True, exist_ok=True)
    L.render(comp, pub / "props.json", out)
    return out


def main(ids):
    L.load_env()
    q = P.load_queue()
    today = dt.date.today().isoformat()
    todo = [x for x in q if (x["id"] in ids if ids else x.get("date", "") >= today)]
    for it in todo:
        out = rerender(it["id"])
        if out and L.os.environ.get("TELEGRAM_BOT_TOKEN"):
            it["tg_video"] = L.upload_video(out, P._admin_chat())
            P.save_queue(q)
        print(it["id"], "перерисован" if out else "пропущен", flush=True)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main(sys.argv[1:])
