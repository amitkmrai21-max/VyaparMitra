# VyaparMitra

Hindi/Urdu WhatsApp marketing assistant for local businesses. Business owners
sign up, save a business profile, and generate ready-to-share WhatsApp
campaigns, posters and social captions — plus a customer list with
appointment/payment follow-up reminders.

- **Live site:** https://amitkmrai21-max.github.io/VyaparMitra/ (GitHub
  Pages, deployed from `docs/` on `main`)
- **Backend API:** https://vyaparmitra-api.onrender.com (Render, deployed
  from `backend/`)

## Repo layout

```
docs/       Live frontend (static HTML/CSS/JS + Supabase auth)
frontend/   Older standalone frontend (no auth/persistence, calls the API directly)
backend/    FastAPI service that turns an offer into campaign copy via Groq
supabase/   SQL for tables the frontend depends on (run manually in Supabase)
```

## Frontend setup (`docs/`)

The frontend talks to two services, configured at the top of `docs/app.js`:

```js
const SUPABASE_URL = "...";
const SUPABASE_PUBLISHABLE_KEY = "...";  // anon/publishable key — safe to be public, protected by RLS
const API_BASE_URL = "...";              // the backend URL above
```

Auth, business profiles, saved campaigns and the customer manager are all
stored in Supabase, scoped per-user with row level security. The app expects
these tables to already exist:

- `businesses` — one row per user (`owner_id`), business profile fields
- `campaigns` — campaign generation history
- `customers` — see `supabase/customers_table.sql` for the schema and RLS
  policy; run it once in the Supabase SQL editor before using the customer
  manager

## Backend setup (`backend/`)

```
cd backend
pip install -r requirements-dev.txt   # includes runtime deps + pytest
cp .env.example .env                  # fill in GROQ_API_KEY at minimum
uvicorn main:app --reload
```

Environment variables (see `backend/.env.example`):

| Variable | Purpose |
| --- | --- |
| `GROQ_API_KEY` | Required. Groq API key used to generate campaign copy. |
| `GROQ_MODEL` | Groq model id. Defaults to `llama-3.1-8b-instant`. |
| `ALLOWED_ORIGINS` | Comma-separated CORS allowlist. Defaults to the live site + local dev ports. |
| `RATE_LIMIT_MAX_REQUESTS` / `RATE_LIMIT_WINDOW_SECONDS` | Per-IP rate limit on `/api/generate-campaign` (each call costs Groq quota). |

Run the tests:

```
cd backend
pytest
```

CI runs the same suite on every push/PR that touches `backend/`
(`.github/workflows/backend-tests.yml`).
