// Rich-List Router
// Client-side routing using History API

import store from "./store.js";

class Router {
  constructor() {
    this.routes = new Map();
    this.notFoundHandler = null;
    this.currentRoute = null;
    this.beforeHooks = [];
    this.afterHooks = [];

    // Handle browser back/forward buttons
    window.addEventListener("popstate", (e) => {
      this.navigateToPath(window.location.pathname);
    });
  }

  // Register a route
  route(path, handler, meta = {}) {
    this.routes.set(path, { handler, meta, path });
  }

  // Define 404 handler
  notFound(handler) {
    this.notFoundHandler = handler;
  }

  // Register before navigation hook
  before(hook) {
    this.beforeHooks.push(hook);
  }

  // Register after navigation hook
  after(hook) {
    this.afterHooks.push(hook);
  }

  // Navigate to path
  async navigateToPath(path) {
    const route = this.findRoute(path);

    if (!route && !this.notFoundHandler) {
      return;
    }

    // Run before hooks
    for (const hook of this.beforeHooks) {
      const proceed = await hook(route);
      if (proceed === false) {
        return;
      }
    }

    if (route) {
      // Update browser history
      window.history.pushState({ path }, "", path);

      // Render the component
      await route.handler();

      // Update store
      const pageName = path.substring(1) || "search";
      store.navigateTo(pageName);
    } else if (this.notFoundHandler) {
      await this.notFoundHandler();
    }

    // Run after hooks
    for (const hook of this.afterHooks) {
      await hook(route);
    }

    this.currentRoute = route;
  }

  // Navigate using link click
  async navigate(path) {
    if (window.location.pathname === path) return;
    await this.navigateToPath(path);
  }

  // Find route by path
  findRoute(path) {
    // Exact match
    if (this.routes.has(path)) {
      return this.routes.get(path);
    }

    // Pattern match (e.g., /account/:id)
    for (const [routePath, route] of this.routes) {
      const regex = this.pathToRegex(routePath);
      const match = path.match(regex);
      if (match) {
        return { ...route, params: this.extractParams(routePath, match) };
      }
    }

    return null;
  }

  // Convert path pattern to regex
  pathToRegex(path) {
    const pattern = path.replace(/\//g, "\\/").replace(/:(\w+)/g, "([^/]+)");
    return new RegExp(`^${pattern}$`);
  }

  // Extract params from route match
  extractParams(pattern, match) {
    const paramNames = (pattern.match(/:(\w+)/g) || []).map((p) =>
      p.substring(1),
    );
    const params = {};
    paramNames.forEach((name, index) => {
      params[name] = match[index + 1];
    });
    return params;
  }

  // Generate URL from route pattern
  generatePath(pattern, params = {}) {
    let path = pattern;
    Object.entries(params).forEach(([key, value]) => {
      path = path.replace(`:${key}`, value);
    });
    return path;
  }

  // Initialize router
  init() {
    // Intercept link clicks
    document.addEventListener("click", (e) => {
      const link = e.target.closest('a[href^="/"]');
      if (link && !link.hasAttribute("data-external")) {
        e.preventDefault();
        this.navigate(link.getAttribute("href"));
      }
    });

    // Navigate to current path
    this.navigateToPath(window.location.pathname);
  }

  // Get current route
  getCurrentRoute() {
    return this.currentRoute;
  }

  // Back navigation
  back() {
    window.history.back();
  }

  // Forward navigation
  forward() {
    window.history.forward();
  }
}

// Create and export singleton
const router = new Router();

// Define routes
router.route("/", async () => {
  const { RichSearch } = await import("./pages/RichSearch.js");
  const component = new RichSearch();
  await component.render();
});

router.route("/price-chart", async () => {
  const { PriceChart } = await import("./pages/PriceChart.js");
  const component = new PriceChart();
  await component.render();
});

router.route("/stats", async () => {
  const { CurrentStats } = await import("./pages/CurrentStats.js");
  const component = new CurrentStats();
  await component.render();
});

router.route("/richsearch", async () => {
  const { RichSearch } = await import("./pages/RichSearch.js");
  const component = new RichSearch();
  await component.render();
});

router.route("/historic", async () => {
  const { Historic } = await import("./pages/Historic.js");
  const component = new Historic();
  await component.render();
});

router.route("/escrow", async () => {
  const { EscrowCalendar } = await import("./pages/EscrowCalendar.js");
  const component = new EscrowCalendar();
  await component.render();
});

router.route("/account/:id", async () => {
  const { RichSearch } = await import("./pages/RichSearch.js");
  const component = new RichSearch();
  await component.render();
});

// 404 handler
router.notFound(async () => {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="layout">
      <div class="main-content">
        <div class="container text-center mt-3">
          <h1>404 - Page Not Found</h1>
          <p>The page you're looking for doesn't exist.</p>
          <a href="/" class="btn btn-primary">Back to Home</a>
        </div>
      </div>
    </div>
  `;
});

// Before hook - show loading state
router.before(async (route) => {
  store.setLoading(true);
  return true;
});

// After hook - hide loading state
router.after(async (route) => {
  store.setLoading(false);
});

export { router, Router };
export default router;
