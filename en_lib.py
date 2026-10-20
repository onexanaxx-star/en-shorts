"""Общие функции английского канала (19.10.2026). Самостоятельный модуль без кода русского канала - его копия живёт
в публичном репозитории сборки. Голос, разметка слов (Whisper), фон Pexels, музыка, загрузка в Telegram, ИИ-тексты."""
import json
import os
import re
import shutil
import subprocess
import time
import wave
from pathlib import Path

import requests

ROOT = Path(__file__).parent
RM = ROOT / "remotion"
PUBLIC = Path(os.environ.get("UNTAMESSE_PUBLIC") or (Path.home() / "untamesse_out" / "remotion_public" if os.name == "nt" else RM / "public"))
OUT = ROOT / "out" / "en"
CACHE = ROOT / "out" / "pexels"
VOICE_TEMPO = 1.15  # как у русского канала (решение владельца 17.10.2026)
VOICE_MODEL = "gemini-3.8-flash-tts"  # один голос всегда (у другой модели голос звучит иначе)
VOICE_NAME = "Algenib"
LLM_MODELS = ["gemini-flash-latest", "gemini-3.6-flash", "gemini-flash-lite-latest", "gemini-2.5-flash"]
SFX_LEVEL = 0.2


def load_env():
    f = ROOT / ".env"
    if f.exists():
        for line in f.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def ffmpeg():
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def ff(*a):
    subprocess.run([ffmpeg(), "-y", "-loglevel", "error", *map(str, a)], check=True)


# ---------- ИИ-тексты ----------
def llm(system, prompt, json_mode=True):
    errors = []
    for rnd in range(3):
        for m in LLM_MODELS:
            try:
                r = requests.post(f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent",
                                  headers={"x-goog-api-key": os.environ["GEMINI_API_KEY"]},
                                  json={"system_instruction": {"parts": [{"text": system}]},
                                        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                                        "generationConfig": {"temperature": 1.0, **({"responseMimeType": "application/json"} if json_mode else {})}},
                                  timeout=180)
                if r.ok:
                    return r.json()["candidates"][0]["content"]["parts"][0]["text"]
                errors.append(f"{m}:{r.status_code}")
            except Exception as e:
                errors.append(f"{m}:{type(e).__name__}")
            time.sleep(5)
        time.sleep(20)
    raise RuntimeError("LLM недоступен: " + ", ".join(errors[-6:]))


def parse_json(text):
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0]
    return json.loads(text[text.find("{"):text.rfind("}") + 1], strict=False)


# ---------- голос ----------
NOTES = ("### DIRECTOR'S NOTES\n"
         "Voice: a calm but gripping adult male narrator, like a survival documentary - low-mid pitch, clear, confident, "
         "the same voice in every video.\n"
         "Delivery: fast-paced storytelling for a short video, urgent but controlled, short pauses between steps, slight "
         "emphasis on numbers and warnings. Pronounce every word exactly as written.\nLanguage: English (American).\n\n### TRANSCRIPT\n")


def gemini_voice(lines, dest):
    import base64
    body = {"contents": [{"parts": [{"text": NOTES + "\n".join(lines)}]}],
            "generationConfig": {"responseModalities": ["AUDIO"],
                                 "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": VOICE_NAME}}}}}
    r = None
    for _ in range(5):
        r = requests.post(f"https://generativelanguage.googleapis.com/v1beta/models/{VOICE_MODEL}:generateContent",
                          headers={"x-goog-api-key": os.environ["GEMINI_API_KEY"]}, json=body, timeout=300)
        if r.ok:
            pcm = base64.b64decode(r.json()["candidates"][0]["content"]["parts"][0]["inlineData"]["data"])
            with wave.open(str(dest), "wb") as w:
                w.setnchannels(1), w.setsampwidth(2), w.setframerate(24000)
                w.writeframes(pcm)
            return dest
        if r.status_code == 429:
            raise VoiceLimit("дневной лимит озвучки исчерпан")
        time.sleep(30)
    raise RuntimeError(f"озвучка недоступна: {r.status_code}")


class VoiceLimit(RuntimeError):
    pass


def words_for(lines, segs):
    out = []
    for line, s in zip(lines, segs):
        ws = line.split()
        tot = sum(len(w) + 1 for w in ws)
        acc = 0
        for w in ws:
            a = s["start"] + (s["end"] - s["start"]) * acc / tot
            acc += len(w) + 1
            out.append([w, round(a, 3), round(s["start"] + (s["end"] - s["start"]) * acc / tot, 3)])
    return out


def align_words(lines, segs, wav):
    try:
        import difflib
        import numpy as np
        from faster_whisper import WhisperModel
        raw = subprocess.run([ffmpeg(), "-v", "error", "-i", str(wav), "-ac", "1", "-ar", "16000", "-f", "s16le", "-"], capture_output=True, check=True).stdout
        audio = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
        sg, _ = WhisperModel("base", device="cpu", compute_type="int8").transcribe(audio, language="en", word_timestamps=True)
        rec = [(w.word.strip(), w.start, w.end) for s in sg for w in s.words if w.word.strip()]
        norm = lambda w: re.sub(r"[^a-z0-9]", "", w.lower())
        script = [w for l in lines for w in l.split()]
        sm = difflib.SequenceMatcher(None, [norm(w) for w in script], [norm(r[0]) for r in rec], autojunk=False)
        hit = {}
        for a, b, n in sm.get_matching_blocks():
            for j in range(n):
                hit[a + j] = b + j
        if len(hit) < len(script) * 0.6:
            raise ValueError(f"совпало мало слов: {len(hit)}/{len(script)}")
        rough = words_for(lines, segs)
        out = []
        for i, w in enumerate(script):
            out.append([w, round(rec[hit[i]][1], 3), round(rec[hit[i]][2], 3)] if i in hit else [w, rough[i][1], rough[i][2]])
        for i in range(1, len(out)):
            out[i][1] = max(out[i][1], out[i - 1][1] + 0.01)
        print(f"  слова по распознаванию: {len(hit)}/{len(script)}")
        return out
    except Exception as err:
        print("  точная разметка не вышла:", err)
        return words_for(lines, segs)


def external_voice(src, lines, dest):
    """Ускорение x1.15, громкость -14 LUFS, разметка слов и фраз, обрезка «выдоха» после последнего слова."""
    ff("-i", src, "-af", f"atempo={VOICE_TEMPO},loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", "44100", "-ac", "1", dest)
    with wave.open(str(dest)) as w:
        dur = w.getnframes() / w.getframerate()
    tot = sum(len(l) for l in lines)
    acc, segs = 0, []
    for l in lines:
        segs.append({"text": l, "start": round(dur * acc / tot, 3), "end": round(dur * (acc + len(l)) / tot, 3)})
        acc += len(l)
    words = align_words(lines, segs, dest)
    k = 0
    for i, l in enumerate(lines):
        n = len(l.split())
        segs[i]["start"], segs[i]["end"] = words[k][1], words[k + n - 1][2]
        k += n
    end = min(dur, words[-1][2] + 0.15)
    tmp = dest.with_name("voice_trim.wav")
    ff("-i", dest, "-t", f"{end:.3f}", "-af", f"afade=t=out:st={max(0.0, end - 0.12):.3f}:d=0.12", tmp)
    tmp.replace(dest)
    return segs, words, end


def rms(path):
    import numpy as np
    with wave.open(str(path)) as w:
        x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
    x = x[np.abs(x) > 0.02]
    return float(np.sqrt(np.mean(x ** 2))) if len(x) else 0.1


def sfx_vol(voice_wav):
    v = rms(voice_wav)
    return {n: round(min(1.0, SFX_LEVEL * v / rms(PUBLIC / "sfx" / f"{n}.wav")), 3) for n in ("hit", "pop", "tick", "ding")}


# ---------- музыка и фон ----------
MUSIC_URL = "https://incompetech.com/music/royalty-free/mp3-royaltyfree/"


def pick_music_file(file, dest):
    from urllib.parse import quote
    cache = CACHE.parent / "music" / file
    if not cache.exists():
        cache.parent.mkdir(parents=True, exist_ok=True)
        r = requests.get(MUSIC_URL + quote(file), headers={"User-Agent": "Mozilla/5.0"}, timeout=120)
        r.raise_for_status()
        cache.write_bytes(r.content)
    shutil.copy(cache, dest)


def pick_music(mood, key, dest):
    from urllib.parse import quote
    lib = json.loads((ROOT / "content" / "music_library.json").read_text(encoding="utf-8"))
    tracks = lib.get(mood) or lib["tense"]
    tr = tracks[sum(map(ord, key)) % len(tracks)]
    cache = CACHE.parent / "music" / tr["file"]
    if not cache.exists():
        cache.parent.mkdir(parents=True, exist_ok=True)
        r = requests.get(MUSIC_URL + quote(tr["file"]), headers={"User-Agent": "Mozilla/5.0"}, timeout=120)
        r.raise_for_status()
        cache.write_bytes(r.content)
    shutil.copy(cache, dest)
    return tr["title"]


EXCLUDE = ("woman", "women", "girl", "female", "lady", "child", "kid", "baby", "couple", "wedding", "cartoon", "toy", "logo", "text")


def ai_pick(videos, phrase):
    import base64
    parts = [{"text": f"Pick ONE best background video for: {phrase}. Calm, dark, cinematic, no faces, no text, no logos. "
                      'Answer JSON: {"best": index}'}]
    for k, v in enumerate(videos):
        try:
            parts += [{"text": f"Candidate {k}:"}, {"inline_data": {"mime_type": "image/jpeg", "data": base64.b64encode(requests.get(v["image"], timeout=30).content).decode()}}]
        except Exception:
            continue
    for m in ["gemini-3.6-flash", "gemini-flash-latest"]:
        try:
            r = requests.post(f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent",
                              headers={"x-goog-api-key": os.environ["GEMINI_API_KEY"]},
                              json={"contents": [{"parts": parts}], "generationConfig": {"responseMimeType": "application/json"}}, timeout=120)
            if r.ok:
                b = int(json.loads(r.json()["candidates"][0]["content"]["parts"][-1]["text"])["best"])
                if 0 <= b < len(videos):
                    return b
        except Exception:
            continue
    return None


def pick_bg(query, seconds, out):
    for q in [query, "dark abstract smoke slow motion", "night city lights slow motion"]:
        r = requests.get("https://api.pexels.com/videos/search", params={"query": q, "orientation": "portrait", "per_page": 20},
                         headers={"Authorization": os.environ["PEXELS_API_KEY"]}, timeout=30).json()
        ok = lambda f: (f.get("fps") or 0) >= 29 and f.get("height", 0) >= 1280 and f["width"] < f["height"]
        vids = [v for v in r.get("videos", []) if v["duration"] >= 8 and any(ok(f) for f in v["video_files"]) and not any(w in v["url"].lower() for w in EXCLUDE)]
        if not vids:
            continue
        b = ai_pick(vids[:8], q)
        v = vids[b if b is not None else 0]
        fl = min([f for f in v["video_files"] if ok(f)], key=lambda f: abs(f["height"] - 1920))
        CACHE.mkdir(parents=True, exist_ok=True)
        src = CACHE / f"{v['id']}_{fl['height']}.mp4"
        if not src.exists():
            src.write_bytes(requests.get(fl["link"], timeout=180).content)
        ff("-stream_loop", "-1", "-i", src, "-t", f"{seconds:.2f}", "-an", "-vf",
           "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30", "-c:v", "libx264", "-crf", "20", "-preset", "veryfast", out)
        return v["id"]
    raise RuntimeError("нет фона на Pexels")


# ---------- Telegram ----------
def tg(method, **kw):
    r = requests.post(f"https://api.telegram.org/bot{os.environ['TELEGRAM_BOT_TOKEN']}/{method}", timeout=300, **kw)
    r.raise_for_status()
    return r.json()


def upload_video(path, chat):
    """Ролик - в Telegram (хранилище), сообщение сразу удаляется; остаётся file_id."""
    with open(path, "rb") as f:
        res = tg("sendVideo", data={"chat_id": chat, "disable_notification": "true", "supports_streaming": "true", "width": 1080, "height": 1920},
                 files={"video": (Path(path).name, f, "video/mp4")})["result"]
    try:
        tg("deleteMessage", data={"chat_id": chat, "message_id": res["message_id"]})
    except Exception:
        pass
    return res["video"]["file_id"]


def prepare_public():
    """Шрифты и звуки - рядом с рабочими файлами Remotion."""
    if PUBLIC != RM / "public":
        for item in (RM / "public").iterdir():
            if item.is_dir():
                shutil.copytree(item, PUBLIC / item.name, dirs_exist_ok=True)
            else:
                PUBLIC.mkdir(parents=True, exist_ok=True)
                shutil.copy(item, PUBLIC / item.name)


def render(comp, props, out):
    pf = Path(props)
    npx = "npx.cmd" if os.name == "nt" else "npx"
    subprocess.run([npx, "remotion", "render", "src/index.ts", comp, str(Path(out).resolve()), f"--props={pf.resolve()}",
                    f"--public-dir={PUBLIC.resolve()}", "--crf=20", "--log=error"], cwd=RM, check=True)
