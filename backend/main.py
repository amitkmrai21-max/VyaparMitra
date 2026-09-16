import json
import os
import time
from collections import defaultdict, deque
from typing import Literal

import httpx
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
            detail="Bahut zyada requests. Kripya thodi der baad try karein.",
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
    }


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
