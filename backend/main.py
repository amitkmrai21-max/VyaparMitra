import json
import os
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from typing import Literal

import httpx
import razorpay
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

load_dotenv()

app = FastAPI(
    title="VyaparMitra API",
    version="0.1.0",
    description="Hindi/Urdu WhatsApp marketing assistant for local businesses",
)

ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "https://amitkmrai21-max.github.io,http://localhost:3000,http://127.0.0.1:5500",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")

# Subscription / payments (Razorpay). The Razorpay key id is safe to expose
# to the frontend (like a Stripe publishable key); the key secret never
# leaves this server. Signature verification uses the key secret, so a
# request can never fake "payment succeeded" without an actual captured
# Razorpay payment.
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")
SUBSCRIPTION_AMOUNT_PAISE = int(os.getenv("SUBSCRIPTION_AMOUNT_PAISE", "19900"))
SUBSCRIPTION_PERIOD_DAYS = int(os.getenv("SUBSCRIPTION_PERIOD_DAYS", "30"))

# Same values already embedded in docs/app.js (anon/publishable key, safe to
# be public — Postgres row level security is what actually protects data).
# Used here so a payment can only ever update the *paying user's own*
# business row, via their own Supabase session — this server never holds a
# service-role key that could write to someone else's data.
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")

# Simple in-memory sliding-window rate limit per client IP. Each campaign
# generation call costs real Groq quota/money, and CORS only stops browser
# callers — it does nothing against a direct curl/script request — so this
# is the actual backstop against abuse. Resets if the process restarts and
# is per-worker only, which is fine at this app's scale.
RATE_LIMIT_MAX_REQUESTS = int(os.getenv("RATE_LIMIT_MAX_REQUESTS", "10"))
RATE_LIMIT_WINDOW_SECONDS = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60"))
_rate_limit_buckets: dict[str, deque] = defaultdict(deque)


def enforce_rate_limit(client_ip: str) -> None:
    now = time.monotonic()
    bucket = _rate_limit_buckets[client_ip]

    while bucket and now - bucket[0] > RATE_LIMIT_WINDOW_SECONDS:
        bucket.popleft()

    if len(bucket) >= RATE_LIMIT_MAX_REQUESTS:
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Please try again in a little while.",
        )

    bucket.append(now)


class CampaignRequest(BaseModel):
    business_name: str = Field(min_length=2, max_length=100)
    category: str = Field(min_length=2, max_length=80)
    city: str = Field(min_length=2, max_length=80)
    phone: str = Field(min_length=5, max_length=30)
    language: Literal["Hindi", "Urdu", "English"] = "Hindi"
    campaign_type: str = Field(min_length=2, max_length=100)
    offer: str = Field(min_length=3, max_length=500)


class CampaignResponse(BaseModel):
    headline: str
    whatsapp_message: str
    status_text: str
    social_caption: str
    hashtags: list[str]
    call_to_action: str


def build_prompt(data: CampaignRequest) -> str:
    return f"""
You are an expert marketing copywriter for small local businesses in India.

Create a short, trustworthy, practical marketing campaign. Do not make false,
misleading, medical, financial, or guaranteed-result claims. Use the requested
language naturally. Keep the message suitable for WhatsApp and local customers.

Business name: {data.business_name}
Business category: {data.category}
City/locality: {data.city}
Phone/WhatsApp: {data.phone}
Language: {data.language}
Campaign type: {data.campaign_type}
Offer or details: {data.offer}

Return ONLY valid JSON with this exact schema:
{{
  "headline": "short poster headline, maximum 12 words",
  "whatsapp_message": "friendly promotional WhatsApp message, maximum 90 words",
  "status_text": "short WhatsApp status text, maximum 30 words",
  "social_caption": "Instagram/Facebook caption, maximum 120 words",
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
  "call_to_action": "short action line including phone or WhatsApp direction"
}}
""".strip()


async def generate_with_groq(prompt: str) -> dict:
    if not GROQ_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="GROQ_API_KEY server environment variable is missing.",
        )

    payload = {
        "model": GROQ_MODEL,
        "messages": [
            {
                "role": "system",
                "content": "You return only valid JSON. Never wrap JSON in Markdown.",
            },
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.7,
        "response_format": {"type": "json_object"},
    }

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=45) as client:
        response = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers=headers,
            json=payload,
        )

    if response.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail=f"Content provider error: {response.text}",
        )

    try:
        content = response.json()["choices"][0]["message"]["content"]
        return json.loads(content)
    except (KeyError, IndexError, json.JSONDecodeError) as error:
        raise HTTPException(
            status_code=502,
            detail="Content provider returned an invalid campaign response.",
        ) from error


@app.get("/")
def home():
    return {
        "status": "online",
        "app": "VyaparMitra API",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "provider_configured": bool(GROQ_API_KEY),
        "model": GROQ_MODEL,
        "payments_configured": bool(
            RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET and SUPABASE_URL and SUPABASE_ANON_KEY
        ),
    }


class CreateOrderResponse(BaseModel):
    order_id: str
    amount: int
    currency: str
    key_id: str


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str = Field(min_length=1)
    razorpay_payment_id: str = Field(min_length=1)
    razorpay_signature: str = Field(min_length=1)
    access_token: str = Field(min_length=1)


class VerifyPaymentResponse(BaseModel):
    status: str
    subscription_expires_at: str


def get_razorpay_client() -> razorpay.Client:
    if not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:
        raise HTTPException(
            status_code=500,
            detail="Payments are not configured on the server yet.",
        )

    return razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))


async def fetch_business_for_user(access_token: str) -> dict:
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(
            status_code=500,
            detail="Supabase is not configured on the server yet.",
        )

    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(
            f"{SUPABASE_URL}/rest/v1/businesses",
            headers={
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {access_token}",
            },
            params={"select": "id,subscription_expires_at"},
        )

    if response.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail="Could not read your business profile.",
        )

    rows = response.json()

    if not rows:
        raise HTTPException(
            status_code=404,
            detail="No business profile found for this account.",
        )

    return rows[0]


async def extend_business_subscription(
    access_token: str, business_id: str, new_expiry_iso: str
) -> None:
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.patch(
            f"{SUPABASE_URL}/rest/v1/businesses",
            headers={
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
            params={"id": f"eq.{business_id}"},
            json={"subscription_expires_at": new_expiry_iso},
        )

    if response.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail="Payment verified, but updating your subscription failed. Please contact support.",
        )


@app.post("/api/create-order", response_model=CreateOrderResponse)
async def create_order(request: Request):
    client_ip = request.client.host if request.client else "unknown"
    enforce_rate_limit(client_ip)

    client = get_razorpay_client()
    order = client.order.create(
        {
            "amount": SUBSCRIPTION_AMOUNT_PAISE,
            "currency": "INR",
            "payment_capture": 1,
        }
    )

    return CreateOrderResponse(
        order_id=order["id"],
        amount=SUBSCRIPTION_AMOUNT_PAISE,
        currency="INR",
        key_id=RAZORPAY_KEY_ID,
    )


@app.post("/api/verify-payment", response_model=VerifyPaymentResponse)
async def verify_payment(payload: VerifyPaymentRequest, request: Request):
    client_ip = request.client.host if request.client else "unknown"
    enforce_rate_limit(client_ip)

    client = get_razorpay_client()

    try:
        client.utility.verify_payment_signature(
            {
                "razorpay_order_id": payload.razorpay_order_id,
                "razorpay_payment_id": payload.razorpay_payment_id,
                "razorpay_signature": payload.razorpay_signature,
            }
        )
    except razorpay.errors.SignatureVerificationError as error:
        raise HTTPException(
            status_code=400,
            detail="Payment could not be verified.",
        ) from error

    business = await fetch_business_for_user(payload.access_token)

    now = datetime.now(timezone.utc)
    current_expiry = None
    raw_expiry = business.get("subscription_expires_at")

    if raw_expiry:
        try:
            current_expiry = datetime.fromisoformat(raw_expiry.replace("Z", "+00:00"))
        except ValueError:
            current_expiry = None

    base_date = current_expiry if current_expiry and current_expiry > now else now
    new_expiry = base_date + timedelta(days=SUBSCRIPTION_PERIOD_DAYS)
    new_expiry_iso = new_expiry.isoformat()

    await extend_business_subscription(payload.access_token, business["id"], new_expiry_iso)

    return VerifyPaymentResponse(status="active", subscription_expires_at=new_expiry_iso)


@app.post("/api/generate-campaign", response_model=CampaignResponse)
async def generate_campaign(data: CampaignRequest, request: Request):
    client_ip = request.client.host if request.client else "unknown"
    enforce_rate_limit(client_ip)

    prompt = build_prompt(data)
    result = await generate_with_groq(prompt)

    try:
        return CampaignResponse(**result)
    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail="Response did not match the required campaign format.",
        ) from error
