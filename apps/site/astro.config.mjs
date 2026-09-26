// @ts-check
import cloudflare from '@astrojs/cloudflare';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://www.5rsuites.com',
  // SSR: every page renders at request time from D1, then sits in the edge cache until
  // an admin save purges it (see src/lib/cache.js).
  output: 'server',
  adapter: cloudflare({
    // Images are served straight from R2; no Cloudflare Images transforms.
    imageService: 'passthrough',
    // Share one local D1/R2 with the admin during development.
    persistState: { path: '../../.wrangler/state' },
  }),
  // No Astro sessions (the site has no logged-in visitors), so no KV namespace is needed.
  session: false,
  trailingSlash: 'never',
  build: { format: 'file' },
});
