import { chromium } from "playwright";

async function testSaveLoadPanel() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log("Navigating to application...");
    await page.goto("http://localhost:9876", { waitUntil: "networkidle" });

    // Wait for page to load
    await page.waitForTimeout(2000);

    // Check if disk icon exists
    const diskIcon = await page.$("#save-load-btn");
    console.log("Disk icon found:", !!diskIcon);

    if (diskIcon) {
      // Get disk icon visibility
      const isVisible = await diskIcon.isVisible();
      console.log("Disk icon is visible:", isVisible);

      // Get disk icon bounding box
      const boundingBox = await diskIcon.boundingBox();
      console.log("Disk icon bounding box:", boundingBox);

      // Check if panel exists
      const panel = await page.$("#save-load-panel");
      console.log("Panel element found:", !!panel);

      if (panel) {
        // Get panel visibility before click
        const panelVisibleBefore = await panel.isVisible();
        console.log("Panel visible BEFORE click:", panelVisibleBefore);

        // Get panel display CSS
        const panelDisplay = await panel.evaluate(
          (el) => window.getComputedStyle(el).display,
        );
        console.log("Panel display CSS (before):", panelDisplay);

        // Get panel z-index
        const panelZIndex = await panel.evaluate(
          (el) => window.getComputedStyle(el).zIndex,
        );
        console.log("Panel z-index:", panelZIndex);

        // Get panel position
        const panelPosition = await panel.evaluate(
          (el) => window.getComputedStyle(el).position,
        );
        console.log("Panel position:", panelPosition);

        // Get panel top
        const panelTop = await panel.evaluate(
          (el) => window.getComputedStyle(el).top,
        );
        console.log("Panel top:", panelTop);

        // Get panel right
        const panelRight = await panel.evaluate(
          (el) => window.getComputedStyle(el).right,
        );
        console.log("Panel right:", panelRight);

        // Get panel parent overflow
        const parentOverflow = await panel.evaluate(
          (el) => window.getComputedStyle(el.parentElement).overflow,
        );
        console.log("Parent overflow:", parentOverflow);

        // Click the disk icon
        console.log("\nClicking disk icon...");
        await diskIcon.click();

        // Wait a bit for animation
        await page.waitForTimeout(500);

        // Get panel visibility after click
        const panelVisibleAfter = await panel.isVisible();
        console.log("Panel visible AFTER click:", panelVisibleAfter);

        // Get panel display CSS after click
        const panelDisplayAfter = await panel.evaluate(
          (el) => window.getComputedStyle(el).display,
        );
        console.log("Panel display CSS (after):", panelDisplayAfter);

        // Get panel bounding box
        const panelBoundingBox = await panel.boundingBox();
        console.log("Panel bounding box (after click):", panelBoundingBox);

        // Check if panel has open class
        const hasOpenClass = await panel.evaluate((el) =>
          el.classList.contains("open"),
        );
        console.log('Panel has "open" class:', hasOpenClass);

        // Get parent wrapper info
        const parent = await panel.evaluate((el) => ({
          parentId: el.parentElement?.id,
          parentClass: el.parentElement?.className,
          parentPosition: window.getComputedStyle(el.parentElement).position,
          parentZIndex: window.getComputedStyle(el.parentElement).zIndex,
          parentOverflow: window.getComputedStyle(el.parentElement).overflow,
        }));
        console.log("Parent wrapper info:", parent);

        // Check all HTML to see panel structure
        const panelHTML = await panel.evaluate((el) =>
          el.outerHTML.substring(0, 300),
        );
        console.log("Panel HTML (first 300 chars):", panelHTML);
      }
    }

    // Take screenshot
    await page.screenshot({ path: "/tmp/panel-screenshot.png" });
    console.log("\nScreenshot saved to /tmp/panel-screenshot.png");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await browser.close();
  }
}

testSaveLoadPanel().catch(console.error);
