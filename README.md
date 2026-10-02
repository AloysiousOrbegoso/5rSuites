# 5R Suites

The 5R Suites website and CMS run on a fully owned stack (Astro, Cloudflare Workers/Pages, D1, R2).

| App          | What                                   | Hosting           | Domain             |
| ------------ | -------------------------------------- | ----------------- | ------------------ |
| `apps/site`  | Public site (Astro SSR, reads D1)      | Cloudflare Worker | www.5rsuites.com   |
| `apps/admin` | CMS (React) + `/api/*` Pages Functions | Cloudflare Pages  | admin.5rsuites.com |

Shared code lives in `packages/blocks` (the 10 section types), `packages/design` (CSS tokens and styles) and `packages/server` (email and rate limiting). The database schema is in `migrations/`.

## Local development

Requires Node 22+.

```sh
npm install
cp apps/admin/.dev.vars.example apps/admin/.dev.vars
cp apps/site/.dev.vars.example apps/site/.dev.vars

npm run db:migrate:local                                   # schema + starter content (from the Wix site)
# If you ran an older version of this repo locally: rm -rf .wrangler/state first (schema changed).
npm run create-owner -- --email you@example.com --name "You"   # prompts for a password

npm run build -w apps/site && (cd apps/site && npx wrangler dev --persist-to ../../.wrangler/state)   # site  → http://localhost:8787
npm run dev -w apps/admin                                   # admin → http://localhost:8788
```

Both apps share one local D1/R2 in `.wrangler/state`. For hot reload on the admin UI, run `npm run dev:ui -w apps/admin` alongside `wrangler pages dev`. It proxies `/api` to port 8788.

Run the unit tests with `npm test` (block validation, Markdown escaping, auth hashing, the report template, the quality gate and PDF rendering).

## First deploy

1. **Create resources** (in the Cloudflare account that will be transferred to the client):
   ```sh
   npx wrangler d1 create 5rsuites          # put the database_id in BOTH wrangler files
   npx wrangler r2 bucket create 5rsuites-media
   ```
2. **Migrate:** `npm run db:migrate:remote`, then `npm run create-owner -- --email … --name … --remote`.
3. **Site (Worker):** in Workers & Pages → Create → import this repo with root directory `apps/site`, build command `npm run build` and deploy command `npx wrangler deploy`. Set these secrets: `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`, `TEAM_ALERT_EMAIL`, `PURGE_SECRET`, `AIRROI_API_KEY`, and optionally `FORM_NOTIFY_EMAIL`. In `wrangler.jsonc`, set `TURNSTILE_SITE_KEY`, `SCHEDULING_URL` and `GA4_MEASUREMENT_ID`.
4. **Admin (Pages):** create a Pages project from this repo with root directory `apps/admin`, build command `npm run build` and output `dist`. Bind D1 as `DB` and R2 as `BUCKET` (or rely on `wrangler.toml`). Set these secrets: `RESEND_API_KEY`, `TEAM_ALERT_EMAIL`, and `PURGE_SECRET` (the **same value** as the site's).
5. **Resend:** verify the `5rsuites.com` sending domain, which adds DNS records.
6. **Turnstile:** create a widget for `www.5rsuites.com` and use its site key and secret.
7. **Health checks:** enable Cloudflare Health Checks on both hostnames.

`main` deploys to production. Other branches get preview URLs. Preview sites serve `robots.txt: Disallow: /`.

## How content editing works

- Pages are ordered lists of sections. Staff pick a section type, fill in its form and click **Save & publish**. The change is live on the next page load.
- Every save stores a full-page snapshot. The last 20 per page are kept. **Restore** writes an old version back as a new version, so nothing is ever destroyed.
- The FAQ list and Units are managed on their own screens and appear wherever a page has an FAQ-list or Unit-grid section.
- Forms are placed with the **Form** section type (Contact, Register Property, Careers).
- Owners also manage pages (create, delete, URL, menu) and logins (Team → Invite).
