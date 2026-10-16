"""Hard limits for the AI tutor: dangerous topics and injection phrases are rejected before any API call."""
from __future__ import annotations

import re
import unicodedata

REFUSAL = "Я отвечаю только на вопросы по материалу этого урока."

OFFTOPIC_MARKER = "OFFTOPIC"

# Stems are matched inside words, so "ядерного", "ядерная" and "ядерку" all hit "ядерн".
_BLOCKED_STEMS = [
    # weapons, explosives, CBRN
    "ядерн", "атомн бомб", "боеголов", "термоядерн", "радиологическ", "грязн бомб",
    "взрывчат", "взрывн", "взорв", "тротил", "гексоген", "нитроглицерин", "детонатор",
    "бомб", "оружи", "огнестрел", "автомат калашников", "снайперск",
    "химическ оружи", "биологическ оружи", "отравляющ", "нервно паралитическ", "зарин", "зоман",
    "иприт", "боевые вирусы", "спор сибирск",
    # drugs
    "наркот", "амфетамин", "героин", "кокаин", "мефедрон", "лсд", "синтез психоактивн",
    # harm
    "как убить", "как отравить", "как взорвать", "как украсть", "как взломать чуж",
    # English
    "nuclear", "warhead", "explosive", "bomb", "bioweapon", "nerve agent", "chemical weapon",
    "methamphetamine", "how to kill", "how to poison", "synthesize drug",
    # prompt injection
    "игнорируй предыдущ", "игнорируй все инструкц", "забудь инструкц", "забудь предыдущ",
    "системный промпт", "системная инструкц", "твои инструкции", "режим разработчика",
    "ignore previous", "ignore all previous", "ignore the above", "system prompt", "jailbreak",
    "developer mode", "dan mode", "you are now",
]

_ZERO_WIDTH = dict.fromkeys(map(ord, "​‌‍⁠﻿­"), None)
_LEET = str.maketrans({"0": "о", "3": "з", "4": "а", "@": "а", "$": "с", "1": "и", "!": "и"})


def _normalize(text: str) -> str:
    text = unicodedata.normalize("NFKC", text).translate(_ZERO_WIDTH).lower().replace("ё", "е")
    # Collapse separators so "я.д.е.р.н" and "я д е р н" cannot slip past the stems.
    letters = re.sub(r"[^a-zа-я0-9@$! ]+", " ", text)
    return re.sub(r"\s+", " ", letters).strip()


def _squash(text: str) -> str:
    return re.sub(r"[^a-zа-я]+", "", text)


def is_blocked(text: str | None) -> bool:
    """True if a student's free-text question hits the hard stop list."""
    if not text:
        return False
    normalized = _normalize(text)
    variants = {normalized, _normalize(normalized.translate(_LEET))}
    squashed = {_squash(v) for v in variants}
    for stem in _BLOCKED_STEMS:
        plain = _normalize(stem)
        if len(plain) <= 4:
            # Short stems only count at the start of a word ("бомб", "лсд"), so code words do not trip them.
            if any(re.search("(?<![a-zа-я0-9])" + re.escape(plain), v) for v in variants):
                return True
            continue
        if any(plain in v for v in variants):
            return True
        # Letters split with dots or spaces ("я д е р н о е") still hit longer stems.
        glued = _squash(plain)
        if len(glued) >= 6 and any(glued in s for s in squashed):
            return True
    return False


def is_off_topic_answer(answer: str) -> bool:
    """The model is told to answer with the marker alone when the question is not about the lesson."""
    return OFFTOPIC_MARKER in answer.strip().upper()[:40]
