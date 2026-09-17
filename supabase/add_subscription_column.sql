-- Subscriptions: run this once in the Supabase SQL editor.
-- Adds the column the backend's /api/verify-payment endpoint writes to
-- after a Razorpay payment is verified. NULL / a past date means the
-- business's subscription is not active.

alter table public.businesses
  add column if not exists subscription_expires_at timestamptz;
