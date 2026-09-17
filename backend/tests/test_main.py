import json

import pytest
from fastapi.testclient import TestClient

import main

client = TestClient(main.app)


@pytest.fixture(autouse=True)
def _reset_rate_limit_buckets():
    main._rate_limit_buckets.clear()
    yield
    main._rate_limit_buckets.clear()


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


def test_rate_limit_blocks_excess_requests(monkeypatch):
    monkeypatch.setattr(main, "GROQ_API_KEY", "fake-key")
    monkeypatch.setattr(main.httpx, "AsyncClient", _FakeAsyncClient)
    monkeypatch.setattr(main, "RATE_LIMIT_MAX_REQUESTS", 2)

    first = client.post("/api/generate-campaign", json=VALID_PAYLOAD)
    second = client.post("/api/generate-campaign", json=VALID_PAYLOAD)
    third = client.post("/api/generate-campaign", json=VALID_PAYLOAD)

    assert first.status_code == 200
    assert second.status_code == 200
    assert third.status_code == 429


def test_cors_blocks_unknown_origin():
    response = client.options(
        "/api/generate-campaign",
        headers={
            "Origin": "https://evil-example.com",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert "access-control-allow-origin" not in response.headers


VALID_PAYMENT_PAYLOAD = {
    "razorpay_order_id": "order_fake123",
    "razorpay_payment_id": "pay_fake123",
    "razorpay_signature": "sig_fake123",
    "access_token": "user-jwt-token",
}


class _FakeRazorpayOrderApi:
    def create(self, data):
        return {"id": "order_fake123"}


class _FakeRazorpayUtilityApi:
    should_fail = False

    def verify_payment_signature(self, data):
        if self.should_fail:
            raise main.razorpay.errors.SignatureVerificationError("bad signature")
        return True


class _FakeRazorpayClient:
    def __init__(self, *args, **kwargs):
        self.order = _FakeRazorpayOrderApi()
        self.utility = _FakeRazorpayUtilityApi()


class _FakeRazorpayClientBadSignature(_FakeRazorpayClient):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.utility.should_fail = True


def test_create_order_without_keys_returns_500(monkeypatch):
    monkeypatch.setattr(main, "RAZORPAY_KEY_ID", "")
    monkeypatch.setattr(main, "RAZORPAY_KEY_SECRET", "")

    response = client.post("/api/create-order")
    assert response.status_code == 500


def test_create_order_success(monkeypatch):
    monkeypatch.setattr(main, "RAZORPAY_KEY_ID", "rzp_test_fake")
    monkeypatch.setattr(main, "RAZORPAY_KEY_SECRET", "fake_secret")
    monkeypatch.setattr(main.razorpay, "Client", _FakeRazorpayClient)

    response = client.post("/api/create-order")
    assert response.status_code == 200
    body = response.json()
    assert body["order_id"] == "order_fake123"
    assert body["key_id"] == "rzp_test_fake"
    assert body["amount"] == main.SUBSCRIPTION_AMOUNT_PAISE


def test_verify_payment_invalid_signature_returns_400(monkeypatch):
    monkeypatch.setattr(main, "RAZORPAY_KEY_ID", "rzp_test_fake")
    monkeypatch.setattr(main, "RAZORPAY_KEY_SECRET", "fake_secret")
    monkeypatch.setattr(main.razorpay, "Client", _FakeRazorpayClientBadSignature)

    response = client.post("/api/verify-payment", json=VALID_PAYMENT_PAYLOAD)
    assert response.status_code == 400


class _FakeSupabaseResponse:
    def __init__(self, status_code, payload):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload


class _FakeSupabaseAsyncClient:
    business_rows = [{"id": "biz-1", "subscription_expires_at": None}]

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def get(self, url, headers=None, params=None):
        return _FakeSupabaseResponse(200, self.business_rows)

    async def patch(self, url, headers=None, params=None, json=None):
        return _FakeSupabaseResponse(200, [{"id": "biz-1", **json}])


class _FakeSupabaseAsyncClientNoBusiness(_FakeSupabaseAsyncClient):
    business_rows = []


def test_verify_payment_success(monkeypatch):
    monkeypatch.setattr(main, "RAZORPAY_KEY_ID", "rzp_test_fake")
    monkeypatch.setattr(main, "RAZORPAY_KEY_SECRET", "fake_secret")
    monkeypatch.setattr(main, "SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setattr(main, "SUPABASE_ANON_KEY", "anon-key")
    monkeypatch.setattr(main.razorpay, "Client", _FakeRazorpayClient)
    monkeypatch.setattr(main.httpx, "AsyncClient", _FakeSupabaseAsyncClient)

    response = client.post("/api/verify-payment", json=VALID_PAYMENT_PAYLOAD)
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "active"
    assert body["subscription_expires_at"]


def test_verify_payment_no_business_returns_404(monkeypatch):
    monkeypatch.setattr(main, "RAZORPAY_KEY_ID", "rzp_test_fake")
    monkeypatch.setattr(main, "RAZORPAY_KEY_SECRET", "fake_secret")
    monkeypatch.setattr(main, "SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setattr(main, "SUPABASE_ANON_KEY", "anon-key")
    monkeypatch.setattr(main.razorpay, "Client", _FakeRazorpayClient)
    monkeypatch.setattr(main.httpx, "AsyncClient", _FakeSupabaseAsyncClientNoBusiness)

    response = client.post("/api/verify-payment", json=VALID_PAYMENT_PAYLOAD)
    assert response.status_code == 404
