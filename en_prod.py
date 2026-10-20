"""Самосборка английского канала (19.10.2026). Каждый день 2 ролика: утром - сценарий выживания (серия из 2 частей:
часть 1 обрывается на интриге, часть 2 - развязка на следующий день), вечером - правдивая история.
Советы - только из content/en_survival.json (официальные источники), факты историй - только из content/en_stories.json.
ИИ пишет сценарий, код проверяет, Gemini озвучивает (Algenib, тот же голос), Remotion рисует, ролик уходит в Telegram,
в queue/queue_en.json - дата, слот и подписи для YouTube/TikTok.
    python en_prod.py            # достроить очередь на 7 дней вперёд (не больше 4 роликов за запуск)
    python en_prod.py --one morning|evening   # собрать один ролик (проба)"""
import datetime as dt
import json
import os
import re
import sys
from pathlib import Path

import en_lib as L

ROOT = L.ROOT
QF = ROOT / "queue" / "queue_en.json"
STATE = ROOT / "data" / "en_state.json"
SURV = json.loads((ROOT / "content" / "en_survival.json").read_text(encoding="utf-8"))
STORIES = json.loads((ROOT / "content" / "en_stories.json").read_text(encoding="utf-8"))
def _admin_chat():
    """Куда складывать ролики в Telegram: секрет ADMIN_CHAT_ID (в публичной сборке) или настройки русского канала."""
    if os.environ.get("ADMIN_CHAT_ID"):
        return os.environ["ADMIN_CHAT_ID"]
    try:
        import channel
        return str(channel.ADMIN_CHAT_ID)
    except ImportError:
        raise RuntimeError("нужен секрет ADMIN_CHAT_ID")


ADMIN_CHAT = None
DAYS_AHEAD = 7
MAX_PER_RUN = int(os.environ.get("EN_MAX", "4"))

ENVS = ["beach", "city", "forest", "mountain", "desert", "home", "ice", "highway"]
FOCUS = ["hero", "shelter", "top", "hazard", "crowd", "wide", "sky"]
ACTIONS = ["stand", "walk_to_shelter", "climb_shelter", "enter_shelter", "run_away", "crouch", "wave", "look"]
ICONS = ["water", "phone", "no_signal", "flashlight", "map", "fire", "rope", "car", "key", "clock", "bag", "compass", "warning",
         "heart", "door", "snow", "food", "radio", "money", "plane", "skull", "question"]
SHELTER = {"beach": "a 10-floor concrete hotel", "city": "a tall office building", "forest": "a small wooden cabin",
           "mountain": "a rock overhang", "desert": "a big rock giving shade", "home": "the house (with a basement)",
           "ice": "the tree-lined shore", "highway": "the hero's own car"}

ORDER = {"move_first": "the hero must FINISH moving to safety (all walk/climb/enter/run_away actions) BEFORE hazard_line - the danger hits only after.",
         "hazard_first": "the danger hits early (hazard_line is in the first third of the lines), then the hero reacts with the correct actions."}

SYSTEM = ("You write viral short-form video scripts for an American audience (TikTok / YouTube Shorts). Style: gripping, "
          "simple words, short sentences, present tense, like a calm survival documentary narrator. Never invent statistics, "
          "dates or facts that are not given to you. No gore. No em dashes. Output strict JSON only.")

SURV_PROMPT = """Write PART {part} of a 2-part survival scenario video.
Situation: {title}. Setting: {env} (the shelter in the scene is {shelter}). Danger on screen: {hazard}. Time of day: {time}.
Official safety advice you MUST use (use ONLY these facts and numbers, do not add others):
{advice}
How the hero must move (this is the correct, safe behavior - follow it): {moves}
Order: {order_rule}
{context}
Requirements:
- {n_lines} spoken lines of 12-18 words each ({words} words in total - the video must be 60-80 seconds; short lines only for 'One.' 'Two.' steps).
- {part_rules}
- Give the hero a short American first name. Write every number in digits (4th, 10, 20).
- Steps are introduced as "One." "Two." "Three." at the start of a line.
- For EACH line give one shot: {{"focus": one of {focus}, "zoom": "close"|"medium"|"wide", "tag": optional ALL CAPS label max 22 chars,
  "tagColor": "red"|"yellow"|"green", "hero": optional action, one of {actions}, "icon": optional, one of {icons}, "iconText": optional max 10 chars,
  "fx": optional "recede" (beach: the sea pulls back) or "lights_off" (power goes out)}}
  The hero action happens during that line (walk_to_shelter, then climb_shelter or enter_shelter later). Use tags/icons on about half the lines.
- "hazard_line": index (0-based) of the line where the danger visibly hits. "crowd_line": index where other people panic, or -1 if no crowd.
- "timer": a countdown if it fits ({{"label": "ALL CAPS", "minutes": number that appears in your lines, "startLine": i, "endLine": j, "after": "ALL CAPS label after it ends"}}) or null.
- "hot": up to 10 key words from the lines to color (danger words red, key actions yellow): {{"word": "red"|"yellow"}}.
- "title": a hooky YouTube title (max 70 chars, no hashtags). "description": 1-2 sentences. "hashtags": 5 hashtags.
{extra}
Return JSON: {{"lines": [...], "shots": [...], "hero": "Name", "hazard_line": n, "crowd_line": n, "timer": {{...}} or null, "hot": {{...}},
"title": "...", "description": "...", "hashtags": [...]{extra_keys}}}"""

PART1 = ("Line 1 is a second-person hook: 'If ... , do not ...' or similar, with a surprising rule. Then introduce the hero and a deadline. "
         "Teach the advice as 3 numbered steps through the hero's actions. The last 2 lines: 'It was the perfect plan. There was just one "
         "problem.' style, then a dramatic unexpected twist that is NOT resolved (a new dilemma). End there.")
PART2 = ("Line 1 recaps the cliffhanger in one sentence ('Yesterday ...' is NOT allowed; say 'Part two.' then recap). Resolve the dilemma in a "
         "realistic way that follows the official advice (the hero does not do anything reckless; help arrives or a smart safe choice is made). "
         "Teach any advice not used in part 1. Last line: one memorable rule, then 'Follow for a new scenario tomorrow.'")

STORY_PROMPT = """Write a short true-story video script about: {title}.
Verified facts (use ONLY these facts, names, dates and numbers; do not add anything that is not here):
{facts}
Requirements: 13-15 spoken lines of 14-18 words EACH (210-240 words total, the video must be 62-75 seconds), present tense storytelling,
write every number and year in digits (1983, 41,000, 69), line 1 is a strong hook that makes people stay, build tension, end with a short question to the viewer that invites comments.
"title": hooky YouTube title max 70 chars. "description": 1-2 sentences. "hashtags": 5 hashtags. "mood": "tense"|"dark"|"epic"|"calm".
Return JSON: {{"lines": [...], "title": "...", "description": "...", "hashtags": [...], "mood": "..."}}"""

DIRECTOR = """You direct an animated infographic short (dark background, accent color, animated numbers and diagrams).
Lines:
{lines}
For EACH line choose one animation. Use numbers ONLY if they appear in the lines. Types and JSON examples:
counter {{"type":"counter","to":41000,"suffix":"","label":"FEET"}}; odometer {{"type":"odometer","to":1983,"label":"YEAR"}};
ring {{"type":"ring","pct":45,"label":"FUEL ON BOARD","bad":true}}; calendar {{"type":"calendar","to":11,"label":"DAYS"}};
gauge {{"type":"gauge","value":0.1,"label":"CHANCES","low":"LOW","high":"HIGH"}};
title {{"type":"title","text":"2-5 WORDS","gold":true}}; typewriter {{"type":"typewriter","text":"2-5 WORDS"}};
marker {{"type":"marker","text":"short sentence","mark":"keyword"}}; stamp {{"type":"stamp","text":"1-2 WORDS"}};
wordstack {{"type":"wordstack","words":["NO FOOD.","NO MAP.","NO HELP."]}}; quote {{"type":"quote","text":"exact quote from the lines","author":"Name"}};
bars {{"type":"bars","title":"...","items":[{{"label":"...","good":false,"strike":true}},{{"label":"...","good":true}}]}};
columns {{"type":"columns","title":"...","items":[{{"label":"...","h":0.4}},{{"label":"...","h":1,"good":true}}]}};
versus {{"type":"versus","left":"...","leftSub":"...","right":"...","rightSub":"..."}}; scale {{"type":"scale","left":"...","right":"...","heavier":"right"}};
line {{"type":"line","shape":"crash"|"rise"|"dip_then_rise","marks":[{{"at":"low","text":"..."}},{{"at":"end","text":"..."}}]}};
steps {{"type":"steps","steps":["A","B","C"]}}; stairs {{"type":"stairs","steps":["A","B","C","D"]}};
timeline {{"type":"timeline","items":[{{"year":"1914","text":"..."}},{{"year":"1916","text":"...","bad":true}}]}};
attempts {{"type":"attempts","items":[{{"title":"#1","note":"...","ok":false}}]}}; checklist {{"type":"checklist","title":"...","items":[{{"text":"...","ok":true}}]}};
notify {{"type":"notify","app":"RADIO","text":"...","bad":true}}; drain {{"type":"drain","label":"..."}}; none {{"type":"none"}}.
Rules: never the same type on two lines in a row, each type at most twice, at least 5 different types, "none" at most 2 times, all labels in ENGLISH CAPS (except item labels), short;
no facts or numbers that are not in the lines. "bg": a Pexels search query in English for a calm dark cinematic portrait background
matching the story (no people). Return JSON: {{"scenes": [exactly {n} flat objects like {{"type": ...}} in line order], "bg": "..."}}"""

NUM_WORDS = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10, "eleven": 11,
             "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15, "sixteen": 16, "seventeen": 17, "eighteen": 18, "nineteen": 19,
             "twenty": 20, "thirty": 30, "forty": 40, "fifty": 50, "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90, "hundred": 100}


def numbers_in(text):
    t = text.lower()
    found = {float(x.replace(",", "")) for x in re.findall(r"\d[\d,]*(?:\.\d+)?", t)}
    found |= {float(v) for w, v in NUM_WORDS.items() if re.search(rf"(?<![a-z]){w}(?![a-z])", t)}
    return found


def ask(prompt, check, tries=6, repair=None):
    """Спрашивает ИИ, пока ответ не пройдёт проверку; repair(d) - последняя попытка починить ответ кодом."""
    note = ""
    last = None
    for _ in range(tries):
        try:
            d = L.parse_json(L.llm(SYSTEM, prompt + note))
        except Exception as e:
            note = f"\nIMPORTANT: return valid JSON only ({type(e).__name__})."
            continue
        problems = check(d)
        if not problems:
            return d
        last = d
        print("  отклонено:", "; ".join(problems)[:300])
        note = "\nIMPORTANT, your previous answer was rejected: " + "; ".join(problems)
    if repair and last is not None:
        fixed = repair(last)
        if not check(fixed):
            print("  план починен кодом")
            return fixed
    raise RuntimeError("ИИ не справился со сценарием")


def common_checks(d, wmin, wmax, allowed_text, small_ok=False):
    p = []
    lines = d.get("lines") or []
    words = sum(len(l.split()) for l in lines)
    if words < wmin:
        p.append(f"too short: {words} words, need {wmin}-{wmax}. Add about {wmin - words + 10} more words: {(wmin - words) // 15 + 1} more lines of 14-18 words with details from the facts")
    elif words > wmax:
        p.append(f"too long: {words} words, need {wmin}-{wmax}")
    if any(len(l.split()) > 20 for l in lines):
        p.append("some lines are longer than 18 words")
    if "—" in json.dumps(d, ensure_ascii=False):
        p.append("no em dashes")
    extra = numbers_in(" ".join(lines)) - numbers_in(allowed_text) - {1.0, 2.0, 3.0}
    if small_ok:  # в выдуманном сюжете можно срок/этажи (до 60), но не статистику с процентами
        extra = {x for x in extra if x > 60} | ({0.5} if re.search(r"\d\s*(%|percent)", " ".join(lines).lower()) else set())
    if extra:
        p.append(f"numbers {sorted(extra)} are not in the given facts - remove them")
    if not d.get("title") or len(d["title"]) > 80:
        p.append("title missing or too long")
    return p


def surv_check(d, topic, part=1):
    p = common_checks(d, 205, 260, " ".join(topic["advice"]) + " " + topic["title"], small_ok=True)
    lines, shots = d.get("lines") or [], d.get("shots") or []
    if len(shots) != len(lines):
        p.append(f"need exactly one shot per line ({len(lines)} lines, {len(shots)} shots)")
    for i, s in enumerate(shots):
        if s.get("focus") not in FOCUS:
            p.append(f"shot {i}: bad focus")
        if s.get("hero") and s["hero"] not in ACTIONS:
            p.append(f"shot {i}: bad hero action {s['hero']}")
        if s.get("icon") and s["icon"] not in ICONS:
            p.append(f"shot {i}: bad icon {s['icon']}")
        if s.get("tag") and len(s["tag"]) > 26:
            p.append(f"shot {i}: tag too long")
    if not isinstance(d.get("hazard_line"), int) or not (0 <= d["hazard_line"] < max(1, len(lines))):
        p.append("hazard_line must be a valid line index")
    moves = [i for i, s in enumerate(shots) if s.get("hero") in ("walk_to_shelter", "climb_shelter", "enter_shelter", "run_away")]
    hl = d.get("hazard_line")
    if part == 1 and isinstance(hl, int) and lines:
        if topic["order"] == "move_first" and moves and max(moves) >= hl:
            p.append(f"hazard_line ({hl}) must come AFTER the hero finishes moving (last move at line {max(moves)})")
        if topic["order"] == "move_first" and not moves:
            p.append("the hero must move to safety (walk_to_shelter / climb_shelter / enter_shelter / run_away) before the danger")
        if topic["order"] == "hazard_first" and hl > len(lines) // 3:
            p.append("hazard_line must be in the first third of the lines")
    tm = d.get("timer")
    if tm:
        if float(tm.get("minutes", -1)) not in numbers_in(" ".join(lines)):
            p.append("timer minutes must be a number spoken in the lines")
        if not (0 <= tm.get("startLine", -1) < tm.get("endLine", -1) <= len(lines)):
            p.append("timer startLine/endLine invalid")
    return p


def story_check(d, st):
    return common_checks(d, 200, 255, st["facts"] + " " + st["title"])


# ---------- очередь и даты ----------
def load_queue():
    return json.loads(QF.read_text(encoding="utf-8")) if QF.exists() else []


def save_queue(q):
    QF.parent.mkdir(exist_ok=True)
    QF.write_text(json.dumps(q, ensure_ascii=False, indent=1), encoding="utf-8")


def next_date(q, slot):
    taken = {x["date"] for x in q if x["slot"] == slot}
    d = dt.date.today() + dt.timedelta(days=1)
    while d.isoformat() in taken:
        d += dt.timedelta(days=1)
    return d


def load_state():
    return json.loads(STATE.read_text(encoding="utf-8")) if STATE.exists() else {"topic": 0, "part": 1, "story": 0}


def save_state(s):
    STATE.parent.mkdir(exist_ok=True)
    STATE.write_text(json.dumps(s, ensure_ascii=False, indent=1), encoding="utf-8")


def dedupe(text):
    """Убирает повторяющиеся хэштеги."""
    seen, out = set(), []
    for w in text.split():
        if w.startswith("#"):
            if w.lower() in seen:
                continue
            seen.add(w.lower())
        out.append(w)
    return " ".join(out)


def tiktok(text):
    """Подпись TikTok: без #shorts (это тег YouTube) и без повторов."""
    return dedupe(re.sub(r"\s*#shorts(?![a-z0-9])", "", text, flags=re.I))


def credits(music):
    if not music:
        return ""
    return f"Music: \"{music}\" by Kevin MacLeod (incompetech.com), licensed under CC BY 4.0."


# ---------- сборка ----------
def build_morning(state):
    topic = SURV[state["topic"] % len(SURV)]
    part = state["part"]
    if part == 1:
        context, extra_keys = "", ', "cliffhanger": "one sentence: what the unresolved twist is"'
    else:
        p1 = state["part1"]
        context = "PART 1 (already published) lines:\n" + "\n".join(p1["lines"]) + f"\nThe cliffhanger: {p1['cliffhanger']}\nHero name: {p1['hero']}"
        extra_keys = ""
    prompt = SURV_PROMPT.format(part=part, title=topic["title"], env=topic["env"], shelter=SHELTER[topic["env"]], hazard=topic["hazard"],
                                time=topic["time"], moves=topic["moves"], order_rule=ORDER[topic["order"]] if part == 1 else "the danger is already happening from line 1 (hazard_line 0).", advice="\n".join(f"- {a}" for a in topic["advice"]), context=context,
                                n_lines="15-19", words="215-245", part_rules=PART1 if part == 1 else PART2,
                                focus=FOCUS, actions=ACTIONS, icons=ICONS, extra="" if part == 1 else "- Keep the same hero name.", extra_keys=extra_keys)
    d = state.get("draft_morning") or ask(prompt, lambda d: surv_check(d, topic, part) + ([] if part == 2 or d.get("cliffhanger") else ["cliffhanger missing"]))
    state["draft_morning"] = d
    save_state(state)
    vid = f"en_{topic['id']}_p{part}"
    hot = {re.sub(r"[^a-z0-9]", "", k.lower()): ("#FF4D4D" if v == "red" else "#FFC83D") for k, v in (d.get("hot") or {}).items()}
    tm = d.get("timer")
    start = topic.get("heroStart", "ground") if part == 1 else state["part1"].get("end", "ground")
    spec = {"env": topic["env"], "time": topic["time"], "hero": {"name": d.get("hero", "Sam")}, "heroStart": start,
            "crowd": d["crowd_line"] if isinstance(d.get("crowd_line"), int) and d["crowd_line"] >= 0 else False,
            "hazard": {"type": topic["hazard"], "line": 0 if part == 2 else d["hazard_line"]},
            "timer": tm or None, "shots": d["shots"], "hot": hot,
            "ending": "WHAT WOULD YOU DO?" if part == 1 else "FOLLOW FOR MORE",
            "endingSub": "PART 2 TOMORROW" if part == 1 else "NEW SCENARIO TOMORROW"}
    if not spec["timer"]:
        spec.pop("timer")
    out, music = make_video(vid, d["lines"], "Scenario", spec=spec, mood="tense")
    tags = " ".join(h if h.startswith("#") else "#" + h for h in d.get("hashtags", [])[:5])
    item = {"id": vid, "slot": "morning", "kind": "survival", "title": d["title"] if "part" in d["title"].lower() else d["title"] + f" (Part {part})",
            "yt": f"{d['description']}\n\nBased on official safety guidance: {topic['sources']}. Not professional advice.\n\n{credits(music)}\n\n" + dedupe(f"{tags} #shorts"),
            "tiktok": tiktok(f"{d['title']} What would you do? {tags} #survival #fyp"), "file": str(out)}
    if part == 1:
        acts = [s.get("hero") for s in d["shots"] if s.get("hero") in ("walk_to_shelter", "climb_shelter", "enter_shelter", "run_away")]
        end = {"climb_shelter": "top", "enter_shelter": "inside", "walk_to_shelter": "door"}.get(acts[-1] if acts else "", start)
        state.update(part=2, part1={"lines": d["lines"], "cliffhanger": d["cliffhanger"], "hero": d.get("hero", "Sam"), "end": end})
    else:
        state.update(part=1, topic=state["topic"] + 1)
        state.pop("part1", None)
    state.pop("draft_morning", None)
    return item


def build_evening(state):
    st = STORIES[state["story"] % len(STORIES)]
    d = state.get("draft_evening") or ask(STORY_PROMPT.format(title=st["title"], facts=st["facts"]), lambda d: story_check(d, st))
    state["draft_evening"] = d
    save_state(state)
    lines = d["lines"]
    n = len(lines)
    allowed = numbers_in(" ".join(lines))
    num_keys = {"counter": "to", "odometer": "to", "ring": "pct", "calendar": "to"}

    def dcheck(p):
        # ИИ иногда заворачивает анимацию в {"line": ..., "animation": {...}} - разворачиваем
        p["scenes"] = [x.get("animation", x) if isinstance(x, dict) else {"type": "none"} for x in (p.get("scenes") or [])]
        sc = p["scenes"]
        probs = [] if len(sc) == n else [f"need exactly {n} scenes"]
        types = [s.get("type") for s in sc if s.get("type") != "none"]
        if any(types.count(x) > 2 for x in set(types)):
            probs.append("a type is used more than twice")
        if any(a.get("type") == b.get("type") and a.get("type") != "none" for a, b in zip(sc, sc[1:])):
            probs.append("the same type twice in a row - alternate types")
        if len(set(types)) < min(5, n):
            probs.append("use at least 5 different types")
        for s in sc:
            k = num_keys.get(s.get("type"))
            if k and float(s.get(k, -1)) not in allowed:
                probs.append(f"{s['type']} number {s.get(k)} is not in the lines")
        if re.search("[а-яё]", json.dumps(p, ensure_ascii=False).lower()):
            probs.append("labels must be in English")
        return probs

    def repair(p):
        """Лишние повторы и одинаковые соседние анимации - на текстовые со словами самой фразы."""
        sc = [dict(x) for x in (p.get("scenes") or [])][:n]
        sc += [{"type": "none"}] * (n - len(sc))
        spare = ["title", "typewriter", "stamp", "wordstack", "marker"]
        used = {}
        for i, x in enumerate(sc):
            t = x.get("type")
            k = num_keys.get(t)
            bad = ((t != "none" and used.get(t, 0) >= 2) or (i > 0 and t == sc[i - 1].get("type") and t != "none")
                   or (k and float(x.get(k, -1)) not in allowed))
            if bad:
                words = re.sub(r"[^A-Za-z0-9' ]", "", lines[i]).upper().split()
                alt = next((a for a in spare if used.get(a, 0) < 2 and (i == 0 or sc[i - 1].get("type") != a)), "title")
                if alt == "wordstack":
                    x = {"type": "wordstack", "words": [w + "." for w in words[:3]]}
                elif alt == "marker":
                    ws = lines[i].split()[:6]
                    x = {"type": "marker", "text": " ".join(ws), "mark": max(ws, key=len).strip(".,!?")}
                else:
                    x = {"type": alt, "text": " ".join(words[:2] if alt == "stamp" else words[:4])}
                sc[i] = x
                t = alt
            used[t] = used.get(t, 0) + 1
        return {**p, "scenes": sc}

    plan = state.get("draft_plan") or ask(DIRECTOR.format(lines="\n".join(f"{i + 1}. {l}" for i, l in enumerate(lines)), n=n), dcheck, repair=repair)
    for sc in plan["scenes"]:  # слова при числе (METERS, PEOPLE) - в подпись, иначе огромная надпись вылезает за край
        suf = str(sc.get("suffix") or "")
        if sc.get("type") in ("counter", "odometer") and re.search("[A-Za-z]{2,}", suf):
            sc["label"] = (suf.strip() + " " + str(sc.get("label") or "")).strip().upper()
            sc["suffix"] = ""
    state["draft_plan"] = plan
    save_state(state)
    vid = f"en_story_{st['id']}"
    out, music = make_video(vid, lines, "AutoInfo", scenes=plan["scenes"], bg=plan.get("bg") or st["bg"], accent=st["accent"],
                            tag={"aviation": "AVIATION", "survival": "TRUE STORY", "business": "BUSINESS FAILS", "space": "SPACE",
                                 "mystery": "UNSOLVED"}.get(st["kind"], "TRUE STORY"), mood=d.get("mood", "tense"))
    tags = " ".join(h if h.startswith("#") else "#" + h for h in d.get("hashtags", [])[:5])
    state["story"] += 1
    state.pop("draft_evening", None)
    state.pop("draft_plan", None)
    return {"id": vid, "slot": "evening", "kind": "story", "title": d["title"],
            "yt": f"{d['description']}\n\nSources: {st['sources']}.\n\n{credits(music)}\n\n" + dedupe(f"{tags} #shorts"),
            "tiktok": tiktok(f"{d['title']} {tags} #truestory #fyp"), "file": str(out)}


ARCHIVE = ROOT / "archive"


def archive(vid, pub):
    """Голос, музыка и план ролика - в репозиторий (archive/<id>): потом любые правки шаблона можно применить
    к уже собранным роликам без новой озвучки (en_rerender.py). Фон Pexels не храним - только его номер."""
    dst = ARCHIVE / vid
    dst.mkdir(parents=True, exist_ok=True)
    L.ff("-i", pub / "voice.wav", "-c:a", "libmp3lame", "-b:a", "96k", dst / "voice.mp3")
    for f in ("props.json", "bg.json"):
        if (pub / f).exists():
            L.shutil.copy(pub / f, dst / f)
    if (pub / "music.txt").exists():  # музыку не храним (её всегда можно скачать) - только название файла
        L.shutil.copy(pub / "music.txt", dst / "music.txt")


def make_video(vid, lines, comp, spec=None, scenes=None, bg=None, accent=None, tag=None, mood="tense"):
    L.prepare_public()
    pub = L.PUBLIC / "auto" / vid
    pub.mkdir(parents=True, exist_ok=True)
    txt = pub / "lines.txt"
    raw = pub / "gemini_raw.wav"
    text = "\n".join(lines)
    if not (raw.exists() and txt.exists() and txt.read_text(encoding="utf-8") == text):
        L.gemini_voice(lines, raw)  # озвучка ограничена лимитом - при повторе с тем же текстом берём готовую
        txt.write_text(text, encoding="utf-8")
    segs, words, t = L.external_voice(raw, lines, pub / "voice.wav")
    total = round(t + 3.0, 3)
    try:
        music = L.pick_music(mood, vid, pub / "music.mp3")
        (pub / "music.txt").write_text(music, encoding="utf-8")
    except Exception as e:
        print("  музыка не скачалась, ролик без неё:", e)
        music = None
    vol = L.sfx_vol(pub / "voice.wav")
    st = [s["start"] for s in segs]
    if comp == "Scenario":
        sfx = [{"s": "pop", "at": round(st[i] + 0.4, 3), "v": vol["pop"]} for i, sh in enumerate(spec["shots"]) if sh.get("tag") or sh.get("icon")]
        hl = spec["hazard"]["line"]
        sfx.append({"s": "hit", "at": round(st[hl] + 0.1, 3), "v": min(1.0, vol["hit"] * 1.4)})
        sfx.append({"s": "ding", "at": round(st[-1] + 0.2, 3), "v": vol["ding"]})
        props = {"id": vid, "total": total, "segments": segs, "words": words, "spec": spec, "music": f"auto/{vid}/music.mp3" if music else None, "sfx": sfx}
    else:
        bg_id = L.pick_bg(bg, total + 0.5, pub / "bg.mp4")
        (pub / "bg.json").write_text(json.dumps({"id": bg_id, "seconds": total + 0.5}), encoding="utf-8")
        sfx = [{"s": "pop", "at": round(st[i] + 0.3, 3), "v": vol["pop"]} for i, s in enumerate(scenes) if s.get("type") != "none"]
        sfx.append({"s": "ding", "at": round(segs[-1]["end"] + 0.3, 3), "v": vol["ding"]})
        props = {"id": vid, "tag": tag, "cta": "MORE TRUE STORIES LIKE THIS", "ctaSmall": "follow", "ctaWhere": "new story every day",
                 "accent": accent, "lang": "en", "total": total, "segments": segs, "words": words, "scenes": scenes,
                 "music": f"auto/{vid}/music.mp3" if music else None, "sfx": sfx}
    pf = pub / "props.json"
    pf.write_text(json.dumps(props, ensure_ascii=False), encoding="utf-8")
    L.OUT.mkdir(parents=True, exist_ok=True)
    out = L.OUT / f"{vid}.mp4"
    L.render(comp, pf, out)
    archive(vid, pub)
    print(f"[{vid}] {total:.1f} с")
    return out, music


def redo(topic_id, q):
    """Переделать обе серии темы (часть 1 и 2) заново - на те же даты в очереди."""
    idx = next(i for i, t in enumerate(SURV) if t["id"] == topic_id)
    tmp = {"topic": idx, "part": 1, "story": 0}
    for part in (1, 2):
        item = build_morning(tmp)
        old = next((x for x in q if x["id"] == item["id"]), None)
        if os.environ.get("TELEGRAM_BOT_TOKEN"):
            item["tg_video"] = L.upload_video(item["file"], _admin_chat())
            item.pop("file")
        if old:
            item["date"], item["slot"] = old["date"], old["slot"]
            q[q.index(old)] = item
        else:
            item["date"] = next_date(q, "morning").isoformat()
            q.append(item)
        save_queue(q)
        print(f"  переделано: {item['date']} {item['id']} - {item['title']}")


def main():
    L.load_env()
    q, state = load_queue(), load_state()
    if os.environ.get("EN_REDO"):
        for tid in os.environ["EN_REDO"].split():
            redo(tid, q)
        return
    one = sys.argv[sys.argv.index("--one") + 1] if "--one" in sys.argv else None
    built, failed = 0, set()
    while built < (1 if one else MAX_PER_RUN):
        horizon = (dt.date.today() + dt.timedelta(days=DAYS_AHEAD)).isoformat()
        slots = [s for s in ("morning", "evening") if s not in failed]
        if not slots:
            break
        slot = one or min(slots, key=lambda s: next_date(q, s))
        d = next_date(q, slot)
        if not one and d.isoformat() > horizon:
            print("очередь заполнена на", DAYS_AHEAD, "дней")
            break
        try:
            item = build_morning(state) if slot == "morning" else build_evening(state)
        except L.VoiceLimit as e:
            print(" ", e, "- остальное соберу завтра")
            break
        except Exception as e:  # один неудачный ролик не роняет всю сборку - второй слот собирается дальше
            print(f"  {slot}: не собрался ({type(e).__name__}: {e}) - повторю в следующий запуск")
            failed.add(slot)
            if one:
                break
            continue
        if os.environ.get("TELEGRAM_BOT_TOKEN"):
            item["tg_video"] = L.upload_video(item["file"], _admin_chat())
        item["date"] = d.isoformat()
        item.pop("file") if os.environ.get("TELEGRAM_BOT_TOKEN") else None
        q.append(item)
        save_queue(q)
        save_state(state)
        built += 1
        print(f"  в очередь: {item['date']} {slot} - {item['title']}")
    print("собрано:", built)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
