---
title: Docs workflow
description: Keep the Docusaurus site in sync whenever product features change.
---

# Docs workflow

Published documentation lives in **`documentation/`**. The root **`docs/`** folder is internal planning and ops notes only — do not treat it as the user-facing docs site.

## When you change the product

| Change type | Update |
|-------------|--------|
| User-facing feature or UX | Matching page under `documentation/docs/guides/` |
| API, infra, setup, or deploy | Matching page under `documentation/docs/developers/` |
| New top-level product area | New markdown page + entry in `documentation/sidebars.ts` in the **same** PR or session |

## Checklist for contributors and agents

1. Identify whether the change is Guides, Developers, or both.
2. Edit or add the markdown page; keep voice calm, material-first, and Knorvex-branded (never StudSync / Prepwise).
3. Update `sidebars.ts` if you added a page.
4. Run `pnpm start` or `pnpm build` under `documentation/` to verify links.
5. Leave root `docs/` alone unless you intentionally update internal planning notes.

## Voice and branding

- Match marketing tone: short sentences, practice from *your* notes.
- Fonts/colors for the site are already in `src/css/custom.css` — do not reintroduce default Docusaurus green as the brand.
- Link out to in-app legal pages instead of copying full policies.

## Cursor rule

Project rule `.cursor/rules/docs-sync.mdc` reminds agents to update this site when shipping features. Follow it on every feature change.
