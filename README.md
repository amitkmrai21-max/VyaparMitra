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
- `businesses.subscription_expires_at` — see `supabase/add_subscription_column.sql`;
  run it once before subscriptions will work. `NULL` or a past timestamp
  means the account is on the paywall (see Subscriptions below).

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
| `RATE_LIMIT_MAX_REQUESTS` / `RATE_LIMIT_WINDOW_SECONDS` | Per-IP rate limit on payment/generation endpoints. |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Required for subscriptions. From the Razorpay dashboard after signing up and completing KYC at razorpay.com. |
| `SUBSCRIPTION_AMOUNT_PAISE` / `SUBSCRIPTION_PERIOD_DAYS` | Subscription price (in paise) and how many days it unlocks per payment. Default ₹199 / 30 days. |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Same project/anon key as the frontend — used to extend *the paying user's own* subscription row after a verified payment. Never put a service-role key here. |

## Subscriptions

Feature access (campaigns, customer manager, history) is gated behind a
₹199/month subscription once a business profile is saved. The flow:

1. Frontend calls `POST /api/create-order` to get a Razorpay order, then
   opens Razorpay Checkout (loaded from `checkout.razorpay.com`).
2. On success, the frontend sends the payment id/order id/signature plus the
   user's own Supabase access token to `POST /api/verify-payment`.
3. The backend verifies the signature with `RAZORPAY_KEY_SECRET` (so a
   request can never fake "payment succeeded"), then extends
   `businesses.subscription_expires_at` by `SUBSCRIPTION_PERIOD_DAYS` — using
   the *user's own* Supabase session, not a service-role key, so a payment
   can only ever unlock the paying user's own account.

There's no auto-renewal: a lapsed subscription re-locks the account and
prompts the user to pay again. Setting this up requires a Razorpay account
(signup + KYC at razorpay.com) — this can't be done for you, only by the
account owner.

Run the tests:

```
cd backend
pytest
```

CI runs the same suite on every push/PR that touches `backend/`
(`.github/workflows/backend-tests.yml`).
