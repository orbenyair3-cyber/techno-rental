# Techno Rental

## Backend API (Render + Supabase)

Server folder: `server/` (Node.js + Express + Supabase)

### Routes

- `GET /health`
- `GET /api/tools`
- `GET /api/tools/stream` (SSE stream backed by Supabase realtime on `public.tools`)
- `POST /api/tools`
- `PUT /api/tools/:id`
- `DELETE /api/tools/:id`
- `PUT /api/tools`
- `POST /api/media/upload` (uploads images/videos to Supabase Storage bucket `tool-media`)
- `GET /api/orders`
- `POST /api/orders`
- `PUT /api/orders/:id` (status: `approved` / `cancelled`)

### Expected JSON for `POST /api/orders`

```json
{
  "tool_id": "t1",
  "start_date": "2026-03-10",
  "end_date": "2026-03-12",
  "customer_name": "ישראל ישראלי",
  "customer_phone": "0500000000",
  "customer_email": "customer@example.com"
}
```

---

## Automatic email confirmations (Resend)

After a successful order creation, backend sends 2 emails automatically (in Hebrew):

1. Customer confirmation (`אישור הזמנה – Techno Electric`)
2. Manager notification (`הזמנה חדשה באתר – Techno Electric`)

Includes:

- Tool name
- Start/end dates
- Price per day + estimated total
- Customer details (name, phone, email)
- Order ID
- Site link: `https://orbenyair3-cyber.github.io/techno-rental/`

Email sending is **fire-and-forget** (API returns immediately; email errors are logged).

---

## Database migration

Run:

```sql
alter table public.orders
add column if not exists customer_email text;
```

Migration file in repo:

- `server/migrations/001_add_customer_email.sql`
- `server/migrations/002_add_tools_media_urls.sql`
- `server/migrations/003_align_tools_table.sql`

Run also:

```sql
alter table public.tools
add column if not exists media_urls text[] default '{}'::text[];
```

Alignment migration also ensures table/columns exist:

- `id` (uuid)
- `name`
- `category`
- `price`
- `deposit`
- `max_days`
- `image_url`
- `description`
- `media_urls` (text[])
- `busydates` (jsonb)
- `is_available` (boolean)

## Tool media uploads (gallery/camera files)

- Storage bucket name: `tool-media` (public)
- Allowed types:
  - images: `jpg`, `png`, `webp`
  - videos: `mp4`, `webm`
- Max size: `20MB` per file
- Admin selects files in `admin.html` → backend uploads to Supabase Storage
- Public URLs are returned and saved in `tools.media_urls` (`text[]`)

## Global sync, realtime and no-cache

- Frontend treats backend/Supabase as source of truth, then caches locally for fallback only.
- After tool changes, frontend immediately refetches `GET /api/tools`.
- Realtime updates are pushed via `GET /api/tools/stream` (SSE) which listens to Supabase realtime events on `public.tools`.
- API routes under `/api` send no-cache headers (`Cache-Control: no-store` etc.).
- Frontend requests include cache-busting query (`?_=${Date.now()}`) and no-store fetch mode.
- HTML pages load script as `app.js?v=20260305` for cache-busting.

---

## Render deployment

1. Push repo to GitHub.
2. In Render: **New + → Web Service**.
3. Configure:
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

### Required Render env vars

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `MANAGER_EMAIL` (לדוגמה: `tec_ele1@017.net.il`)

### Optional env var

- `FROM_EMAIL` (default: `Techno Electric <onboarding@resend.dev>`)

---

## How to get `RESEND_API_KEY`

1. Sign in at [https://resend.com](https://resend.com)
2. Go to **API Keys**
3. Create and copy key
4. Add it in Render as `RESEND_API_KEY`

---

## Local testing

From `server/`:

```bash
npm install
npm start
```

Create `server/.env` with:

```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
RESEND_API_KEY=...
MANAGER_EMAIL=manager@example.com
FROM_EMAIL=Techno Electric <onboarding@resend.dev>
```

Test order creation:

```bash
curl -X POST http://localhost:10000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"tool_id":"t1","start_date":"2026-03-10","end_date":"2026-03-12","customer_name":"ישראל ישראלי","customer_phone":"0500000000","customer_email":"customer@example.com"}'
```

---

## Frontend API base URL

In `app.js`:

```js
const API_BASE = 'https://YOUR-RENDER-URL';
```

Current frontend uses:

- `${API_BASE}/api/tools`
- `${API_BASE}/api/orders`

---

## CORS

Allowed origin configured:

- `https://orbenyair3-cyber.github.io`
