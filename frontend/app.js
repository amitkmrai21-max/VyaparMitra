const API_BASE_URL = "http://127.0.0.1:8000";

const form = document.getElementById("campaignForm");
const generateButton = document.getElementById("generateButton");
const formError = document.getElementById("formError");
const emptyState = document.getElementById("emptyState");
const loadingState = document.getElementById("loadingState");
const resultState = document.getElementById("resultState");
const toast = document.getElementById("toast");
const shareWhatsAppButton = document.getElementById("shareWhatsAppButton");

function showState(state) {
  emptyState.classList.add("hidden");
  loadingState.classList.add("hidden");
  resultState.classList.add("hidden");
  state.classList.remove("hidden");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");

  window.setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

function getFormData() {
  return {
    business_name: document.getElementById("businessName").value.trim(),
    category: document.getElementById("category").value,
    city: document.getElementById("city").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    language: document.getElementById("language").value,
    campaign_type: document.getElementById("campaignType").value,
    offer: document.getElementById("offer").value.trim()
  };
}

function renderCampaign(data, campaign) {
  document.getElementById("posterBusinessName").textContent = data.business_name;
  document.getElementById("posterCampaignType").textContent =
    data.campaign_type.toUpperCase();
  document.getElementById("posterHeadline").textContent = campaign.headline;
  document.getElementById("posterCity").textContent = data.city;
  document.getElementById("posterPhone").textContent = data.phone;

  document.getElementById("whatsappMessage").textContent =
    campaign.whatsapp_message;
  document.getElementById("statusText").textContent = campaign.status_text;
  document.getElementById("socialCaption").textContent =
    campaign.social_caption;
  document.getElementById("callToAction").textContent =
    campaign.call_to_action;

  const hashtagBox = document.getElementById("hashtags");
  hashtagBox.innerHTML = "";

  campaign.hashtags.forEach((tag) => {
    const span = document.createElement("span");
    span.textContent = tag;
    hashtagBox.appendChild(span);
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formError.textContent = "";

  const data = getFormData();

  generateButton.disabled = true;
  generateButton.querySelector("span").textContent = "Campaign ban raha hai…";
  showState(loadingState);

  try {
    const response = await fetch(`${API_BASE_URL}/api/generate-campaign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.detail || "Campaign generate nahi ho paya.");
    }

    renderCampaign(data, result);
    showState(resultState);
  } catch (error) {
    showState(emptyState);
    formError.textContent =
      error.message || "Network error. Backend check karein.";
  } finally {
    generateButton.disabled = false;
    generateButton.querySelector("span").textContent =
      "✨ AI Campaign Generate Karein";
  }
});

document.querySelectorAll("[data-copy-target]").forEach((button) => {
  button.addEventListener("click", async () => {
    const targetId = button.dataset.copyTarget;
    const text = document.getElementById(targetId).textContent.trim();

    try {
      await navigator.clipboard.writeText(text);
      showToast("Copied! Ab WhatsApp ya Instagram me paste karein.");
    } catch {
      showToast("Copy nahi hua. Text ko manually select karke copy karein.");
    }
  });
});

shareWhatsAppButton.addEventListener("click", () => {
  const message = document.getElementById("whatsappMessage").textContent.trim();

  if (!message) {
    showToast("Pehle AI campaign generate karein.");
    return;
  }

  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
  window.open(whatsappShareUrl, "_blank", "noopener,noreferrer");
});

document.getElementById("newCampaignButton").addEventListener("click", () => {
  form.scrollIntoView({ behavior: "smooth", block: "start" });
  document.getElementById("offer").focus();
});
