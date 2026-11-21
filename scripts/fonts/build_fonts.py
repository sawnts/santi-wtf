#!/usr/bin/env python3
"""Generate checked-in web fonts; normal site builds do not need Python."""

import argparse
import hashlib
import importlib.metadata
import json
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "public/fonts/MonaspaceNeonVar.woff2"
SOURCE_SHA256 = "6569968f448ae856ab5b57dff1f13b109b220ca8e3f664169e135fcb5c4f0721"
MANIFEST = ROOT / "_data/fonts.json"
FAMILY = "Santi Index Mono"
PINNED_TOOLS = {"fonttools": "4.66.1", "brotli": "1.2.1"}
LATIN_RANGES = [
    (0x0000, 0x024F),  # Basic Latin, Latin-1, Extended-A/B, IPA.
    (0x0300, 0x036F),  # Combining accents.
    (0x1E00, 0x1EFF),  # Latin Extended Additional.
    (0x2000, 0x206F),  # General punctuation.
    (0x20A0, 0x20CF),  # Currency.
    (0x2100, 0x214F),  # Letterlike symbols.
    (0x2190, 0x21FF),  # Arrows, including the existing UI arrows.
    (0x2212, 0x2212), (0xFEFF, 0xFEFF), (0xFFFD, 0xFFFD),
]
VERTICAL_METRICS = {
    "head": ["unitsPerEm"],
    "hhea": ["ascent", "descent", "lineGap"],
    "OS/2": ["sTypoAscender", "sTypoDescender", "sTypoLineGap", "usWinAscent", "usWinDescent"],
}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load(path):
    return TTFont(path, recalcTimestamp=False)


def unicode_range(codepoints):
    spans = []
    for point in sorted(codepoints):
        if spans and point == spans[-1][1] + 1:
            spans[-1][1] = point
        else:
            spans.append([point, point])
    return ", ".join(f"U+{a:04X}" + (f"-{b:04X}" if b != a else "") for a, b in spans)


def features(font, tag):
    if tag not in font or not font[tag].table.FeatureList:
        return set()
    return {entry.FeatureTag for entry in font[tag].table.FeatureList.FeatureRecord}


def rename(font, label):
    # Upstream reserves Monaspace and its subfamily names for unmodified fonts.
    names = {
        1: FAMILY, 2: "Regular", 3: f"1.400;SantiIndexMono-{label}",
        4: f"{FAMILY} Regular", 5: "Version 1.400; Santi web subset 1",
        6: "SantiIndexMono-Regular", 16: FAMILY, 17: "Regular", 25: "SantiIndexMono",
    }
    for record in font["name"].names:
        if record.nameID in names:
            record.string = names[record.nameID].encode(record.getEncoding())
    # Preserve source copyright/license names and every stylistic feature name.


def optimize(source, latin, name):
    font = instantiateVariableFont(
        source, {"wght": (400, 400, 600), "wdth": 100, "slnt": 0}, inplace=False,
    )
    # The instancer omits empty gvar records for invariant glyphs. The subsetter
    # expects those keys; an empty list encodes the same absence of deltas.
    if "gvar" in font:
        for glyph in font.getGlyphOrder():
            font["gvar"].variations.setdefault(glyph, [])
    if latin is not None:
        options = subset.Options()
        options.layout_features = ["*"]
        options.layout_scripts = ["*"]
        options.name_IDs = ["*"]
        options.name_languages = ["*"]
        options.name_legacy = True
        options.glyph_names = True
        options.notdef_outline = True
        options.recommended_glyphs = True
        options.recalc_timestamp = False
        sub = subset.Subsetter(options=options)
        sub.populate(unicodes=latin)
        sub.subset(font)
    rename(font, name)
    font.flavor = "woff2"
    target = ROOT / f"public/fonts/santi-index-{name}.woff2"
    font.save(target, reorderTables=False)
    return target


def metrics(font):
    return {tag: {key: getattr(font[tag], key) for key in keys} for tag, keys in VERTICAL_METRICS.items()}


def validate(manifest):
    source = load(SOURCE)
    original_cmap = source.getBestCmap()
    fonts = {asset["url"]: load(ROOT / ("public" + asset["url"])) for asset in manifest["assets"]}
    covered = set().union(*(set(font.getBestCmap()) for font in fonts.values()))
    assert covered == set(original_cmap), "Web fonts must retain every original Unicode mapping."
    assert metrics(source) == manifest["metrics"], "Source metrics changed."
    for asset in manifest["assets"]:
        path = ROOT / ("public" + asset["url"])
        font = fonts[asset["url"]]
        assert path.stat().st_size == asset["sizeBytes"] and digest(path) == asset["sha256"], f"Regenerate {path.name}."
        assert unicode_range(font.getBestCmap()) == asset["unicodeRange"], "CSS coverage metadata is stale."
        assert metrics(font) == manifest["metrics"], f"Vertical metrics changed in {path.name}."
        assert [(a.axisTag, a.minValue, a.defaultValue, a.maxValue) for a in font["fvar"].axes] == [("wght", 400, 400, 600)]
        assert font["name"].getDebugName(1) == FAMILY and font["name"].getDebugName(16) == FAMILY
    fallback = fonts[manifest["fallback"]]
    assert set(fallback.getBestCmap()) == set(original_cmap), "Fallback must retain full source coverage."
    # Pinning width/slant legitimately removes feature-variation branches that
    # cannot activate at those coordinates. Compare the effective source features.
    effective = instantiateVariableFont(source, {"wght": (400, 400, 600), "wdth": 100, "slnt": 0}, inplace=False)
    for tag in ["GSUB", "GPOS"]:
        assert features(fallback, tag) == features(effective, tag), f"Fallback {tag} features changed."
        assert features(effective, tag) == set().union(*(features(font, tag) for font in fonts.values()))
    # Compare every retained glyph's advance, including feature alternates, at all used weights.
    compared = 0
    for weight in [400, 500, 600]:
        original = instantiateVariableFont(source, {"wght": weight, "wdth": 100, "slnt": 0}, inplace=False)
        for url, font in fonts.items():
            result = instantiateVariableFont(font, {"wght": weight}, inplace=False)
            for glyph in result.getGlyphOrder():
                assert result["hmtx"][glyph][0] == original["hmtx"][glyph][0], f"Advance changed: {url}, {glyph}, {weight}."
                compared += 1
    print(f"Validated {len(covered):,} Unicode mappings and {compared:,} glyph advances at weights 400/500/600; vertical metrics and fallback features match.")


def build():
    source = load(SOURCE)
    cmap = source.getBestCmap()
    latin = {point for point in cmap if any(low <= point <= high for low, high in LATIN_RANGES)}
    assets = []
    # Full fallback first, Latin last: CSS font matching prefers Latin when it covers the text.
    for label, codepoints in [("fallback", None), ("latin", latin)]:
        path = optimize(source, codepoints, label)
        font = load(path)
        assets.append({
            "url": "/fonts/" + path.name, "sizeBytes": path.stat().st_size, "sha256": digest(path),
            "unicodeRange": unicode_range(font.getBestCmap()), "codepointCount": len(font.getBestCmap()),
        })
    manifest = {
        "family": FAMILY, "preload": "/fonts/santi-index-latin.woff2", "fallback": "/fonts/santi-index-fallback.woff2",
        "source": {"path": "public/fonts/MonaspaceNeonVar.woff2", "sizeBytes": SOURCE.stat().st_size, "sha256": SOURCE_SHA256},
        "tools": PINNED_TOOLS, "axes": {"wght": [400, 600], "wdth": 100, "slnt": 0},
        "metrics": metrics(source), "assets": assets,
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    css = ROOT / "public/css/base.css"
    faces = "\n\n".join(
        "@font-face {\n  font-family: santi-index-mono;\n"
        f"  src: url('{asset['url']}') format('woff2');\n"
        "  font-style: normal;\n  font-weight: 400 600;\n  font-display: swap;\n"
        f"  unicode-range: {asset['unicodeRange']};\n}}" for asset in assets
    )
    current = css.read_text()
    assert current.startswith("@font-face {") and "\n:root {" in current, "Font-face preamble changed; review before regenerating."
    css.write_text(faces + "\n\n:root {" + current.split("\n:root {", 1)[1])
    validate(manifest)
    primary = next(asset for asset in assets if asset["url"] == manifest["preload"])
    print(f"Latin preload: {primary['sizeBytes']:,} bytes vs {SOURCE.stat().st_size:,}; {100 * (1 - primary['sizeBytes'] / SOURCE.stat().st_size):.1f}% smaller.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Validate checked-in assets without regenerating.")
    args = parser.parse_args()
    for tool, version in PINNED_TOOLS.items():
        assert importlib.metadata.version(tool) == version, f"Install scripts/fonts/requirements.txt in a virtual environment."
    assert digest(SOURCE) == SOURCE_SHA256, "Source font changed; review provenance and regenerate deliberately."
    if args.check:
        validate(json.loads(MANIFEST.read_text()))
    else:
        build()
