# project guidance

read `CLAUDE.md` and `PUBLISHING.md` for the established eleventy architecture and lowercase content style. keep the existing file-browser layout, navigation, theme tokens, and github pages deployment.

## move well

the avatar lives at `/move-well/`. read `docs/move-well.md` before changing its rules or data boundary. the public site must build entirely from synthetic fixtures. no health records, native source identifiers, sheet identifiers, credentials, owner projections, coach context, private paths, or private processing files belong in git or `_site/`.

the user has a separate, working private daily sync. do not recreate authorization, broaden scopes, replace the sync, or duplicate schedules. inspect the private project's own guidance before touching it. keep sheets values, formulas, formatting, timezone and sharing unchanged unless a later task explicitly authorizes a change.

public personal avatar data requires explicit approval of the exact derived fields. a localhost owner preview is the current real-data integration; it serves only a strict projection and never the coach context. private preview data must remain outside this checkout. do not upload or screenshot the owner preview.

run `npm test` and `npm run build` after functional changes. browser-check synthetic scenarios, mobile layout, theme, keyboard controls, and reduced motion. keep this first milestone a draft pr; merging main deploys the site.
