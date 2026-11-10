"""Resolve provider quotations to actual, bounded source spans."""
import re
from difflib import SequenceMatcher
from backend.study import normalize


def compact(value: str) -> str:
    return re.sub(r"\s+", " ", normalize(value)).casefold()


def resolve_evidence(quote_value: str, sources: list[dict]) -> tuple[int, str] | None:
    quote = compact(quote_value)
    best = None
    for source in sources:
        text = re.sub(r"\s+", " ", normalize(source["text"]))
        folded = text.casefold()
        if quote in folded:
            start = folded.index(quote)
            best = (len(quote), source["number"], text[start:start + len(quote)])
            break
        matcher = SequenceMatcher(None, quote, folded, autojunk=False)
        block = matcher.find_longest_match()
        pieces = [piece for piece in matcher.get_matching_blocks() if piece.size >= 8]
        if pieces and max(piece.size for piece in pieces) >= 20 and sum(piece.size for piece in pieces) >= max(35, len(quote) * 0.75):
            start, end = min(piece.b for piece in pieces), max(piece.b + piece.size for piece in pieces)
            if 25 <= end - start <= 500:
                while start > 0 and not text[start - 1].isspace():
                    start -= 1
                while end < len(text) and not text[end].isspace():
                    end += 1
                if end - start <= 500 and (best is None or sum(piece.size for piece in pieces) > best[0]):
                    best = (sum(piece.size for piece in pieces), source["number"], text[start:end])
        if block.size >= max(60, len(quote) * 0.55) and (best is None or block.size > best[0]):
            start, end = block.b, block.b + block.size
            while start > 0 and not text[start - 1].isspace():
                start -= 1
            while end < len(text) and not text[end].isspace():
                end += 1
            best = (block.size, source["number"], text[start:end])
    return (best[1], best[2]) if best else None
