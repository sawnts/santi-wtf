# personal index

the accepted direction follows the quiet density and left-aligned content of linus rogge's personal site, within the approved 736px centered canvas. it carries santi's lowercase voice and original writing/photography.

- white `#fff` canvas; ink `#20201d`; muted text `#6b6b64`; amber hover/focus `#916018`.
- self-hosted monaspace neon variable font. 13px index/navigation text, 16px article text with 1.8 line height and a 64ch measure.
- homepage spacing: 56px top, 14px horizontal, minimum 650px stage. the photo strip sits after generous quiet space, with 76px-high images and natural widths.
- at a 500px canvas width, use 38px top padding and a 68px-high homepage strip. coarse pointers receive 44px text-link targets.
- shared subpages use the same small navigation and quiet article/photo headings. photographs are never cropped; full images fit the canvas and a 72vh maximum height.
- the photographs page opens onto a wider 1120px gallery wall: two columns, a 48px gutter, generous vertical spacing, square image edges, and natural image ratios. at a 732px viewport it becomes one column. no card frames, cropping, or decorative shadows.
- the homepage and letters archive include a compact joined email form with one square outer border and no gap between the field and action. a hidden accessible label names the email field; the charcoal `#45453f` button reads `i’m in!` in white. both controls have a 34px minimum height; supporting text uses muted gray, and coarse pointers receive 44px targets. the intro stays `meet me in your inbox.` and the form submits to the existing personal buttondown newsletter.
- ordinary anchors retain native page navigation and modifier-click behavior. photo activation on the homepage and wall is enhanced with a shared lightbox; the canonical detail page remains the no-javascript fallback.
- the lightbox uses a nearly white backdrop, uncropped image, quiet filename/publication metadata, and small text controls. opening takes 260ms, closing 220ms; reduced motion uses a 70ms fade without spatial movement. no autoplay.

## image provenance

all shipping photography comes from santi's existing `public/images/` originals and matching `photos/*.md` posts. captions/alt text come from the first markdown image. eleventy image emits responsive webp derivatives; no generated artwork or stock substitutes are used. keep original files and source prose intact.

## release boundary

this is the native v4 design implementation. production construction mode and the preserved `archive/v3` source branch are managed outside these templates. do not publish the complete design without release approval.
