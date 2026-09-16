const SUPABASE_URL = "https://chpflrrfplyhfpmxiusm.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_osahZExe194skn2otQ1i6A_oSI65354";
const API_BASE_URL = "https://vyaparmitra-api.onrender.com";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const appState = {
  user: null,
  business: null,
  customers: [],
  authMode: "login"
};

const form = document.getElementById("campaignForm");
const generateButton = document.getElementById("generateButton");
const formError = document.getElementById("formError");
const emptyState = document.getElementById("emptyState");
const loadingState = document.getElementById("loadingState");
const resultState = document.getElementById("resultState");
const toast = document.getElementById("toast");
const shareWhatsAppButton = document.getElementById("shareWhatsAppButton");

const guestActions = document.getElementById("guestActions");
const userActions = document.getElementById("userActions");
const userGreeting = document.getElementById("userGreeting");
const logoutButton = document.getElementById("logoutButton");
const loginButton = document.getElementById("loginButton");
const signupButton = document.getElementById("signupButton");
const guestGate = document.getElementById("guestGate");
const appContent = document.getElementById("appContent");
const featureSlides = Array.from(document.querySelectorAll(".feature-slide"));
const sliderDots = Array.from(document.querySelectorAll(".slider-dot"));
const sliderPrevButton = document.getElementById("sliderPrevButton");
const sliderNextButton = document.getElementById("sliderNextButton");

const authModal = document.getElementById("authModal");
const authForm = document.getElementById("authForm");
const authEyebrow = document.getElementById("authEyebrow");
const authModalTitle = document.getElementById("authModalTitle");
const authDescription = document.getElementById("authDescription");
const authNameWrap = document.getElementById("authNameWrap");
const authFullName = document.getElementById("authFullName");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authSubmitButton = document.getElementById("authSubmitButton");
const authSwitchText = document.getElementById("authSwitchText");
const authSwitchButton = document.getElementById("authSwitchButton");
const authError = document.getElementById("authError");

const businessModal = document.getElementById("businessModal");
const businessCloseButton = document.getElementById("businessCloseButton");
const businessForm = document.getElementById("businessForm");
const businessError = document.getElementById("businessError");
const saveBusinessButton = document.getElementById("saveBusinessButton");
const editBusinessButton = document.getElementById("editBusinessButton");
const businessBanner = document.getElementById("businessBanner");
const savedBusinessName = document.getElementById("savedBusinessName");
const savedBusinessInfo = document.getElementById("savedBusinessInfo");

const customerForm = document.getElementById("customerForm");
const customerId = document.getElementById("customerId");
const customerName = document.getElementById("customerName");
const customerPhone = document.getElementById("customerPhone");
const customerType = document.getElementById("customerType");
const customerFollowUpDate = document.getElementById("customerFollowUpDate");
const customerNotes = document.getElementById("customerNotes");
const customerError = document.getElementById("customerError");
const saveCustomerButton = document.getElementById("saveCustomerButton");
const cancelCustomerEditButton = document.getElementById("cancelCustomerEditButton");
const customerFormEyebrow = document.getElementById("customerFormEyebrow");
const customerFormTitle = document.getElementById("customerFormTitle");
const customerEmptyState = document.getElementById("customerEmptyState");
const customerListItems = document.getElementById("customerListItems");
const customerCount = document.getElementById("customerCount");
const todayFollowups = document.getElementById("todayFollowups");
const todayFollowupsList = document.getElementById("todayFollowupsList");

const REMINDER_TYPE_LABELS = {
  general: "General",
  appointment: "Appointment",
  payment: "Payment"
};

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
  }, 2400);
}

function setButtonLoading(button, text, isLoading) {
  button.disabled = isLoading;
  const label = button.querySelector("span");

  if (label) {
    label.textContent = text;
  }
}

function openModal(modal) {
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeModal(modal) {
  modal.classList.add("hidden");

  if (authModal.classList.contains("hidden") && businessModal.classList.contains("hidden")) {
    document.body.style.overflow = "";
  }
}

function setAuthMode(mode) {
  appState.authMode = mode;
  const isSignup = mode === "signup";

  authError.textContent = "";
  authError.classList.remove("is-success");
  authForm.reset();
  authPassword.autocomplete = isSignup ? "new-password" : "current-password";

  authEyebrow.textContent = isSignup
    ? "FREE VYAPARMITRA ACCOUNT"
    : "WELCOME TO VYAPARMITRA";
  authModalTitle.textContent = isSignup ? "Sign up" : "Log in";
  authDescription.textContent = isSignup
    ? "Save your business profile and access your campaigns anytime."
    : "Access your saved business profile and campaigns.";
  authNameWrap.classList.toggle("hidden", !isSignup);
  authFullName.required = isSignup;
  authSubmitButton.querySelector("span").textContent = isSignup
    ? "Sign up"
    : "Login";
  authSwitchText.textContent = isSignup
    ? "Already have an account?"
    : "Need a new account?";
  authSwitchButton.textContent = isSignup ? "Login" : "Sign up";
}

function openAuth(mode) {
  setAuthMode(mode);
  openModal(authModal);

  window.setTimeout(() => {
    (mode === "signup" ? authFullName : authEmail).focus();
  }, 50);
}

function populateBusinessForm(business) {
  document.getElementById("setupBusinessName").value = business?.business_name || "";
  document.getElementById("setupCategory").value = business?.category || "Salon";
  document.getElementById("setupCity").value = business?.city || "";
  document.getElementById("setupPhone").value = business?.whatsapp_number || "";
  document.getElementById("setupLanguage").value =
    business?.preferred_language || "Hindi";
}

function openBusinessSetup(isEditing = false) {
  if (!appState.user) {
    openAuth("login");
    return;
  }

  businessError.textContent = "";
  populateBusinessForm(appState.business);
  businessCloseButton.classList.toggle("hidden", !isEditing);
  openModal(businessModal);
}

function renderUserState() {
  const loggedIn = Boolean(appState.user);
  const unlocked = loggedIn && Boolean(appState.business);

  guestActions.classList.toggle("hidden", loggedIn);
  userActions.classList.toggle("hidden", !loggedIn);
  guestGate.classList.toggle("hidden", unlocked);
  appContent.classList.toggle("hidden", !unlocked);

  if (loggedIn) {
    const name =
      appState.user.user_metadata?.full_name ||
      appState.user.email?.split("@")[0] ||
      "User";
    userGreeting.textContent = `Hi, ${name}`;
  } else {
    userGreeting.textContent = "";
  }

  businessBanner.classList.toggle("hidden", !unlocked);

  if (unlocked) {
    savedBusinessName.textContent = appState.business.business_name;
    savedBusinessInfo.textContent = [
      appState.business.category,
      appState.business.city,
      appState.business.whatsapp_number
    ]
      .filter(Boolean)
      .join(" · ");
  }
}

function applyBusinessToCampaignForm() {
  if (!appState.business) {
    return;
  }

  document.getElementById("businessName").value =
    appState.business.business_name || "";
  document.getElementById("category").value = appState.business.category || "Salon";
  document.getElementById("city").value = appState.business.city || "";
  document.getElementById("phone").value =
    appState.business.whatsapp_number || "";
  document.getElementById("language").value =
    appState.business.preferred_language || "Hindi";
}

async function loadBusiness() {
  if (!appState.user) {
    appState.business = null;
    renderUserState();
    return;
  }

  const { data, error } = await supabaseClient
    .from("businesses")
    .select("*")
    .eq("owner_id", appState.user.id)
    .maybeSingle();

  if (error) {
    console.error("Business profile load error:", error);
    showToast("Couldn't load business profile.");
    return;
  }

  appState.business = data || null;
  renderUserState();
  applyBusinessToCampaignForm();
  await loadCustomers();
}

function todayISODate() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
}

async function loadCustomers() {
  if (!appState.user || !appState.business) {
    appState.customers = [];
    renderCustomers();
    return;
  }

  const { data, error } = await supabaseClient
    .from("customers")
    .select("*")
    .eq("business_id", appState.business.id)
    .order("follow_up_date", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("Customer list load error:", error);
    showToast("Couldn't load customer list.");
    return;
  }

  appState.customers = data || [];
  renderCustomers();
}

function customerRowMarkup(entry, { withReminder = false } = {}) {
  const badgeClass = `customer-badge customer-badge-${entry.reminder_type || "general"}`;
  const badgeLabel = REMINDER_TYPE_LABELS[entry.reminder_type] || "General";
  const followUpLabel = entry.follow_up_date
    ? new Date(`${entry.follow_up_date}T00:00:00`).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
      })
    : null;

  const wrapper = document.createElement(withReminder ? "div" : "div");
  wrapper.className = withReminder ? "followup-item" : "customer-row";

  const info = document.createElement("div");
  info.className = withReminder ? "followup-item-info" : "customer-row-info";

  const nameEl = document.createElement("strong");
  nameEl.textContent = entry.name;
  info.appendChild(nameEl);

  const meta = document.createElement(withReminder ? "span" : "div");
  meta.className = withReminder ? "" : "customer-row-meta";

  if (withReminder) {
    meta.textContent = [badgeLabel, entry.phone, followUpLabel]
      .filter(Boolean)
      .join(" · ");
  } else {
    const badge = document.createElement("span");
    badge.className = badgeClass;
    badge.textContent = badgeLabel;
    meta.appendChild(badge);

    const phoneSpan = document.createElement("span");
    phoneSpan.textContent = entry.phone;
    meta.appendChild(phoneSpan);

    if (followUpLabel) {
      const dateSpan = document.createElement("span");
      dateSpan.textContent = followUpLabel;
      meta.appendChild(dateSpan);
    }
  }

  info.appendChild(meta);

  if (!withReminder && entry.notes) {
    const note = document.createElement("p");
    note.className = "customer-row-note";
    note.textContent = entry.notes;
    info.appendChild(note);
  }

  wrapper.appendChild(info);

  const actions = document.createElement("div");
  actions.className = withReminder ? "" : "customer-row-actions";

  const reminderButton = document.createElement("button");
  reminderButton.type = "button";
  reminderButton.className = "icon-button";
  reminderButton.textContent = "Send reminder";
  reminderButton.addEventListener("click", () => sendCustomerReminder(entry));
  actions.appendChild(reminderButton);

  if (!withReminder) {
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "icon-button";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => startCustomerEdit(entry));
    actions.appendChild(editButton);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "icon-button icon-button-danger";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => handleCustomerDelete(entry));
    actions.appendChild(deleteButton);
  }

  wrapper.appendChild(actions);
  return wrapper;
}

function renderCustomers() {
  const customers = appState.customers;

  customerCount.textContent = `${customers.length} customer${
    customers.length === 1 ? "" : "s"
  }`;
  customerEmptyState.classList.toggle("hidden", customers.length > 0);
  customerListItems.innerHTML = "";

  customers.forEach((entry) => {
    customerListItems.appendChild(customerRowMarkup(entry));
  });

  const today = todayISODate();
  const dueToday = customers.filter(
    (entry) => entry.follow_up_date && entry.follow_up_date <= today
  );

  todayFollowups.classList.toggle("hidden", dueToday.length === 0);
  todayFollowupsList.innerHTML = "";

  dueToday.forEach((entry) => {
    todayFollowupsList.appendChild(
      customerRowMarkup(entry, { withReminder: true })
    );
  });
}

function resetCustomerForm() {
  customerForm.reset();
  customerId.value = "";
  customerError.textContent = "";
  customerFormEyebrow.textContent = "NEW CUSTOMER";
  customerFormTitle.textContent = "Add a customer";
  saveCustomerButton.querySelector("span").textContent = "Save customer";
  cancelCustomerEditButton.classList.add("hidden");
}

function startCustomerEdit(entry) {
  customerId.value = entry.id;
  customerName.value = entry.name;
  customerPhone.value = entry.phone;
  customerType.value = entry.reminder_type || "general";
  customerFollowUpDate.value = entry.follow_up_date || "";
  customerNotes.value = entry.notes || "";

  customerFormEyebrow.textContent = "EDIT CUSTOMER";
  customerFormTitle.textContent = `Update ${entry.name}`;
  saveCustomerButton.querySelector("span").textContent = "Update customer";
  cancelCustomerEditButton.classList.remove("hidden");
  customerForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function handleCustomerSubmit(event) {
  event.preventDefault();
  customerError.textContent = "";

  if (!appState.user || !appState.business) {
    showToast("Please save your business profile first.");
    return;
  }

  const name = customerName.value.trim();
  const phone = customerPhone.value.trim();

  if (!name || !phone) {
    customerError.textContent = "Enter customer name and WhatsApp number.";
    return;
  }

  const payload = {
    owner_id: appState.user.id,
    business_id: appState.business.id,
    name,
    phone,
    reminder_type: customerType.value,
    follow_up_date: customerFollowUpDate.value || null,
    notes: customerNotes.value.trim() || null
  };

  const editingId = customerId.value;
  setButtonLoading(
    saveCustomerButton,
    editingId ? "Updating…" : "Saving…",
    true
  );

  try {
    const query = editingId
      ? supabaseClient.from("customers").update(payload).eq("id", editingId)
      : supabaseClient.from("customers").insert(payload);

    const { error } = await query;

    if (error) {
      throw error;
    }

    showToast(editingId ? "Customer updated." : "Customer saved.");
    resetCustomerForm();
    await loadCustomers();
  } catch (error) {
    console.error("Customer save error:", error);
    customerError.textContent =
      error.message || "Couldn't save customer.";
  } finally {
    setButtonLoading(
      saveCustomerButton,
      editingId ? "Update customer" : "Save customer",
      false
    );
  }
}

async function handleCustomerDelete(entry) {
  if (!window.confirm(`Delete ${entry.name} from your customer list?`)) {
    return;
  }

  const { error } = await supabaseClient
    .from("customers")
    .delete()
    .eq("id", entry.id);

  if (error) {
    console.error("Customer delete error:", error);
    showToast("Couldn't delete customer.");
    return;
  }

  if (customerId.value === entry.id) {
    resetCustomerForm();
  }

  showToast("Customer deleted.");
  await loadCustomers();
}

function buildReminderMessage(entry) {
  const businessName = appState.business?.business_name || "our business";
  const followUpLabel = entry.follow_up_date
    ? new Date(`${entry.follow_up_date}T00:00:00`).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
      })
    : null;

  if (entry.reminder_type === "appointment") {
    return `Hi ${entry.name}, this is a reminder from ${businessName}${
      followUpLabel ? ` — your appointment is on ${followUpLabel}` : ""
    }. Please arrive on time. Thank you!`;
  }

  if (entry.reminder_type === "payment") {
    return `Hi ${entry.name}, this is a friendly reminder from ${businessName}${
      followUpLabel ? ` — your payment is due by ${followUpLabel}` : ""
    }. Please clear it soon. Thank you!`;
  }

  return `Hi ${entry.name}, ${businessName} has an update for you. Please reach out to us on WhatsApp!`;
}

function sendCustomerReminder(entry) {
  const message = buildReminderMessage(entry);
  const digitsOnly = entry.phone.replace(/[^0-9]/g, "");
  const whatsappShareUrl = `https://wa.me/${digitsOnly}?text=${encodeURIComponent(
    message
  )}`;
  window.open(whatsappShareUrl, "_blank", "noopener,noreferrer");
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  authError.textContent = "";
  authError.classList.remove("is-success");

  const email = authEmail.value.trim();
  const password = authPassword.value;
  const fullName = authFullName.value.trim();
  const isSignup = appState.authMode === "signup";

  if (!email || !password || (isSignup && !fullName)) {
    authError.textContent = "Please fill in the required details.";
    return;
  }

  setButtonLoading(
    authSubmitButton,
    isSignup ? "Creating account…" : "Logging in…",
    true
  );

  try {
    if (isSignup) {
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName
          }
        }
      });

      if (error) {
        throw error;
      }

      if (!data.session) {
        authError.classList.add("is-success");
        authError.textContent =
          "Account created. Please verify your email, then log in.";
        return;
      }

      appState.user = data.session.user;
      closeModal(authModal);
      renderUserState();
      showToast("Account created. Now save your business details.");
      openBusinessSetup(false);
    } else {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        throw error;
      }

      appState.user = data.user;
      closeModal(authModal);
      await loadBusiness();
      showToast("Login successful.");

      if (!appState.business) {
        openBusinessSetup(false);
      }
    }
  } catch (error) {
    console.error("Auth error:", error);
    authError.textContent =
      error.message || "Login/Sign up failed. Please try again.";
  } finally {
    setButtonLoading(authSubmitButton, isSignup ? "Sign up" : "Login", false);
  }
}

async function handleBusinessSubmit(event) {
  event.preventDefault();
  businessError.textContent = "";

  if (!appState.user) {
    businessError.textContent = "Please log in first.";
    return;
  }

  const businessName = document.getElementById("setupBusinessName").value.trim();
  const category = document.getElementById("setupCategory").value;
  const city = document.getElementById("setupCity").value.trim();
  const whatsappNumber = document.getElementById("setupPhone").value.trim();
  const preferredLanguage = document.getElementById("setupLanguage").value;

  if (!businessName || !category || !city || !whatsappNumber) {
    businessError.textContent = "Please fill in all required business details.";
    return;
  }

  setButtonLoading(saveBusinessButton, "Saving…", true);

  try {
    const payload = {
      owner_id: appState.user.id,
      business_name: businessName,
      category,
      city,
      whatsapp_number: whatsappNumber,
      preferred_language: preferredLanguage
    };

    const { data, error } = await supabaseClient
      .from("businesses")
      .upsert(payload, { onConflict: "owner_id" })
      .select()
      .single();

    if (error) {
      throw error;
    }

    appState.business = data;
    renderUserState();
    applyBusinessToCampaignForm();
    closeModal(businessModal);
    showToast("Business profile saved.");
    await loadCustomers();
  } catch (error) {
    console.error("Business save error:", error);
    businessError.textContent =
      error.message || "Couldn't save business profile.";
  } finally {
    setButtonLoading(saveBusinessButton, "Save business profile", false);
  }
}

async function handleLogout() {
  const { error } = await supabaseClient.auth.signOut({ scope: "local" });

  if (error) {
    showToast("Couldn't log out.");
    return;
  }

  appState.user = null;
  appState.business = null;
  appState.customers = [];
  renderUserState();
  renderCustomers();
  showToast("You have been logged out.");
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

  (campaign.hashtags || []).forEach((tag) => {
    const span = document.createElement("span");
    span.textContent = tag;
    hashtagBox.appendChild(span);
  });
}

async function saveCampaignHistory(data, campaign) {
  if (!appState.user || !appState.business) {
    return;
  }

  const { error } = await supabaseClient.from("campaigns").insert({
    owner_id: appState.user.id,
    business_id: appState.business.id,
    campaign_type: data.campaign_type,
    offer_details: data.offer,
    language: data.language,
    headline: campaign.headline,
    whatsapp_message: campaign.whatsapp_message,
    status_text: campaign.status_text,
    social_caption: campaign.social_caption,
    hashtags: campaign.hashtags || [],
    call_to_action: campaign.call_to_action
  });

  if (error) {
    console.error("Campaign history save error:", error);
  }
}

async function handleCampaignSubmit(event) {
  event.preventDefault();
  formError.textContent = "";

  if (!appState.user || !appState.business) {
    openAuth("login");
    return;
  }

  const data = getFormData();

  generateButton.disabled = true;
  generateButton.querySelector("span").textContent = "Generating campaign…";
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
      throw new Error(result.detail || "Couldn't generate campaign.");
    }

    renderCampaign(data, result);
    showState(resultState);
    await saveCampaignHistory(data, result);
  } catch (error) {
    console.error("Campaign generation error:", error);
    showState(emptyState);
    formError.textContent =
      error.message || "Network error. Please check the backend.";
  } finally {
    generateButton.disabled = false;
    generateButton.querySelector("span").textContent =
      "✨ Generate Campaign";
  }
}
function setupFeatureSlider() {
  if (!featureSlides.length || !sliderDots.length) {
    return;
  }

  let activeIndex = 0;
  let sliderTimer;

  function showSlide(index) {
    activeIndex = (index + featureSlides.length) % featureSlides.length;

    featureSlides.forEach((slide, slideIndex) => {
      slide.classList.toggle("active", slideIndex === activeIndex);
    });

    sliderDots.forEach((dot, dotIndex) => {
      dot.classList.toggle("active", dotIndex === activeIndex);
    });
  }

  function startAutoSlide() {
    window.clearInterval(sliderTimer);
    sliderTimer = window.setInterval(() => {
      showSlide(activeIndex + 1);
    }, 5000);
  }

  sliderDots.forEach((dot, index) => {
    dot.addEventListener("click", () => {
      showSlide(index);
      startAutoSlide();
    });
  });

  if (sliderPrevButton) {
    sliderPrevButton.addEventListener("click", () => {
      showSlide(activeIndex - 1);
      startAutoSlide();
    });
  }

  if (sliderNextButton) {
    sliderNextButton.addEventListener("click", () => {
      showSlide(activeIndex + 1);
      startAutoSlide();
    });
  }

  showSlide(0);
  startAutoSlide();
}

function setupEventListeners() {
  form.addEventListener("submit", handleCampaignSubmit);

  loginButton.addEventListener("click", () => openAuth("login"));
  signupButton.addEventListener("click", () => openAuth("signup"));

  authSwitchButton.addEventListener("click", () => {
    openAuth(appState.authMode === "login" ? "signup" : "login");
  });

  authForm.addEventListener("submit", handleAuthSubmit);
  businessForm.addEventListener("submit", handleBusinessSubmit);
  editBusinessButton.addEventListener("click", () => openBusinessSetup(true));
  businessCloseButton.addEventListener("click", () => closeModal(businessModal));
  logoutButton.addEventListener("click", handleLogout);

  customerForm.addEventListener("submit", handleCustomerSubmit);
  cancelCustomerEditButton.addEventListener("click", resetCustomerForm);

  document.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", () => closeModal(authModal));
  });

  [authModal, businessModal].forEach((modal) => {
    modal.addEventListener("click", (event) => {
      if (event.target === modal && !modal.classList.contains("hidden")) {
        if (modal === businessModal && !appState.business) {
          return;
        }
        closeModal(modal);
      }
    });
  });

  document.querySelectorAll("[data-copy-target]").forEach((button) => {
    button.addEventListener("click", async () => {
      const targetId = button.dataset.copyTarget;
      const text = document.getElementById(targetId).textContent.trim();

      try {
        await navigator.clipboard.writeText(text);
        showToast("Copied! Now paste it in WhatsApp or Instagram.");
      } catch {
        showToast("Couldn't copy. Please select the text manually and copy it.");
      }
    });
  });

  shareWhatsAppButton.addEventListener("click", () => {
    const message = document.getElementById("whatsappMessage").textContent.trim();

    if (!message) {
      showToast("Please generate a campaign first.");
      return;
    }

    const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappShareUrl, "_blank", "noopener,noreferrer");
  });

  document.getElementById("newCampaignButton").addEventListener("click", () => {
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    document.getElementById("offer").focus();
  });
}

async function initializeApp() {
  setupEventListeners();
  setupFeatureSlider();
  renderUserState();

  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    console.error("Session load error:", error);
    return;
  }

  if (data.session) {
    appState.user = data.session.user;
    await loadBusiness();

    if (!appState.business) {
      openBusinessSetup(false);
    }
  }

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    if (!session) {
      appState.user = null;
      appState.business = null;
      renderUserState();
    }
  });
}

initializeApp();
