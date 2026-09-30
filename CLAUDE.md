# 5R Suites — Project Context

Corporate housing company migrating off Wix to a fully owned custom stack.
The entire point of this project is avoiding future platform lock-out —
keep that in mind before suggesting any hosted/managed service that isn't
easily exportable.

## Repo structure (monorepo)

```
5rsuites/
  apps/site/        Public Astro app (SSR) on Cloudflare Workers, deploys to www.5rsuites.com
  apps/admin/        CMS dashboard (React) + Pages Functions API, deploys to admin.5rsuites.com
  migrations/         D1 schema (SQL) — source of truth for the database
  packages/design/    Shared styles.css, design tokens, brand assets
  packages/blocks/    Block type definitions: drive admin forms, API validation, site renderers
  packages/server/    Server helpers shared by both apps (Resend email, D1 rate limiting)
  scripts/            create-owner.mjs (bootstraps the first owner login)
```

The public site is a Cloudflare **Worker** (Workers Builds, root directory
`apps/site`). The admin is a Cloudflare **Pages** project (root directory
`apps/admin`). Both bind to the **same** D1 database and R2 bucket.

Why the site is on Workers, not Pages: the current Astro Cloudflare adapter
(v14, Astro 7) only targets Workers. Pages support was dropped, and staying
on Pages would have meant pinning Astro two major versions back. Decided
with the developer at build time. The subdomain split is unchanged.

## Tech stack

- **Astro (SSR mode)** — public site. Renders at request time, reads D1 directly. Not static — instant content updates is a hard requirement.
- **Cloudflare Workers** — public site hosting (Astro adapter). Workers cache layer (`cache.enabled`) in front.
- **Cloudflare Pages + Pages Functions** — admin hosting and API (`/api/*` in the admin project).
- **Cloudflare D1** — database (SQLite).
- **Cloudflare R2** — image and attachment storage.
- **PBKDF2 via Web Crypto** — auth. No external auth provider (Auth0, Clerk, etc.) — deliberate, matches the ownership goal.
- **Resend** — transactional email (password resets, form notifications, security alerts).
- **Cloudflare Turnstile** + honeypot — spam protection on all public forms.

Do not introduce a page-builder platform, a hosted CMS SaaS, or any service
that can't export its data in an open format. That's the one hard rule.

## Pages

Home, About, FAQ, Register Property, Contact. Content and layout follow the
previous Wix site (the visual reference); starter copy is seeded from it by
`scripts/gen-seed.py`. Forms are placed with the `form` block (Contact form on
Contact, Register Property form on Register Property, Careers form on About).

**Open question, unresolved as of this file's writing:** an earlier version
of this project also included a **Partners** page (nav link, partner logo
strip, "Partner With Us" CTA), and it exists in the original schema seed
and in already-built HTML/React pages. A later content list omitted it.
Confirm with the client whether Partners is in or out before removing it
from code — don't assume either way.

## Content model — the block/section system

Every page is an ordered list of `sections`. Each has a `type` and a JSON
`data` payload. Valid types:

```
hero, rich_text, image_gallery, photo_collage, traveler_grid, amenity_grid,
cta_banner, quote, contact_strip, faq_list, unit_grid, form
```

`form` places one of the three fixed forms (fields defined in
`apps/site/src/lib/form-specs.js`, not editable by staff).

Staff pick from this fixed set — no raw HTML/custom code sections. If a
new layout need comes up, add a new block type (schema + admin form +
public renderer), don't add an escape hatch for arbitrary markup.

## Database schema

See `migrations/0001_init.sql` for the authoritative schema. Tables:
`users`, `sessions`, `password_resets`, `pages`, `sections`,
`page_revisions`, `media`, `faq_items`, `units`, `form_submissions`,
`rate_limit_log`.

## Permissions (enforced in API, not just UI)

| Action | Staff | Owner |
|---|---|---|
| Add/edit/reorder/delete sections | ✅ | ✅ |
| View & restore page history | ✅ | ✅ |
| Create/delete a page, change its slug | ❌ | ✅ |
| Invite/remove staff logins | ❌ | ✅ |

## Caching

Public pages are cached at Cloudflare's edge. A CMS save **explicitly
purges that specific page's cache** — cache + purge-on-write, not a
blanket short TTL and not zero caching.

Mechanism: the site tags every HTML response (`Cache-Tag: all,page-<id>[,faq][,units]`,
see `apps/site/src/lib/cache.js`). After a save, the admin POSTs the affected
tags to the site's `/api/internal/purge` (auth: shared `PURGE_SECRET`), which calls
`cache.purge({ tags })`. If a purge fails, the editor sees a warning toast. Don't "simplify" this to a TTL
cache without checking first; the whole point was instant-on-save.

## Revision history

Every section save snapshots the full page into `page_revisions`. Last 20
kept per page, older pruned automatically. Restoring a revision creates a
**new** revision — never a destructive rollback.

## Auth details

- PBKDF2, 100,000 iterations, SHA-256, via native Web Crypto (see `apps/admin/functions/lib/auth.js`).
- Session cookie: `HttpOnly`, `Secure`, `SameSite=Lax`.
- Login rate limit: 10 failed attempts / 15 min / IP. Trips a Resend email alert to `TEAM_ALERT_EMAIL`.
- Forgot/reset password is custom-built, not a third-party widget. Single-use token, 1-hour expiry. A successful reset deletes all other sessions for that account.

## Forms

Careers, Register Property, and Contact all follow: Turnstile + honeypot
→ stored in `form_submissions` → Resend email notification. Never skip
the D1 write even if the email send fails — the D1 record is the source
of truth, email is a convenience notification on top.

### Register Property — additional automated pipeline

On submission, before/alongside the standard form handling above:

1. Submitted address → U.S. Census geocoder (free) → latitude/longitude
2. AirROI **Estimate Listing Revenue Potential** (`GET /calculator/estimate`, $0.20) → projected
   revenue, occupancy, ADR and comparables for the property. RevPAR = ADR × occupancy (in code).
3. AirROI **Find Market by Coordinates** (`GET /markets/lookup`, $0.01) + **Get Market Summary**
   (`POST /markets/summary`, $0.10) → city averages. Called only on the first lead from a city;
   stored in `market_cache` (D1) and reused for `MARKET_CACHE_DAYS` (default 365).
4. Fill a **fixed template** with those numbers (property estimate + city comparison) —
   pre-written sentence structures, not freeform AI-generated text
5. Render as a PDF with 5R Suites branding
6. Resend emails the PDF + a scheduling link to the submitter
7. Submission and report logged in `form_submissions`, same as other forms

Only those three AirROI endpoints are used — don't add other paid calls without checking.
Everything AirROI-specific is in `apps/site/src/lib/report/airroi.js`.

AirDNA was the original plan but its API is enterprise-contract only; scraping it was ruled
out (terms of service, account/legal risk, fragility). Don't reintroduce scraping.

This is a scripted pipeline with **no human review step** before the
report is sent. Known risk: thin/odd data for unusual addresses
(rural, brand-new buildings) could produce a weak report with nobody
catching it.

Mitigation built in (confirm with client): `assessQuality()` in
`apps/site/src/lib/report/template.js` **holds** a report when data is
incomplete, has fewer than `REPORT_MIN_COMPS` (default 5) comparables, has
implausible values, or the property's ADR is more than 3× off the city average.
The submitter gets a plain thank-you, the team gets an alert, and the admin shows
"Report held — needs review". If the city lookup fails, the report still goes out
property-only. The response field names in `airroi.js` should be confirmed with the
first real API call.

## SEO

- Sitemap generated by Astro, submitted via Search Console.
- Structured data (schema.org markup) on Home, Register Property, FAQ.
- Search Console verified via DNS TXT record.
- GA4 via Measurement ID — needs a GA4 property created under the client's own Google account (not yet set up).
- No Google Business Profile access needed for any of this.

## Deployment

- `main` branch → production. Any other branch/PR → automatic Cloudflare Pages preview URL.
- Secrets (`RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`, `TEAM_ALERT_EMAIL`, `PURGE_SECRET`, `AIRROI_API_KEY`, optional `FORM_NOTIFY_EMAIL`) live in Cloudflare's encrypted env vars — never in the repo.

## Account ownership (important, don't skip this context)

Repo and Cloudflare account currently live under the developer's accounts,
for build speed. **The owner is added as an Admin/member on both from day
one** — this is not deferred. Full ownership transfer + pointing the
domain's nameservers at Cloudflare happen together as a **go-live gate**:
production does not launch until transfer is complete. The domain
registration itself already belongs to the client elsewhere (GoDaddy/etc.),
so worst case without a completed transfer is just repointing nameservers
— not a lock-out repeat.

## Domain migration

Site currently runs on Wix. DNS record audit, email routing continuity,
and redirect mapping from old Wix URLs are **not yet finalized** — work
this out closer to go-live, don't assume a clean cutover.

## Reliability

- D1: Cloudflare's built-in 30-day point-in-time recovery. No external export needed at this scale.
- Uptime monitoring: Cloudflare Health Checks, enable on both hostnames at launch.

## Design

Brand tokens (navy `#183b5f`, gold `#d4c284`, brown `#846438`; Poppins headings,
Inter body) live in `packages/design/tokens.css`. Fonts are self-hosted via
`@fontsource` (no Google Fonts dependency). Top-bar/footer contact details and
social links are `vars` in `apps/site/wrangler.jsonc`.

The layout copies the old Wix site (980px content column, its heading sizes, card and
button styles). `scripts/import-wix-images.mjs` + `scripts/wix-import/map.json` carry the
Wix photos, FAQ, legal pages and per-section settings into the CMS.

Motion also follows Wix and is chosen per section in the admin: every section has an
`animation` field (`float` = the Wix behaviour: photos float up, buttons fold in, logos slide
in, text stays put), heroes/banners have `bg_effect` (parallax / fixed / none) and the photo
collage has `main_effect` (pan) and `bottom_effect` (bob). The scroll-driven parts run from
the inline script in `apps/site/src/layouts/Base.astro`; the keyframes are at the end of
`packages/design/styles.css`. Everything respects `prefers-reduced-motion`.

## Out of scope (for now — don't build unprompted)

- Multi-language content
- Draft/preview vs. published states (content is live on save)
- Payment processing (booking stays on the external system: `5rsuites.holidayfuture.com`)

## Reference

Full architecture document with diagrams: `5rsuites-architecture.docx`.
Read it before making any structural change to the data model or the
subdomain/hosting split.
