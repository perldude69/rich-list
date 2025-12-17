// Mobile device detection utility
// Provides comprehensive device detection for mobile-specific CSS loading

export function detectDevice() {
  const userAgent = navigator.userAgent.toLowerCase();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Primary mobile detection via user agent
  const isMobileUA =
    /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
      userAgent,
    );

  // Screen size detection (phones typically < 768px width)
  const isSmallScreen = viewportWidth < 768;

  // Touch capability detection
  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;

  // Orientation detection
  const isPortrait = viewportHeight > viewportWidth;

  // Specific device type detection
  const isTablet =
    /ipad|tablet|android(?!.*mobile)/i.test(userAgent) ||
    (isMobileUA && viewportWidth >= 768 && viewportWidth < 1024);

  return {
    isMobile: isMobileUA && isSmallScreen,
    isTablet: isTablet,
    isTouchDevice: hasTouch,
    screenWidth: viewportWidth,
    screenHeight: viewportHeight,
    isPortrait,
    userAgent: userAgent,
  };
}

// Device capability detection for advanced feature support
export function getDeviceCapabilities() {
  return {
    supportsHover: window.matchMedia("(hover: hover)").matches,
    supportsPointerFine: window.matchMedia("(pointer: fine)").matches,
    supportsPointerCoarse: window.matchMedia("(pointer: coarse)").matches,
    pixelRatio: window.devicePixelRatio || 1,
    colorGamut: window.matchMedia("(color-gamut: p3)").matches ? "p3" : "srgb",
    prefersReducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches,
    prefersHighContrast: window.matchMedia("(prefers-contrast: high)").matches,
  };
}
