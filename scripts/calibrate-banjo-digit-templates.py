#!/usr/bin/env python
"""Fetch 7#9 labeled PNGs and write scripts/banjo_sc_digit_prototypes.pkl for add-scales-barres-capo-a.py."""
import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
mod_path = ROOT / "scripts" / "add-scales-barres-capo-a.py"
spec = importlib.util.spec_from_file_location("banjo_cv", mod_path)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

mod._SITE_DIGIT_TEMPLATES = None
if mod.DIGIT_PROTO_CACHE.is_file():
    mod.DIGIT_PROTO_CACHE.unlink()
site = mod.build_site_digit_templates_from_reference()
print("digits:", {k: len(v) for k, v in site.items()})
if not site:
    print("failed: no prototypes", file=sys.stderr)
    sys.exit(1)
import pickle

with mod.DIGIT_PROTO_CACHE.open("wb") as fh:
    pickle.dump(site, fh)
print("wrote", mod.DIGIT_PROTO_CACHE)
