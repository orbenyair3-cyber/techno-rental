# Techno Rental

## Backend API (Render + Supabase)

This repo now includes a production-ready backend in `server/` using **Node.js + Express + Supabase**.

### API routes

- `GET /health` – health check
- `GET /api/tools` – returns all rows from Supabase table `tools`
- `PUT /api/tools` – upsert tools array (used by admin updates)
- `GET /api/orders` – returns all rows from Supabase table `orders`
- `POST /api/orders` – creates order with date-overlap protection for same tool

Expected JSON for `POST /api/orders`:

```json
{
  "tool_id": "t1",
  "start_date": "2026-03-10",
  "end_date": "2026-03-12",
  "customer_name": "ישראל ישראלי",
  "customer_phone": "0500000000"
}
```

---

## Deploy server to Render

1. Push this repository to GitHub.
2. In Render: **New + → Web Service**.
3. Connect your GitHub repo.
4. Configure:
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Add environment variables in Render:
   - `SUPABASE_URL` = your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` = your Supabase service role key
6. Deploy service and copy your Render URL, for example:
   - `https://techno-rental-api.onrender.com`

---

## Frontend API base URL

In `app.js`, set:

```js
const API_BASE = 'https://YOUR-RENDER-URL';
```

Replace `YOUR-RENDER-URL` with your real Render backend URL.

Frontend calls are already configured as:

- `${API_BASE}/api/tools`
- `${API_BASE}/api/orders`

---

## CORS

Server CORS is configured to allow GitHub Pages origin:

- `https://orbenyair3-cyber.github.io`
