"""Conservative auto-detection and editable offline Singlish transliteration.

Singlish has no single spelling standard. Common aliases improve study queries;
the phonetic fallback is an approximation, not a language translation model.
"""
import re
import unicodedata

ALIASES = {
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
    "jalaya": "ජලය", "alokay a": "ආලෝකය", "alokaya": "ආලෝකය",
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


def normalize_question(question: str, language: str = "auto") -> tuple[str, str]:
    tokens = re.findall(r"[A-Za-z]+", question)
    singlish = language == "singlish" or (language == "auto" and any(t.lower() in ALIASES for t in tokens))
    if not singlish:
        return question, "original"
    converted = re.sub(r"[A-Za-z]+", lambda match: _word(match.group()), question)
    return unicodedata.normalize("NFC", converted), "offline"
