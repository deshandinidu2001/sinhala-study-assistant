"""Conservative auto-detection and editable offline Singlish transliteration.

Singlish has no single spelling standard. Common aliases improve study queries;
the phonetic fallback is an approximation, not a language translation model.
"""
import re
import unicodedata
from difflib import SequenceMatcher
from functools import lru_cache

ALIASES = {
    "mnd": "මොනවාද", "mnwd": "මොනවාද", "monada": "මොනවාද",
    "mnda": "මොනවාද", "mokda": "මොකක්ද", "mokakdha": "මොකක්ද",
    "karaya": "කාර්යය", "karyan": "කාර්යයන්", "karyayan": "කාර්යයන්",
    "karya": "කාර්යය", "karyaya": "කාර්යය", "karyayanaya": "කාර්යයන්",
    "rudira": "රුධිර", "rudhira": "රුධිර", "rudhiraya": "රුධිරය",
    "patakaye": "පටකයේ", "pathakaye": "පටකයේ", "patakaya": "පටකය",
    "mkd": "මොකක්ද", "mokakda": "මොකක්ද", "mokadda": "මොකක්ද",
    "mokkda": "මොකක්ද", "monawada": "මොනවාද", "monvada": "මොනවාද",
    "kiyanne": "කියන්නේ", "kiyanna": "කියන්න", "kiyana": "කියන",
    "kiyala": "කියලා", "yanu": "යනු", "kumakda": "කුමක්ද",
    "kohomada": "කොහොමද", "kohomadha": "කොහොමද", "keseda": "කෙසේද",
    "ai": "ඇයි", "ayi": "ඇයි", "pahadili": "පැහැදිලි", "karanna": "කරන්න",
    "denna": "දෙන්න", "gana": "ගැන", "saha": "සහ", "ha": "හා",
    "jiwa": "ජීව", "jeewa": "ජීව", "jiiwa": "ජීව", "jiva": "ජීව",
    "pataka": "පටක", "pathaka": "පටක", "shaka": "ශාක", "shaaka": "ශාක",
    "shakawala": "ශාකවල", "saila": "සෛල", "sela": "සෛල",
    "sailaya": "සෛලය", "sailayak": "සෛලයක්", "sailaye": "සෛලයේ",
    "harithaprada": "හරිතප්‍රද", "harithapradha": "හරිතප්‍රද",
    "prabhasansleshanaya": "ප්‍රභාසංස්ලේෂණය", "prabhasanshleshanaya": "ප්‍රභාසංස්ලේෂණය",
    "prabhasanshleshanayedi": "ප්‍රභාසංස්ලේෂණයේදී",
    "jalaya": "ජලය", "alokaya": "ආලෝකය",
    "suryalokaya": "සූර්යාලෝකය", "sooryalokaya": "සූර්යාලෝකය",
    "ahara": "ආහාර", "aahara": "ආහාර", "mul": "මූල", "mula": "මූල",
    "padum": "පාඩම්", "padama": "පාඩම", "ganithaya": "ගණිතය",
    "vidyawa": "විද්‍යාව", "ithihasaya": "ඉතිහාසය",
    "wenasa": "වෙනස", "athara": "අතර", "thiyenne": "තියෙන්නේ",
    "thiyena": "තියෙන", "karanne": "කරන්නේ", "wenne": "වෙන්නේ",
}
CONSONANTS = {
    "nng": "ඟ", "ndh": "ඳ", "nd": "ඳ", "mb": "ඹ", "ng": "ංග",
    "ch": "ච", "sh": "ශ", "th": "ත", "dh": "ද", "kh": "ඛ", "gh": "ඝ",
    "ph": "ඵ", "bh": "භ", "gn": "ඥ", "k": "ක", "g": "ග", "j": "ජ",
    "t": "ට", "d": "ඩ", "n": "න", "p": "ප", "b": "බ", "m": "ම",
    "y": "ය", "r": "ර", "l": "ල", "v": "ව", "w": "ව", "s": "ස",
    "h": "හ", "f": "ෆ", "c": "ක", "q": "ක", "z": "ස",
}
VOWELS = {
    "aa": ("ආ", "ා"), "ae": ("ඇ", "ැ"), "ee": ("ඊ", "ී"),
    "ii": ("ඊ", "ී"), "uu": ("ඌ", "ූ"), "oo": ("ඌ", "ූ"),
    "ai": ("ඓ", "ෛ"), "au": ("ඖ", "ෞ"), "ei": ("ඒ", "ේ"),
    "a": ("අ", ""), "e": ("එ", "ෙ"), "i": ("ඉ", "ි"),
    "u": ("උ", "ු"), "o": ("ඔ", "ො"),
}


def _word(token: str) -> str:
    lower = token.lower()
    if lower in ALIASES:
        return ALIASES[lower]
    result = ""
    index = 0
    while index < len(lower):
        consonant = next((key for key in CONSONANTS if lower.startswith(key, index)), None)
        if consonant:
            result += CONSONANTS[consonant]
            index += len(consonant)
            vowel = next((key for key in VOWELS if lower.startswith(key, index)), None)
            result += VOWELS[vowel][1] if vowel else "්"
            index += len(vowel) if vowel else 0
        else:
            vowel = next((key for key in VOWELS if lower.startswith(key, index)), None)
            result += VOWELS[vowel][0] if vowel else lower[index]
            index += len(vowel) if vowel else 1
    return result



# Romanize source vocabulary rather than guessing every consonant from Latin.
LETTERS = dict(zip("කඛගඝඞඟචඡජඣඤඥඦටඨඩඪණඬතථදධනඳපඵබභමඹයරලවශෂසහළෆ", "k kh g gh ng ng ch ch j j ny gn j t th d dh n nd th th d dh n nd p ph b bh m mb y r l w sh sh s h l f".split()))
INDEPENDENT = dict(zip("අආඇඈඉඊඋඌඍඎඑඒඓඔඕඖ", "a aa ae ae i ii u uu ru ru e ee ai o oo au".split()))
SIGNS = dict(zip("ාැෑිීුූෘෲෙේෛොෝෞ", "aa ae ae i ii u uu ru ru e ee ai o oo au".split()))


@lru_cache(maxsize=20000)
def romanize(word: str) -> str:
    result = ""
    for char in unicodedata.normalize("NFC", word).replace("\u200d", ""):
        if char in LETTERS:
            result += LETTERS[char] + "a"
        elif char in SIGNS:
            result = result[:-1] + SIGNS[char] if result.endswith("a") else result + SIGNS[char]
        elif char == "්":
            if result.endswith("a"):
                result = result[:-1]
        elif char in INDEPENDENT:
            result += INDEPENDENT[char]
        elif char in "ංඃ":
            result += "n" if char == "ං" else "h"
        elif char.isascii():
            result += char.lower()
    return result


def phonetic(value: str) -> str:
    value = value.lower().replace("v", "w")
    for source, replacement in [("dh", "d"), ("th", "t"), ("sh", "s"), ("ph", "p"), ("kh", "k"), ("bh", "b"), ("gh", "g"), ("ee", "i"), ("oo", "u")]:
        value = value.replace(source, replacement)
    return re.sub(r"(.)\1+", r"\1", value)


def source_spellings(vocabulary) -> dict[str, str]:
    # Sorted iteration makes ties stable. Avoid changing numbers or English terms.
    result = {}
    for word in sorted(set(vocabulary)):
        if re.search(r"[\u0d80-\u0dff]", word):
            key = phonetic(romanize(word))
            if len(key) >= 3:
                result.setdefault(key, word)
    return result


def _source_word(token: str, spellings: dict[str, str]) -> str | None:
    key = phonetic(token)
    if key in spellings:
        return spellings[key]
    if len(key) < 4:
        return None
    ranked = []
    for candidate, word in spellings.items():
        if abs(len(key) - len(candidate)) > max(3, len(key) // 3):
            continue
        score = SequenceMatcher(None, key, candidate, autojunk=False).ratio()
        if score >= 0.8 and key[:1] == candidate[:1]:
            ranked.append((score, candidate, word))
    ranked.sort(reverse=True)
    # Ambiguous near-matches are left for phonetic input or the editable preview.
    if ranked and (len(ranked) == 1 or ranked[0][0] - ranked[1][0] >= 0.06):
        return ranked[0][2]
    return None


def normalize_question(question: str, language: str = "auto", vocabulary=()) -> tuple[str, str]:
    tokens = re.findall(r"[A-Za-z]+", question)
    spellings = source_spellings(vocabulary)
    signals = [t for t in tokens if t.lower() in ALIASES and t.lower() not in {"ai", "ha", "mul", "gana", "saha"}]
    known = sum(phonetic(token) in spellings for token in tokens if len(token) >= 4)
    # Ordinary English questions stay English even when one term resembles Sinhala.
    english = bool(re.match(r"(?:what|why|how|when|where|explain|describe|define|which|who)\b", question, re.I))
    singlish = language == "singlish" or (language == "auto" and not english and (bool(signals) or known >= 2))
    if not singlish:
        return question, "original"
    def convert(match):
        token = match.group()
        if token.lower() in ALIASES:
            return ALIASES[token.lower()]
        return _source_word(token, spellings) or _word(token)
    converted = re.sub(r"[A-Za-z]+", convert, question)
    return unicodedata.normalize("NFC", converted), "offline"
