# Mangoeverse — Cloudflare Deployment

## Live resources (account: `94c9d2b075c868634f716993dbb0970f`)

| Resource | Name | ID / Details |
|----------|------|----------------|
| Worker | `mangoeverse` | Deployed (bindings attached) |
| D1 | `mangoeverse` | `ffcba2bb-7c5b-4640-8316-58fb9f195d41` |
| KV | `mangoeverse-cache` | `5b5a84ff1ea34bbf86dbfbd6f6382e58` |
| Queue | `mango-notify` | Producer + consumer configured |
| Secret | `ADMIN_TOKEN` | Set on Worker (see `.admin-token.local`) |
| R2 | `mangoeverse-images` | **Not enabled** — enable R2 in dashboard, then uncomment `r2_buckets` in `wrangler.jsonc` |

## Public URL — action required

Register a **workers.dev** subdomain (one-time):

https://dash.cloudflare.com/94c9d2b075c868634f716993dbb0970f/workers/onboarding

Then redeploy using a valid Cloudflare API token with Worker, D1, KV, Queue, and account read permissions:

```bash
cp .dev.vars.example .dev.vars
# edit .dev.vars and add CLOUDFLARE_API_TOKEN
npm run deploy
```

Your store will be at: `https://mangoeverse.<your-subdomain>.workers.dev`

## Admin access

1. Open `https://mangoeverse.<subdomain>.workers.dev/admin/`
2. Use the token in `.admin-token.local` (local file, not committed)

## Enable R2 (product image uploads)

1. Go to [Cloudflare R2](https://dash.cloudflare.com/?to=/:account/r2/overview) and enable R2
2. Run: `npx wrangler r2 bucket create mangoeverse-images`
3. Uncomment the `r2_buckets` block in `wrangler.jsonc`
4. `npm run deploy`

## Meta / CAPI secrets (optional)

```bash
npx wrangler secret put META_CAPI_ACCESS_TOKEN
npx wrangler secret put META_PIXEL_ID
```

Also set `META_PIXEL_ID` in `public/js/tracking.js`.

## MCP vs Wrangler account

The Cloudflare **plugin MCP** may use a different account than **Wrangler OAuth**. Resources for this project were created via Wrangler on `snipercryptotradingbot@gmail.com`. Use Wrangler commands for this repo’s deploy lifecycle.

The project includes `.mcp.json` for Cloudflare MCP integration. It is configured to use `CLOUDFLARE_ACCOUNT_ID` from the repository and expects `CLOUDFLARE_API_TOKEN` to be supplied from the local environment or `.dev.vars`.

## Commands

```bash
npm run dev                 # Local dev
npm run db:migrate:local    # Local D1
npm run db:migrate          # Remote D1 migrations
npm run deploy              # Deploy Worker + assets
```
