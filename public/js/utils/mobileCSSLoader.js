// Mobile CSS loader utility
// Conditionally loads mobile-specific CSS for detected mobile devices

import { detectDevice, getDeviceCapabilities } from "./deviceDetection.js";

export function loadMobileCSS() {
  const device = detectDevice();
  const capabilities = getDeviceCapabilities();

  // Load mobile CSS only for mobile devices
  if (device.isMobile) {
    const mobileCSS = document.createElement("link");
    mobileCSS.rel = "stylesheet";
    mobileCSS.href = "/css/mobile.css";
    mobileCSS.media = "screen and (max-width: 767px)"; // Additional safety check

    mobileCSS.onload = () => {
      // Mark that mobile CSS has been loaded
      document.body.setAttribute("data-mobile-css-loaded", "true");
    };

    mobileCSS.onerror = () => {
      // Failed to load mobile CSS
    };

    document.head.appendChild(mobileCSS);
  }

  // Add device type classes to body for CSS targeting
  document.body.classList.add(
    device.isMobile ? "device-mobile" : "device-desktop",
  );
  if (device.isTablet) {
    document.body.classList.add("device-tablet");
  }
  document.body.classList.add(
    device.isTouchDevice ? "device-touch" : "device-mouse",
  );

  // Add capability classes
  if (!capabilities.supportsHover) {
    document.body.classList.add("no-hover");
  }
  if (capabilities.prefersReducedMotion) {
    document.body.classList.add("reduced-motion");
  }
  if (capabilities.prefersHighContrast) {
    document.body.classList.add("high-contrast");
  }
}

// Initialize on DOM ready
export function initMobileCSSLoader() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadMobileCSS);
  } else {
    // DOM already loaded
    loadMobileCSS();
  }
}
