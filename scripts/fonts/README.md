# web font generation

The v4 site uses **Santi Index Mono**, an optimized derivative of the checked-in
Monaspace Neon variable font. The appearance, default width/slant, line metrics,
and used weights (400, 500, 600) are preserved. The original font remains unchanged
for provenance and the construction page.

The Latin asset includes Latin-1, Latin Extended-A/B, IPA, combining accents,
Latin Extended Additional, general punctuation, currencies, letterlike symbols,
and arrows wherever the source supports them. It covers all current writing.
The full fallback retains every source Unicode mapping and OpenType feature,
including mixed-script shaping. Both fonts preserve stylistic alternate glyphs
and hinting. Width/slant axes are fixed to their defaults; weight is restricted
to 400–600. CSS lists the full fallback first and Latin last, so Latin text uses
the small asset. Only Latin is preloaded.

Normal Eleventy builds use checked-in WOFF2 assets and **do not require Python**.
To regenerate, use Python 3.11+ in an isolated environment:

```sh
python3 -m venv /tmp/santi-fonts-venv
/tmp/santi-fonts-venv/bin/python -m pip install -r scripts/fonts/requirements.txt
/tmp/santi-fonts-venv/bin/python scripts/fonts/build_fonts.py
/tmp/santi-fonts-venv/bin/python scripts/fonts/build_fonts.py --check
```

The helper pins tool versions, verifies the original SHA-256, writes the two fonts,
updates only the font-face preamble in `public/css/base.css`, and records asset
hashes, sizes, Unicode ranges, axes, and source metrics in `_data/fonts.json`.
It checks every original Unicode mapping and each retained glyph's advance at
400/500/600, line metrics, and fallback OpenType feature tags. Review typography
in the browser after changing the source, ranges, tools, or font CSS. Add future
weights deliberately to the generator and tests.

## license and provenance

Source: `public/fonts/MonaspaceNeonVar.woff2`, internal version **1.400**, from
[GitHub's Monaspace project](https://github.com/githubnext/monaspace).
Original SHA-256: `6569968f448ae856ab5b57dff1f13b109b220ca8e3f664169e135fcb5c4f0721`.
The source name table links to the upstream SIL Open Font License 1.1.
`public/fonts/OFL.txt` is the upstream license at
[commit ac3b9819239ee4d1bc8b2b4d1d58b85e3cd931fc](https://github.com/githubnext/monaspace/blob/ac3b9819239ee4d1bc8b2b4d1d58b85e3cd931fc/LICENSE).

The license reserves Monaspace and its subfamily names, including Neon. Therefore
the modified fonts' primary family/full/PostScript names are **Santi Index Mono**;
the source attribution and license metadata are retained. These derivatives
remain under SIL OFL 1.1. The original fonts keep their original names.
