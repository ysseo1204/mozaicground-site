(function () {
  "use strict";

  const rawConfig = window.MOZAIC_LANDING_CONFIG || {};
  const isResolvedValue = (value) =>
    typeof value === "string" &&
    value.trim().length > 0 &&
    !value.startsWith("__MOZAIC_");

  const config = {
    appStoreUrl: isResolvedValue(rawConfig.appStoreUrl) ? rawConfig.appStoreUrl.trim() : "",
    playStoreUrl: isResolvedValue(rawConfig.playStoreUrl) ? rawConfig.playStoreUrl.trim() : "",
    ga4Id: isResolvedValue(rawConfig.ga4Id) ? rawConfig.ga4Id.trim() : "",
    googleAdsSendTo: isResolvedValue(rawConfig.googleAdsSendTo)
      ? rawConfig.googleAdsSendTo.trim()
      : ""
  };

  const CONSENT_KEY = "mozaic_measurement_consent_v1";
  const CAMPAIGN_KEY = "mozaic_landing_campaign_v1";
  const CAMPAIGN_PARAMS = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "gclid"
  ];
  const analyticsConfigured = Boolean(config.ga4Id || config.googleAdsSendTo);
  const storeUrls = {
    app_store: config.appStoreUrl,
    google_play: config.playStoreUrl
  };
  let measurementConsent = readStoredValue(CONSENT_KEY);
  let googleTagLoaded = false;

  function readStoredValue(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function writeStoredValue(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Browser storage can be unavailable in private or restricted contexts.
    }
  }

  function detectDeviceOs() {
    const userAgent = navigator.userAgent || "";
    const platform = navigator.userAgentData?.platform || navigator.platform || "";
    const isIPadOs = platform === "MacIntel" && navigator.maxTouchPoints > 1;

    if (/iPhone|iPad|iPod/i.test(userAgent) || isIPadOs) return "ios";
    if (/Android/i.test(userAgent)) return "android";
    return "other";
  }

  function captureCampaign() {
    const params = new URLSearchParams(window.location.search);
    const incoming = {};

    CAMPAIGN_PARAMS.forEach((key) => {
      const value = params.get(key);
      if (value) incoming[key] = value.slice(0, 180);
    });

    if (Object.keys(incoming).length > 0) {
      try {
        window.sessionStorage.setItem(CAMPAIGN_KEY, JSON.stringify(incoming));
      } catch {
        // Campaign data remains available in the current URL.
      }
      return incoming;
    }

    try {
      return JSON.parse(window.sessionStorage.getItem(CAMPAIGN_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function setStoreLink(link, store) {
    const url = storeUrls[store];

    if (!url) {
      link.setAttribute("href", "#download-options");
      link.setAttribute("aria-disabled", "true");
      link.dataset.unavailable = "true";
      link.addEventListener("click", (event) => event.preventDefault());
      return;
    }

    link.href = url;
    link.removeAttribute("aria-disabled");
    link.removeAttribute("data-unavailable");
    link.addEventListener("click", handleStoreClick);
  }

  function setupStoreLinks(deviceOs) {
    document.querySelectorAll("[data-store]").forEach((link) => {
      setStoreLink(link, link.dataset.store);
    });

    const statusNodes = document.querySelectorAll("[data-store-status]");
    const availableCount = Number(Boolean(config.appStoreUrl)) + Number(Boolean(config.playStoreUrl));
    let status = "스토어 공개 후 다운로드 링크가 연결됩니다.";

    if (availableCount === 2) {
      status = deviceOs === "ios"
        ? "이 기기에서는 App Store로 안내합니다."
        : deviceOs === "android"
          ? "이 기기에서는 Google Play로 안내합니다."
          : "사용 중인 기기에 맞는 스토어를 선택하세요.";
    } else if (availableCount === 1) {
      status = "현재 공개된 스토어의 다운로드 링크를 이용할 수 있습니다.";
    }

    statusNodes.forEach((node) => {
      node.textContent = status;
    });

    const mobileBar = document.querySelector("[data-mobile-download]");
    const mobileLink = document.querySelector("[data-mobile-store-link]");
    if (!mobileBar || !mobileLink) return;

    const preferredStore =
      deviceOs === "ios" ? "app_store" : deviceOs === "android" ? "google_play" : "";
    const preferredUrl = preferredStore ? storeUrls[preferredStore] : "";

    mobileBar.hidden = false;
    document.body.classList.add("has-mobile-download");

    if (preferredUrl) {
      mobileLink.href = preferredUrl;
      mobileLink.dataset.store = preferredStore;
      mobileLink.textContent =
        preferredStore === "app_store" ? "App Store에서 받기" : "Google Play에서 받기";
      mobileLink.addEventListener("click", handleStoreClick);
    } else if (preferredStore) {
      mobileLink.href = "#download-options";
      mobileLink.textContent = "스토어 공개 후 연결";
      mobileLink.setAttribute("aria-disabled", "true");
    } else {
      mobileLink.href = "#download-options";
      mobileLink.textContent = "앱 설치 옵션 보기";
    }
  }

  function initializeGoogleConsent() {
    if (!analyticsConfigured) return;

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () {
      window.dataLayer.push(arguments);
    };

    window.gtag("consent", "default", {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "denied",
      wait_for_update: 500
    });

    if (measurementConsent === "granted") {
      grantMeasurement();
    } else if (measurementConsent !== "denied") {
      showConsentBanner();
    }

    document.querySelectorAll("[data-open-consent]").forEach((button) => {
      button.hidden = false;
      button.addEventListener("click", showConsentBanner);
    });
  }

  function googleAdsTagId() {
    return config.googleAdsSendTo ? config.googleAdsSendTo.split("/")[0] : "";
  }

  function loadGoogleTag() {
    if (googleTagLoaded || !analyticsConfigured) return;
    googleTagLoaded = true;

    const primaryTagId = config.ga4Id || googleAdsTagId();
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(primaryTagId)}`;
    document.head.appendChild(script);

    window.gtag("js", new Date());
    if (config.ga4Id) window.gtag("config", config.ga4Id);
    const adsId = googleAdsTagId();
    if (adsId) window.gtag("config", adsId);
  }

  function grantMeasurement() {
    measurementConsent = "granted";
    writeStoredValue(CONSENT_KEY, measurementConsent);
    window.gtag("consent", "update", {
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
      analytics_storage: "granted"
    });
    loadGoogleTag();
    hideConsentBanner();
  }

  function denyMeasurement() {
    measurementConsent = "denied";
    writeStoredValue(CONSENT_KEY, measurementConsent);
    if (window.gtag) {
      window.gtag("consent", "update", {
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        analytics_storage: "denied"
      });
    }
    hideConsentBanner();
  }

  function showConsentBanner() {
    const banner = document.querySelector("[data-consent-banner]");
    if (!banner) return;
    banner.hidden = false;
    document.body.classList.add("consent-open");
    const preferredButton =
      measurementConsent === "granted"
        ? banner.querySelector("[data-consent-accept]")
        : banner.querySelector("[data-consent-deny]");
    window.requestAnimationFrame(() => preferredButton?.focus({ preventScroll: true }));
  }

  function hideConsentBanner() {
    const banner = document.querySelector("[data-consent-banner]");
    if (banner) banner.hidden = true;
    document.body.classList.remove("consent-open");
  }

  function eventPlacement(link) {
    if (link.closest(".mobile-download")) return "sticky";
    if (link.closest(".final-cta")) return "final";
    return "hero";
  }

  function handleStoreClick(event) {
    const link = event.currentTarget;
    const url = link.href;
    if (!url || link.dataset.unavailable === "true") {
      event.preventDefault();
      return;
    }

    if (measurementConsent !== "granted" || !window.gtag) return;

    event.preventDefault();
    const campaign = captureCampaign();
    const navigate = once(() => {
      window.location.assign(url);
    });

    window.gtag("event", "store_click", {
      store: link.dataset.store || "unknown",
      device_os: document.body.dataset.deviceOs || "other",
      placement: eventPlacement(link),
      ...campaign
    });

    if (config.googleAdsSendTo) {
      window.gtag("event", "conversion", {
        send_to: config.googleAdsSendTo,
        event_callback: navigate,
        transport_type: "beacon"
      });
      window.setTimeout(navigate, 700);
    } else {
      window.setTimeout(navigate, 120);
    }
  }

  function once(callback) {
    let called = false;
    return function () {
      if (called) return;
      called = true;
      callback();
    };
  }

  function setupHeader() {
    const header = document.querySelector("[data-header]");
    if (!header) return;

    const update = () => header.classList.toggle("is-scrolled", window.scrollY > 12);
    update();
    window.addEventListener("scroll", update, { passive: true });
  }

  const deviceOs = detectDeviceOs();
  const campaign = captureCampaign();
  document.body.dataset.deviceOs = deviceOs;
  document.body.classList.add(`device-${deviceOs}`);
  document.documentElement.dataset.campaign = Object.keys(campaign).length ? "present" : "none";

  setupStoreLinks(deviceOs);
  setupHeader();
  initializeGoogleConsent();

  document
    .querySelector("[data-consent-accept]")
    ?.addEventListener("click", grantMeasurement);
  document
    .querySelector("[data-consent-deny]")
    ?.addEventListener("click", denyMeasurement);
})();
