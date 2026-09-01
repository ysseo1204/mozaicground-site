(function () {
  "use strict";

  const tagId = "";
  if (!/^AW-\d+$/.test(tagId)) return;

  const consentKey = "mozaic_measurement_consent_v1";
  let storedConsent = null;

  try {
    storedConsent = window.localStorage.getItem(consentKey);
  } catch {
    // Browser storage can be unavailable in private or restricted contexts.
  }

  const measurementState = storedConsent === "granted" ? "granted" : "denied";
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () {
    window.dataLayer.push(arguments);
  };

  window.gtag("consent", "default", {
    ad_storage: measurementState,
    ad_user_data: measurementState,
    ad_personalization: "denied",
    analytics_storage: measurementState,
    wait_for_update: 500
  });
  window.gtag("set", "allow_ad_personalization_signals", false);

  if (window.MOZAIC_GOOGLE_ADS_TAG_LOADED) return;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(tagId)}`;
  document.head.appendChild(script);

  window.gtag("js", new Date());
  window.gtag("config", tagId, {
    allow_ad_personalization_signals: false
  });
  window.MOZAIC_GOOGLE_ADS_TAG_ID = tagId;
  window.MOZAIC_GOOGLE_ADS_TAG_LOADED = true;
})();
