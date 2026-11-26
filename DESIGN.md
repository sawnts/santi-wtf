# personal index

the accepted direction follows the quiet density and left-aligned content of linus rogge's personal site, within the approved 736px centered canvas. it carries santi's lowercase voice and original writing/photography.

- white `#fff` canvas; ink `#20201d`; muted text `#6b6b64`; amber hover/focus `#916018`.
- self-hosted monaspace neon appearance, delivered through the optimized santi index mono derivative with weights 400–600 and a full-character fallback. original source fonts remain intact. 13px index/navigation text, 16px article text with a 1.618 (φ) line height and a 64ch measure. all spacing uses the fibonacci `--fib-*` tokens (3, 5, 8, 13, 21, 34, 55, 89, 233).
- homepage spacing follows fibonacci steps around the 13px type: 55px top, a 233px-wide e-ink portrait, 34px to the name, 13px to the intro, 21px intro line height, 21px to the links, and 89px of quiet space before an 89px-high photo strip with natural widths. 14px horizontal padding, minimum 650px stage.
- at a 500px canvas width, use 34px top padding and 55px before the strip. coarse pointers receive 44px text-link targets.
- shared subpages use the same small navigation and quiet article/photo headings. photographs are never cropped; full images fit the canvas and a 72vh maximum height.
- the photographs page opens onto a wider 1120px gallery wall: two columns, a 55px gutter, 89px between rows, square image edges, and natural image ratios. at a 732px viewport it becomes one column. no card frames, cropping, or decorative shadows.
- there are no signup forms. the homepage links to the newsletter, *fwd:*, on substack.
- ordinary anchors retain native page navigation and modifier-click behavior. photo activation on the homepage and wall is enhanced with a shared lightbox; the canonical detail page remains the no-javascript fallback.
- the lightbox uses a nearly white backdrop, uncropped image, quiet filename/publication metadata, and small text controls. opening takes 260ms, closing 220ms; reduced motion uses a 70ms fade without spatial movement. no autoplay.
- browser Back dismisses the lightbox with focus/scroll restoration; Forward and reload preserve the selected photo. photo changes share one history entry and leave the underlying URL unchanged.

## image provenance

all shipping photography comes from santi's existing `public/images/` originals and matching `photos/*.md` posts. captions/alt text come from the first markdown image. eleventy image emits responsive webp derivatives; no generated artwork or stock substitutes are used. keep original files and source prose intact.

## release boundary

this is the native v4 design implementation and the production site. the fallback construction page and the preserved `archive/v3` source branch are managed outside these templates.
