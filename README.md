# Mangoeverse

Premium Pakistani mango e-commerce — single-page mobile-first storefront with Cloudflare Workers API, D1, R2, KV, and Queues.

## Stack

| Layer | Service |
|-------|---------|
| Storefront | Static assets via Workers Assets |
| API | Cloudflare Worker (`src/worker/`) |
| Database | D1 (customers, orders, products, referrals) |
| Images | R2 (`mangoeverse-images`) |
| Cache | KV (product catalog) |
| Notifications | Queues (`mango-notify`) |

## Quick Start

```bash
npm install
cp .dev.vars.example .dev.vars   # set ADMIN_TOKEN for local admin
npm run db:migrate:local         # apply D1 schema locally
npm run dev                      # http://localhost:8787
```

- **Store:** http://localhost:8787/
- **Admin:** http://localhost:8787/admin/ (use `ADMIN_TOKEN` from `.dev.vars`)

## Phase 2 Features

### Storefront API
- `GET /api/products` — product catalog (KV cached)
- `POST /api/orders` — create order, deduct stock, award points, referral conversion
- `GET /api/customers/:phone` — customer profile sync
- `GET /api/referral/:code` — validate referral code
- `POST /api/meta/capi` — Meta Conversions API proxy
- `GET /api/images/:key` — R2 product images

### Admin API (Bearer `ADMIN_TOKEN`)
- `GET /api/admin/dashboard` — revenue, orders, conversion metrics
- `GET /api/admin/orders` + `PATCH /api/admin/orders/:id` — kanban status updates
- `GET /api/admin/products` + `PATCH` + image upload to R2
- `GET /api/admin/referrals` — ambassadors + referral log
- `GET /api/admin/customers` — customer list + detail

## Configuration

### Secrets (production)

```bash
wrangler secret put ADMIN_TOKEN
wrangler secret put META_CAPI_ACCESS_TOKEN
wrangler secret put META_PIXEL_ID
```

### Meta Pixel (client)

Edit `public/js/tracking.js` — set `META_PIXEL_ID`.

### D1 (production)

```bash
npm run db:create              # once — update database_id in wrangler.jsonc
npm run db:migrate             # apply migrations remotely
```

Update placeholder IDs in `wrangler.jsonc` after creating D1/KV resources in Cloudflare dashboard.

## Deploy

```bash
npm run deploy
```

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for live resource IDs, admin token, and workers.dev setup.

### Production resources

Configured in `wrangler.jsonc`:

- D1 `mangoeverse` — orders, customers, products, referrals
- KV `mangoeverse-cache` — product catalog cache
- Queue `mango-notify` — order/stock notifications
- R2 — optional (enable in dashboard first)

## Local vs Production

Orders persist to D1 when the API is available. The storefront falls back to `localStorage` if the API is unreachable.

Notification queue consumer logs messages locally; wire Twilio/WhatsApp/email in `src/worker/queue.ts` for production alerts.
