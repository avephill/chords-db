#!/usr/bin/env python
"""
Banjo A chord helpers: (1) default mode fetches Jina markdown and maps frets→chart URL;
(2) --from-source-comments uses only each position's // sourceChart PNG for OpenCV
finger/barre extraction (no non-PNG fingering inference).
"""
import math
import pickle
import random
import re
import sys
from itertools import combinations, islice, permutations
import time
import urllib.parse
import urllib.request
from pathlib import Path

import cv2
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
CHORDS_DIR = ROOT / "src" / "db" / "banjo-open-g" / "chords" / "A"


def stem_to_suffix(stem: str) -> str:
    if stem == "major":
        return "major"
    if stem == "minor":
        return "minor"
    if stem.startswith("_"):
        return "/" + stem[1:]
    return stem


def suffix_to_path(key: str, suffix: str) -> str:
    if suffix == "major":
        return key
    if suffix == "minor":
        return f"{key}m"
    if suffix.startswith("/"):
        return f"{key}/{suffix[1:]}"
    return f"{key}{suffix}"


def encode_path(path_like: str) -> str:
    return "/".join(urllib.parse.quote(seg, safe="") for seg in path_like.split("/"))


def fetch_text(url: str) -> str:
    last_err = None
    for attempt in range(1, 7):
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept-Language": "en-US,en;q=0.9",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=45) as res:
                return res.read().decode("utf-8", "ignore")
        except Exception as exc:
            last_err = exc
            time.sleep((0.7 * attempt) + random.uniform(0.1, 0.5))
    raise last_err


def fetch_bytes(url: str, referer: str) -> bytes:
    last_err = None
    for attempt in range(1, 6):
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
                "Referer": referer,
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=45) as res:
                return res.read()
        except Exception as exc:
            last_err = exc
            time.sleep((0.5 * attempt) + random.uniform(0.05, 0.25))
    raise last_err


def frets_space_to_db(spaced: str) -> str:
    out = []
    for t in spaced.strip().split():
        tl = t.lower()
        if tl == "x":
            out.append("x")
        else:
            out.append(format(int(tl), "x"))
    return "".join(out)


def parse_standard_charts(markdown: str) -> dict[str, str]:
    section = markdown
    cut = re.search(r"##\s+Horizontal Chord Charts", section, re.I)
    if cut:
        section = section[: cut.start()]

    charts = {}
    rx = re.compile(
        r"Fretboard image for the [^\n]*? chord on banjo frets:\s*([xX0-9 ]+)\]\((https?://[^)]+)\)",
        re.I,
    )
    for m in rx.finditer(section):
        db = frets_space_to_db(m.group(1))
        charts.setdefault(db, m.group(2))
    return charts


def build_digit_templates() -> dict[str, list[np.ndarray]]:
    out: dict[str, list[np.ndarray]] = {str(i): [] for i in range(1, 5)}
    fonts = [
        cv2.FONT_HERSHEY_SIMPLEX,
        cv2.FONT_HERSHEY_DUPLEX,
        cv2.FONT_HERSHEY_COMPLEX_SMALL,
    ]
    for d in range(1, 5):
        for font in fonts:
            img = np.zeros((24, 24), dtype=np.uint8)
            cv2.putText(img, str(d), (5, 19), font, 0.75, 255, 2, cv2.LINE_AA)
            out[str(d)].append(img)
            img2 = np.zeros((24, 24), dtype=np.uint8)
            cv2.putText(img2, str(d), (6, 18), font, 0.7, 255, 1, cv2.LINE_AA)
            out[str(d)].append(img2)
    return out


DIGIT_TEMPLATES = build_digit_templates()

# Scales-Chords PNG digits rarely match Hershey templates perfectly; keep low to avoid false negatives.
DIGIT_MATCH_THRESHOLD = 0.12

# Learned from labeled src/db/banjo-open-g/chords/A/7#9.js (lazy-filled).
_SITE_DIGIT_TEMPLATES: dict[str, list[np.ndarray]] | None = None

REFERENCE_FINGERINGS_7S9 = (
    ROOT / "src" / "db" / "banjo-open-g" / "chords" / "A" / "7#9.js"
)
# Written by `python scripts/calibrate-banjo-digit-templates.py` (or first successful build).
DIGIT_PROTO_CACHE = ROOT / "scripts" / "banjo_sc_digit_prototypes.pkl"


def normalize_chart_url(url: str) -> str:
    u = url.strip()
    if u.startswith("http://"):
        return "https://" + u[len("http://") :]
    return u


def page_url_for_banjo_a_file(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    m = re.search(r"//\s*sourcePage:\s*(\S+)", text)
    if m:
        return m.group(1).rstrip("/")
    stem = path.stem
    suffix = stem_to_suffix(stem)
    chord_path = suffix_to_path("A", suffix)
    return f"https://www.scales-chords.com/chord/banjo/{encode_path(chord_path)}"


def _best_digit_match(
    canvas: np.ndarray, tmpls: dict[str, list[np.ndarray]] | None = None
) -> tuple[str | None, float]:
    src = tmpls if tmpls is not None else active_digit_templates()
    best_d: str | None = None
    best = -1.0
    for d, tlist in src.items():
        for t in tlist:
            if t.shape[:2] != canvas.shape[:2]:
                continue
            s = cv2.matchTemplate(canvas, t, cv2.TM_CCOEFF_NORMED)[0][0]
            if s > best:
                best = float(s)
                best_d = d
    return best_d, best


def active_digit_templates() -> dict[str, list[np.ndarray]]:
    """Hershey fallbacks plus site-specific prototypes learned from A 7#9 reference fingerings."""
    global _SITE_DIGIT_TEMPLATES
    if _SITE_DIGIT_TEMPLATES is None:
        if DIGIT_PROTO_CACHE.is_file():
            try:
                with DIGIT_PROTO_CACHE.open("rb") as fh:
                    _SITE_DIGIT_TEMPLATES = pickle.load(fh)
            except Exception:
                _SITE_DIGIT_TEMPLATES = {}
        if _SITE_DIGIT_TEMPLATES is None or _SITE_DIGIT_TEMPLATES == {}:
            try:
                _SITE_DIGIT_TEMPLATES = build_site_digit_templates_from_reference()
                if _SITE_DIGIT_TEMPLATES:
                    with DIGIT_PROTO_CACHE.open("wb") as fh:
                        pickle.dump(_SITE_DIGIT_TEMPLATES, fh)
            except Exception:
                _SITE_DIGIT_TEMPLATES = {}
    out: dict[str, list[np.ndarray]] = {}
    for d in ("1", "2", "3", "4"):
        site = _SITE_DIGIT_TEMPLATES.get(d, []) if _SITE_DIGIT_TEMPLATES else []
        # Cap learned prototypes (matching is O(n) per digit class).
        out[d] = list(site[:10]) + list(DIGIT_TEMPLATES[d])
    return out


def parse_reference_labeled_positions(
    js_text: str,
) -> list[tuple[str, str, str, int | None]]:
    """(sourceChart url, frets, fingers, barres fret or None)."""
    text = js_text.replace("\r\n", "\n")
    out: list[tuple[str, str, str, int | None]] = []
    block_rx = re.compile(
        r"//\s*sourceChart:\s*(\S+)\s*\n\s*frets:\s*'([^']+)',(?:\s*\n\s*fingers:\s*'([^']+)',)?(?:\s*\n\s*barres:\s*(\d+),)?",
        re.MULTILINE,
    )
    for m in block_rx.finditer(text):
        url = normalize_chart_url(m.group(1))
        frets = m.group(2)
        fingers = m.group(3) or ""
        bar = int(m.group(4)) if m.group(4) else None
        if fingers:
            out.append((url, frets, fingers, bar))
    return out


def _extract_finger_blobs_from_image(img: np.ndarray) -> list[tuple[float, float, int, int, int, int]]:
    """White finger-number blobs; slightly looser bounds for high-fret / zoomed charts."""
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    white = cv2.inRange(hsv, np.array([0, 0, 180], np.uint8), np.array([180, 60, 255], np.uint8))
    white = cv2.medianBlur(white, 3)
    contours, _ = cv2.findContours(white, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    circles: list[tuple[float, float, int, int, int, int]] = []
    for c in contours:
        area = cv2.contourArea(c)
        if area < 45 or area > 1400:
            continue
        peri = cv2.arcLength(c, True)
        if peri <= 0:
            continue
        circularity = 4.0 * np.pi * area / (peri * peri)
        x, y, w, h = cv2.boundingRect(c)
        if w < 8 or h < 8 or w > 30 or h > 30:
            continue
        if circularity < 0.42:
            continue
        cx = x + (w / 2.0)
        cy = y + (h / 2.0)
        circles.append((cx, cy, x, y, w, h))

    circles.sort(key=lambda t: (t[4] * t[5]), reverse=True)
    dedup: list[tuple[float, float, int, int, int, int]] = []
    for item in circles:
        cx, cy = item[0], item[1]
        if any(((cx - d[0]) ** 2 + (cy - d[1]) ** 2) < 85 for d in dedup):
            continue
        dedup.append(item)
    return dedup


def _score_assignment_perm(
    img: np.ndarray,
    circles: list[tuple[float, float, int, int, int, int]],
    played: list[int],
    fingers_truth: str,
    perm: tuple[int, ...],
    tmpls: dict[str, list[np.ndarray]],
) -> float:
    """Sum of template scores: blob j (left→right) → string played[perm[j]]."""
    n = len(played)
    s_list = sorted(circles, key=lambda t: t[0])
    total = 0.0
    for j in range(n):
        si = played[perm[j]]
        exp = fingers_truth[si]
        if exp == "0":
            continue
        _cx, _cy, x, y, w, h = s_list[j]
        roi = img[y : y + h, x : x + w]
        if roi.size == 0:
            return -1.0
        gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
        best_s = -1.0
        for canvas in _digit_canvases_from_roi(gray):
            _, s = _best_digit_match(canvas, tmpls)
            if s > best_s:
                best_s = s
        exp_t = tmpls.get(exp, [])
        if exp_t:
            for canvas in _digit_canvases_from_roi(gray):
                for t in exp_t:
                    if t.shape[:2] == canvas.shape[:2]:
                        s = cv2.matchTemplate(canvas, t, cv2.TM_CCOEFF_NORMED)[0][0]
                        if s > best_s:
                            best_s = s
        total += best_s
    return total


def build_site_digit_templates_from_reference() -> dict[str, list[np.ndarray]]:
    """
    Crop digit bitmaps from 7#9.js labeled PNGs; build one mean 24x24 template per digit 1–4.
    """
    if not REFERENCE_FINGERINGS_7S9.is_file():
        return {}
    text = REFERENCE_FINGERINGS_7S9.read_text(encoding="utf-8")
    samples: dict[str, list[np.ndarray]] = {str(i): [] for i in range(1, 5)}
    page_url = page_url_for_banjo_a_file(REFERENCE_FINGERINGS_7S9)

    labeled = parse_reference_labeled_positions(text)
    if not labeled:
        return {}

    for img_url, frets, fingers, _bar in labeled:
        try:
            img_bytes = fetch_bytes(img_url, page_url)
            dec = cv2.imdecode(np.frombuffer(img_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
            if dec is None:
                continue
            if dec.ndim == 2:
                bgr = cv2.cvtColor(dec, cv2.COLOR_GRAY2BGR)
            elif dec.shape[2] == 4:
                bgr = cv2.cvtColor(dec, cv2.COLOR_BGRA2BGR)
            else:
                bgr = dec
        except Exception:
            continue

        merged = _extract_finger_blobs_from_image(bgr)
        played = sorted(
            i for i, ch in enumerate(frets) if ch != "x" and int(ch, 16) > 0
        )
        n = len(played)
        if n == 0 or len(merged) < n:
            continue

        w_img = bgr.shape[1]
        if len(merged) == n:
            subsets = [merged]
        else:
            picked = _pick_circles_for_strings(merged, n, w_img, bgr)
            if picked is None:
                continue
            subsets = [picked]

        best_sub = None
        best_perm: tuple[int, ...] | None = None
        best_score = -1.0
        for sub in subsets:
            # Full perm search is slow; identity + reverse usually suffices for training crops.
            perms: list[tuple[int, ...]] = [tuple(range(n)), tuple(range(n - 1, -1, -1))]
            if n <= 4:
                perms = list(permutations(range(n)))
            for perm in perms:
                sc = _score_assignment_perm(bgr, sub, played, fingers, perm, DIGIT_TEMPLATES)
                if sc > best_score:
                    best_score = sc
                    best_sub = sub
                    best_perm = tuple(perm)

        if best_sub is None or best_perm is None:
            continue
        s_list = sorted(best_sub, key=lambda t: t[0])
        for j in range(n):
            si = played[best_perm[j]]
            d = fingers[si]
            if d not in "1234":
                continue
            _a, _b, x, y, w, h = s_list[j]
            roi = bgr[y : y + h, x : x + w]
            gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
            best_canvas = None
            best_v = -1.0
            for canvas in _digit_canvases_from_roi(gray):
                if np.mean(canvas) < 5:
                    continue
                v = float(np.clip(np.mean(canvas), 0, 255))
                if v > best_v:
                    best_v = v
                    best_canvas = canvas.copy()
            if best_canvas is not None:
                samples[d].append(best_canvas.astype(np.uint8))

    out: dict[str, list[np.ndarray]] = {}
    for d in ("1", "2", "3", "4"):
        if not samples[d]:
            continue
        out[d] = samples[d][:10]
    return out


def _center_crop(gray: np.ndarray, frac: float = 0.78) -> np.ndarray:
    """Ignore fret lines at ROI edges (common in Scales-Chords charts)."""
    h, w = gray.shape[:2]
    if h < 8 or w < 8:
        return gray
    margin_y = max(1, int(h * (1.0 - frac) / 2))
    margin_x = max(1, int(w * (1.0 - frac) / 2))
    return gray[margin_y : h - margin_y, margin_x : w - margin_x]


def _digit_canvases_from_roi(gray: np.ndarray) -> list[np.ndarray]:
    """Several binarizations; site artwork varies."""
    grays = [gray, _center_crop(gray)]
    out_bin: list[np.ndarray] = []
    for g in grays:
        _, inv = cv2.threshold(g, 120, 255, cv2.THRESH_BINARY_INV)
        out_bin.append(cv2.medianBlur(inv, 3))
        if np.max(g) > np.min(g):
            _, otsu = cv2.threshold(g, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
            out_bin.append(cv2.medianBlur(otsu, 3))
        ad = cv2.adaptiveThreshold(
            g, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2
        )
        out_bin.append(cv2.medianBlur(ad, 3))
    return [cv2.resize(x, (24, 24), interpolation=cv2.INTER_AREA) for x in out_bin]


def detect_barre(img: np.ndarray) -> tuple[bool, bool]:
    """Wide gray horizontal bar (capo / barre line), tuned vs. fret wire noise."""
    h, w = img.shape[:2]
    mask = cv2.inRange(img, np.array([40, 40, 40], np.uint8), np.array([145, 145, 145], np.uint8))
    kernel = np.ones((3, 7), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    best = None
    for c in contours:
        x, y, cw, ch = cv2.boundingRect(c)
        area = cw * ch
        if cw < int(w * 0.38):
            continue
        # Real barre/capo bars are thin; thick boxes are fretboard chrome.
        if ch < 10 or ch > int(h * 0.22):
            continue
        if cw / max(ch, 1) < 2.8:
            continue
        if best is None or area > best[0]:
            best = (area, x, y, cw, ch)

    if best is None:
        return False, False
    _, _, _, bw, _ = best
    full_width = bw >= int(w * 0.72)
    return True, full_width


def _merge_close_circles_x(
    circles: list[tuple[float, float, int, int, int, int]], gap_px: float = 9.0
) -> list[tuple[float, float, int, int, int, int]]:
    """Merge blobs that share the same string column (duplicate detections)."""
    circles = sorted(circles, key=lambda t: t[0])
    merged: list[tuple[float, float, int, int, int, int]] = []
    for c in circles:
        if merged and abs(c[0] - merged[-1][0]) < gap_px:
            if c[4] * c[5] > merged[-1][4] * merged[-1][5]:
                merged[-1] = c
        else:
            merged.append(c)
    return merged


def _digit_confidence_for_circle(
    img: np.ndarray, circle: tuple[float, float, int, int, int, int]
) -> float:
    _, _, x, y, w, h = circle
    roi = img[y : y + h, x : x + w]
    if roi.size == 0:
        return -1.0
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    best = -1.0
    tmpls = active_digit_templates()
    for canvas in _digit_canvases_from_roi(gray):
        _, s = _best_digit_match(canvas, tmpls)
        if s > best:
            best = s
    return best


def _pick_circles_for_strings(
    circles: list[tuple[float, float, int, int, int, int]],
    n_needed: int,
    img_w: int,
    img: np.ndarray | None = None,
) -> list[tuple[float, float, int, int, int, int]] | None:
    """
    Charts often include extra white blobs (legend, barre artifacts). Prefer subsets
    whose digit templates all match well when img is provided; else use x-spacing.
    """
    if len(circles) < n_needed:
        return None
    if len(circles) == n_needed:
        return sorted(circles, key=lambda t: t[0])

    merged = _merge_close_circles_x(circles)

    if img is not None and len(merged) <= 12 and n_needed <= 6:
        best_sub: list[tuple[float, float, int, int, int, int]] | None = None
        best_min_conf = -1.0
        for idxs in combinations(range(len(merged)), n_needed):
            sub = [merged[i] for i in idxs]
            sub_sorted = sorted(sub, key=lambda t: t[0])
            confs = [_digit_confidence_for_circle(img, c) for c in sub_sorted]
            mn = min(confs) if confs else -1.0
            if mn > best_min_conf:
                best_min_conf = mn
                best_sub = sub_sorted
        if best_sub is not None and best_min_conf >= DIGIT_MATCH_THRESHOLD:
            return best_sub

    min_gap = max(12.0, float(img_w) / 70.0)
    xsorted = sorted(merged, key=lambda t: t[0])
    picked: list[tuple[float, float, int, int, int, int]] = []
    for c in xsorted:
        if not picked or c[0] - picked[-1][0] > min_gap:
            picked.append(c)
        if len(picked) == n_needed:
            break
    if len(picked) == n_needed:
        return picked

    if len(xsorted) <= 9 and n_needed <= 5:
        best: tuple[float, list] | None = None
        for idxs in combinations(range(len(xsorted)), n_needed):
            pts = [xsorted[i][0] for i in idxs]
            spread = min(pts[i + 1] - pts[i] for i in range(len(pts) - 1))
            if best is None or spread > best[0]:
                best = (spread, [xsorted[i] for i in idxs])
        if best and best[0] >= 8.0:
            return sorted(best[1], key=lambda t: t[0])
    return None


def _classify_digit_roi(
    gray: np.ndarray, tmpls: dict[str, list[np.ndarray]]
) -> tuple[str | None, float]:
    best_d: str | None = None
    best = -1.0
    for canvas in _digit_canvases_from_roi(gray):
        d, s = _best_digit_match(canvas, tmpls)
        if s > best:
            best = s
            best_d = d
    return best_d, best


def detect_fingers_from_image(img: np.ndarray, frets: str) -> tuple[str | None, float]:
    """
    Match site + Hershey templates; one blob subset + string order search.
    """
    tmpls = active_digit_templates()
    merged = _extract_finger_blobs_from_image(img)
    played = sorted(i for i, ch in enumerate(frets) if ch != "x" and int(ch, 16) > 0)
    n = len(played)
    if n == 0 or len(merged) < n:
        return None, 0.0

    w_img = img.shape[1]
    if len(merged) == n:
        subsets = [merged]
    else:
        picked = _pick_circles_for_strings(merged, n, w_img, img)
        if picked is None:
            return None, 0.0
        subsets = [picked]

    best_str: str | None = None
    best_min = -1.0
    if n <= 6:
        perms = list(permutations(range(n)))
        if len(perms) > 96:
            perms = list(islice(permutations(range(n)), 96))
    else:
        perms = [tuple(range(n)), tuple(range(n - 1, -1, -1))]
    for sub in subsets:
        s_list = sorted(sub, key=lambda t: t[0])
        for perm in perms:
            fingers: list[str] = ["0"] * len(frets)
            confs: list[float] = []
            bad = False
            for j in range(n):
                si = played[perm[j]]
                _cx, _cy, x, y, w, h = s_list[j]
                roi = img[y : y + h, x : x + w]
                if roi.size == 0:
                    bad = True
                    break
                gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
                d, s = _classify_digit_roi(gray, tmpls)
                if d is None or s < DIGIT_MATCH_THRESHOLD:
                    bad = True
                    break
                fingers[si] = d
                confs.append(s)
            if bad or not confs:
                continue
            mc = min(confs)
            if mc > best_min:
                best_min = mc
                best_str = "".join(fingers)
    if best_str is None:
        return None, 0.0
    return best_str, best_min


def min_positive_fret(db_frets: str) -> int | None:
    vals = []
    for ch in db_frets:
        if ch == "x":
            continue
        n = int(ch, 16)
        if n > 0:
            vals.append(n)
    return min(vals) if vals else None


def barre_fret_for_chart(frets: str) -> int | None:
    """Fret index for a barre when the diagram shows one (prefer duplicated fret values)."""
    from collections import Counter

    vals = [int(ch, 16) for ch in frets if ch != "x"]
    if not vals:
        return None
    c = Counter(vals)
    dups = [v for v, n in c.items() if n >= 2]
    if dups:
        return min(dups)
    return min_positive_fret(frets)


# Position blocks may include // sourceChart (and other // comments) before frets.
POSITION_BLOCK_RX = re.compile(
    r"\{\r?\n"
    r"(?P<head>(?:\s*//[^\n]*\r?\n)*?)"
    r"\s*frets:\s*'(?P<frets>[^']+)'(?:,)?"
    r"(?P<rest>(?:\r?\n\s+fingers:\s*'[^']+',)?(?:\r?\n\s+barres:\s*\d+,)?(?:\r?\n\s+capo:\s*true,)?)\r?\n\s+\}",
    re.MULTILINE,
)


def update_file_from_sourcechart_comments(
    path: Path, page_url: str, dry_run: bool = False
) -> tuple[int, int, int, int]:
    """
    Fingerings and barres come only from each position's // sourceChart PNG URL.
    Skips positions without sourceChart or when image extraction fails.
    Returns (added_fingers, added_barres, added_capo, skipped_positions).
    """
    raw = path.read_text(encoding="utf-8")
    text = raw.replace("\r\n", "\n")
    added_fingers = 0
    added_barres = 0
    added_capo = 0
    skipped = 0
    changed = False
    chunks: list[str] = []
    last = 0
    cache: dict[str, tuple[bool, bool, str | None, float]] = {}

    for m in POSITION_BLOCK_RX.finditer(text):
        chunks.append(text[last : m.start()])
        block = m.group(0)
        head = m.group("head")
        frets = m.group("frets")

        scm = re.search(r"//\s*sourceChart:\s*(\S+)", head)
        if not scm:
            chunks.append(block)
            last = m.end()
            skipped += 1
            continue

        img_url = normalize_chart_url(scm.group(1))
        if img_url not in cache:
            try:
                img_bytes = fetch_bytes(img_url, page_url)
                dec = cv2.imdecode(np.frombuffer(img_bytes, dtype=np.uint8), cv2.IMREAD_UNCHANGED)
                if dec is None:
                    cache[img_url] = (False, False, None, 0.0)
                else:
                    if dec.ndim == 2:
                        bgr = cv2.cvtColor(dec, cv2.COLOR_GRAY2BGR)
                    elif dec.shape[2] == 4:
                        bgr = cv2.cvtColor(dec, cv2.COLOR_BGRA2BGR)
                    else:
                        bgr = dec
                    has_barre, full_width = detect_barre(bgr)
                    fing, conf = detect_fingers_from_image(bgr, frets)
                    cache[img_url] = (has_barre, full_width, fing, conf)
            except Exception:
                cache[img_url] = (False, False, None, 0.0)

        has_barre, _full_width, extracted_fingers, _ = cache[img_url]
        if extracted_fingers is None:
            chunks.append(block)
            last = m.end()
            skipped += 1
            continue

        existing_barre_match = re.search(r"\n\s+barres:\s*(\d+),", block)
        existing_barre = int(existing_barre_match.group(1)) if existing_barre_match else None
        barres_fret = existing_barre
        if barres_fret is None and has_barre:
            barres_fret = barre_fret_for_chart(frets)

        # Do not emit capo: open-string detection via "0" in fret hex strings is unreliable.
        wants_capo = False

        existing_fingers_match = re.search(r"\n\s+fingers:\s*'([^']+)',", block)
        finger_str = existing_fingers_match.group(1) if existing_fingers_match else extracted_fingers

        before = block
        replacement = set_position_fields(block, finger_str, barres_fret, wants_capo)
        if "fingers:" in replacement and "fingers:" not in before:
            added_fingers += 1
        if "barres:" in replacement and "barres:" not in before:
            added_barres += 1
        if "capo: true" in replacement and "capo: true" not in before:
            added_capo += 1
        if replacement != before:
            changed = True

        chunks.append(replacement)
        last = m.end()

    chunks.append(text[last:])
    new_text = "".join(chunks)
    if changed and not dry_run:
        # Preserve CRLF if the file used it
        out = new_text.replace("\n", "\r\n") if "\r\n" in raw else new_text
        path.write_text(out, encoding="utf-8")
    return added_fingers, added_barres, added_capo, skipped


def set_position_fields(obj_body: str, fingers: str | None, barres: int | None, capo: bool) -> str:
    out = obj_body
    if fingers and "fingers:" not in out:
        out = out.replace("\n    }", f"\n      fingers: '{fingers}',\n    }}")
    if barres is not None and "barres:" not in out:
        out = out.replace("\n    }", f"\n      barres: {barres},\n    }}")
    if capo and "capo:" not in out:
        out = out.replace("\n    }", "\n      capo: true,\n    }")
    return out


def update_file(path: Path, charts: dict[str, str], page_url: str) -> tuple[int, int, int]:
    text = path.read_text(encoding="utf-8")
    pos_rx = re.compile(
        r"\{\n\s+frets:\s*'([^']+)',(?:\n\s+fingers:\s*'[^']+',)?(?:\n\s+barres:\s*\d+,)?(?:\n\s+capo:\s*true,)?\n\s+\}",
        re.M,
    )

    added_barres = 0
    added_capo = 0
    added_fingers = 0
    changed = False
    chunks = []
    last = 0
    cache: dict[str, tuple[bool, bool, str | None, float]] = {}

    for m in pos_rx.finditer(text):
        chunks.append(text[last : m.start()])
        block = m.group(0)
        frets = m.group(1)
        replacement = block
        img_url = charts.get(frets)
        if not img_url:
            chunks.append(replacement)
            last = m.end()
            continue

        if img_url not in cache:
            try:
                img_bytes = fetch_bytes(img_url, page_url)
                dec = cv2.imdecode(np.frombuffer(img_bytes, dtype=np.uint8), cv2.IMREAD_UNCHANGED)
                if dec is None:
                    cache[img_url] = (False, False, None, 0.0)
                else:
                    if dec.ndim == 2:
                        bgr = cv2.cvtColor(dec, cv2.COLOR_GRAY2BGR)
                    elif dec.shape[2] == 4:
                        bgr = cv2.cvtColor(dec, cv2.COLOR_BGRA2BGR)
                    else:
                        bgr = dec
                    has_barre, full_width = detect_barre(bgr)
                    fing, conf = detect_fingers_from_image(bgr, frets)
                    cache[img_url] = (has_barre, full_width, fing, conf)
            except Exception:
                cache[img_url] = (False, False, None, 0.0)

        has_barre, _full_width, extracted_fingers, _ = cache[img_url]
        # Strict policy: no image-read fingering means do not change this voicing.
        if extracted_fingers is None:
            chunks.append(replacement)
            last = m.end()
            continue

        existing_barre_match = re.search(r"\n\s+barres:\s*(\d+),", replacement)
        existing_barre = int(existing_barre_match.group(1)) if existing_barre_match else None
        barres_fret = existing_barre
        if barres_fret is None and has_barre:
            barres_fret = barre_fret_for_chart(frets)

        wants_capo = False

        existing_fingers_match = re.search(r"\n\s+fingers:\s*'([^']+)',", replacement)
        finger_str = existing_fingers_match.group(1) if existing_fingers_match else extracted_fingers

        before = replacement
        replacement = set_position_fields(replacement, finger_str, barres_fret, wants_capo)
        if "fingers:" in replacement and "fingers:" not in before:
            added_fingers += 1
        if "barres:" in replacement and "barres:" not in before:
            added_barres += 1
        if "capo: true" in replacement and "capo: true" not in before:
            added_capo += 1
        if replacement != before:
            changed = True

        chunks.append(replacement)
        last = m.end()

    chunks.append(text[last:])
    if changed:
        path.write_text("".join(chunks), encoding="utf-8")
    return added_fingers, added_barres, added_capo


def main() -> None:
    args = [a for a in sys.argv[1:] if a]
    dry_run = "--dry-run" in args
    args = [a for a in args if a != "--dry-run"]
    from_source = "--from-source-comments" in args
    args = [a for a in args if a != "--from-source-comments"]
    only = set(args) if args else None

    files = sorted([p for p in CHORDS_DIR.glob("*.js") if p.name != "index.js"])
    if only:
        files = [p for p in files if p.name in only or p.stem in only]

    if from_source:
        total_barres = 0
        total_capo = 0
        total_fingers = 0
        total_skipped = 0
        touched = 0
        mode = "dry-run " if dry_run else ""
        for path in files:
            page_url = page_url_for_banjo_a_file(path)
            f, a, c, sk = update_file_from_sourcechart_comments(path, page_url, dry_run=dry_run)
            total_fingers += f
            total_barres += a
            total_capo += c
            total_skipped += sk
            if f or a or c:
                touched += 1
            print(
                f"{mode}{path.name}: +fingers={f} +barres={a} +capo={c} skipped={sk} page={page_url}"
            )
            time.sleep(0.25 + random.uniform(0.05, 0.15))
        print(
            f"done {mode}touched={touched} added_fingers={total_fingers} "
            f"added_barres={total_barres} added_capo={total_capo} skipped_positions={total_skipped}"
        )
        return

    total_barres = 0
    total_capo = 0
    total_fingers = 0
    touched = 0

    for path in files:
        stem = path.stem
        suffix = stem_to_suffix(stem)
        chord_path = suffix_to_path("A", suffix)
        page_url = f"https://www.scales-chords.com/chord/banjo/{encode_path(chord_path)}"
        proxy = f"https://r.jina.ai/http://www.scales-chords.com/chord/banjo/{encode_path(chord_path)}"
        try:
            markdown = fetch_text(proxy)
            charts = parse_standard_charts(markdown)
            f, a, c = update_file(path, charts, page_url)
            if f or a or c:
                touched += 1
                total_fingers += f
                total_barres += a
                total_capo += c
                print(f"{path.name}: +fingers={f} +barres={a} +capo={c}")
        except Exception as exc:
            print(f"{path.name}: skip ({exc})")
        time.sleep(0.35 + random.uniform(0.05, 0.2))

    print(f"done touched={touched} added_fingers={total_fingers} added_barres={total_barres} added_capo={total_capo}")


if __name__ == "__main__":
    main()
