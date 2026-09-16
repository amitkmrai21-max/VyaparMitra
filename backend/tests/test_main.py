import json

import pytest
from fastapi.testclient import TestClient

import main

client = TestClient(main.app)

VALID_PAYLOAD = {
    "business_name": "Glow Beauty Salon",
    "category": "Salon",
    "city": "Varanasi",
    "phone": "9876543210",
    "language": "Hindi",
    "campaign_type": "Daily Offer",
    "offer": "15% off on bridal makeup this week.",
}

FAKE_CAMPAIGN = {
    "headline": "Bridal Makeup 15% Off",
    "whatsapp_message": "Namaste! Is week bridal makeup par 15% off milega.",
    "status_text": "Bridal makeup 15% off — is week only!",
    "social_caption": "Book your bridal look today and save 15%.",
    "hashtags": ["#bridalmakeup", "#salonoffer"],
    "call_to_action": "WhatsApp karein 9876543210 par",
}


def test_home_returns_app_info():
    response = client.get("/")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "online"
    assert body["app"] == "VyaparMitra API"


def test_health_reflects_missing_provider_key(monkeypatch):
    monkeypatch.setattr(main, "GROQ_API_KEY", "")
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["provider_configured"] is False


def test_health_reflects_configured_provider_key(monkeypatch):
    monkeypatch.setattr(main, "GROQ_API_KEY", "fake-key")
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["provider_configured"] is True


def test_generate_campaign_rejects_incomplete_payload():
    incomplete = {**VALID_PAYLOAD}
    del incomplete["offer"]

    response = client.post("/api/generate-campaign", json=incomplete)
    assert response.status_code == 422


def test_generate_campaign_without_api_key_returns_500(monkeypatch):
    monkeypatch.setattr(main, "GROQ_API_KEY", "")

    response = client.post("/api/generate-campaign", json=VALID_PAYLOAD)
    assert response.status_code == 500


class _FakeGroqResponse:
    status_code = 200

    def json(self):
        return {"choices": [{"message": {"content": json.dumps(FAKE_CAMPAIGN)}}]}


class _FakeAsyncClient:
    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def post(self, *args, **kwargs):
        return _FakeGroqResponse()


def test_generate_campaign_success(monkeypatch):
    monkeypatch.setattr(main, "GROQ_API_KEY", "fake-key")
    monkeypatch.setattr(main.httpx, "AsyncClient", _FakeAsyncClient)

    response = client.post("/api/generate-campaign", json=VALID_PAYLOAD)
    assert response.status_code == 200
    assert response.json() == FAKE_CAMPAIGN


class _FakeGroqErrorResponse:
    status_code = 401
    text = "invalid api key"


class _FakeAsyncClientError(_FakeAsyncClient):
    async def post(self, *args, **kwargs):
        return _FakeGroqErrorResponse()


def test_generate_campaign_upstream_error_returns_502(monkeypatch):
    monkeypatch.setattr(main, "GROQ_API_KEY", "fake-key")
    monkeypatch.setattr(main.httpx, "AsyncClient", _FakeAsyncClientError)

    response = client.post("/api/generate-campaign", json=VALID_PAYLOAD)
    assert response.status_code == 502


def test_cors_allows_known_frontend_origin():
    response = client.options(
        "/api/generate-campaign",
        headers={
            "Origin": "https://amitkmrai21-max.github.io",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert (
        response.headers.get("access-control-allow-origin")
        == "https://amitkmrai21-max.github.io"
    )


def test_cors_blocks_unknown_origin():
    response = client.options(
        "/api/generate-campaign",
        headers={
            "Origin": "https://evil-example.com",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert "access-control-allow-origin" not in response.headers
