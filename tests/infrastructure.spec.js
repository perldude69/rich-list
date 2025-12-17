import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:9876';

test.describe('Rich-List SPA - Infrastructure Tests', () => {
  
  test.describe('Server & API Health', () => {
    test('server is running', async ({ page }) => {
      const response = await page.goto(BASE_URL);
      expect(response.status()).toBe(200);
    });

    test('health endpoint responds', async ({ page }) => {
      const response = await page.goto(`${BASE_URL}/api/health`);
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.status).toBe('ok');
      expect(body.database).toBe('connected');
    });

    test('stats endpoint responds', async ({ page }) => {
      const response = await page.goto(`${BASE_URL}/api/stats`);
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
    });

    test('richlist endpoint responds', async ({ page }) => {
      const response = await page.goto(`${BASE_URL}/api/richlist`);
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });
  });

  test.describe('Frontend Infrastructure', () => {
    test('main page loads', async ({ page }) => {
      await page.goto(BASE_URL);
      const title = await page.title();
      expect(title).toContain('Rich-List');
    });

    test('navbar is visible', async ({ page }) => {
      await page.goto(BASE_URL);
      const navbar = await page.$('.navbar');
      expect(navbar).not.toBeNull();
    });

    test('navigation links present', async ({ page }) => {
      await page.goto(BASE_URL);
      const links = await page.locator('a.nav-link').count();
      expect(links).toBeGreaterThanOrEqual(6);
    });

    test('CSS framework loaded', async ({ page }) => {
      await page.goto(BASE_URL);
      const cssLoaded = await page.evaluate(() => {
        return document.styleSheets.length > 0;
      });
      expect(cssLoaded).toBe(true);
    });

    test('app container exists', async ({ page }) => {
      await page.goto(BASE_URL);
      const app = await page.$('#app');
      expect(app).not.toBeNull();
    });
  });

  test.describe('Router Functionality', () => {
    test('navigate to dashboard', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.click('a[href="/dashboard"]');
      await page.waitForLoadState('networkidle');
      const url = page.url();
      expect(url).toContain('/dashboard');
    });

    test('navigate to richlist', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.click('a[href="/richlist"]');
      await page.waitForLoadState('networkidle');
      const url = page.url();
      expect(url).toContain('/richlist');
    });

    test('navigate to price-chart', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.click('a[href="/price-chart"]');
      await page.waitForLoadState('networkidle');
      const url = page.url();
      expect(url).toContain('/price-chart');
    });

    test('navigate to stats', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.click('a[href="/stats"]');
      await page.waitForLoadState('networkidle');
      const url = page.url();
      expect(url).toContain('/stats');
    });

    test('navigate to historic', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.click('a[href="/historic"]');
      await page.waitForLoadState('networkidle');
      const url = page.url();
      expect(url).toContain('/historic');
    });

    test('navigate to escrow', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.click('a[href="/escrow"]');
      await page.waitForLoadState('networkidle');
      const url = page.url();
      expect(url).toContain('/escrow');
    });

    test('no full page reloads', async ({ page, context }) => {
      let navigationCount = 0;
      page.on('load', () => navigationCount++);

      await page.goto(BASE_URL);
      const initialNavigations = navigationCount;

      await page.click('a[href="/dashboard"]');
      await page.waitForLoadState('networkidle');

      // Should not reload entire page (no additional 'load' event)
      expect(navigationCount).toBe(initialNavigations);
    });
  });

  test.describe('State Management', () => {
    test('store is accessible', async ({ page }) => {
      await page.goto(BASE_URL);
      const storeExists = await page.evaluate(() => {
        return window.richListApp && window.richListApp.store !== undefined;
      });
      expect(storeExists).toBe(true);
    });

    test('store has getState method', async ({ page }) => {
      await page.goto(BASE_URL);
      const hasGetState = await page.evaluate(() => {
        return typeof window.richListApp.store.getState === 'function';
      });
      expect(hasGetState).toBe(true);
    });

    test('store has setState method', async ({ page }) => {
      await page.goto(BASE_URL);
      const hasSetState = await page.evaluate(() => {
        return typeof window.richListApp.store.setState === 'function';
      });
      expect(hasSetState).toBe(true);
    });

    test('store state updates', async ({ page }) => {
      await page.goto(BASE_URL);
      const stateUpdated = await page.evaluate(() => {
        window.richListApp.store.setState({ testValue: 'phase1' });
        return window.richListApp.store.getState('testValue') === 'phase1';
      });
      expect(stateUpdated).toBe(true);
    });

    test('store subscribe works', async ({ page }) => {
      await page.goto(BASE_URL);
      const subscribeWorks = await page.evaluate(() => {
        return new Promise(resolve => {
          const unsub = window.richListApp.store.subscribe(() => {
            resolve(true);
          });
          window.richListApp.store.setState({ subscribeTest: true });
        });
      });
      expect(subscribeWorks).toBe(true);
    });
  });

  test.describe('API Client', () => {
    test('api is accessible', async ({ page }) => {
      await page.goto(BASE_URL);
      const apiExists = await page.evaluate(() => {
        return window.richListApp && window.richListApp.api !== undefined;
      });
      expect(apiExists).toBe(true);
    });

    test('api has get method', async ({ page }) => {
      await page.goto(BASE_URL);
      const hasGet = await page.evaluate(() => {
        return typeof window.richListApp.api.get === 'function';
      });
      expect(hasGet).toBe(true);
    });

    test('api health call succeeds', async ({ page }) => {
      await page.goto(BASE_URL);
      const healthResponse = await page.evaluate(async () => {
        const response = await window.richListApp.api.health();
        return response.status === 'ok';
      });
      expect(healthResponse).toBe(true);
    });

    test('api caching works', async ({ page }) => {
      await page.goto(BASE_URL);
      const cachingWorks = await page.evaluate(async () => {
        const cache1 = window.richListApp.api.getCacheInfo();
        await window.richListApp.api.health();
        const cache2 = window.richListApp.api.getCacheInfo();
        return cache2.size > cache1.size;
      });
      expect(cachingWorks).toBe(true);
    });

    test('api getRichList works', async ({ page }) => {
      await page.goto(BASE_URL);
      const getRichListWorks = await page.evaluate(async () => {
        const response = await window.richListApp.api.getRichList(10, 0);
        return response.success === true;
      });
      expect(getRichListWorks).toBe(true);
    });
  });

  test.describe('Socket.IO', () => {
    test('socket is accessible', async ({ page }) => {
      await page.goto(BASE_URL);
      const socketExists = await page.evaluate(() => {
        return window.richListApp && window.richListApp.socket !== undefined;
      });
      expect(socketExists).toBe(true);
    });

    test('socket has connect method', async ({ page }) => {
      await page.goto(BASE_URL);
      const hasConnect = await page.evaluate(() => {
        return typeof window.richListApp.socket.connect === 'function';
      });
      expect(hasConnect).toBe(true);
    });

    test('socket connects successfully', async ({ page }) => {
      await page.goto(BASE_URL);
      const isConnected = await page.evaluate(async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return window.richListApp.socket.isConnected;
      });
      expect(isConnected).toBe(true);
    });

    test('socket has event methods', async ({ page }) => {
      await page.goto(BASE_URL);
      const hasMethods = await page.evaluate(() => {
        const socket = window.richListApp.socket;
        return (
          typeof socket.on === 'function' &&
          typeof socket.off === 'function' &&
          typeof socket.emit === 'function'
        );
      });
      expect(hasMethods).toBe(true);
    });

    test('socket subscriptions work', async ({ page }) => {
      await page.goto(BASE_URL);
      const subscribeWorks = await page.evaluate(async () => {
        window.richListApp.socket.subscribeStats();
        await new Promise(resolve => setTimeout(resolve, 500));
        const status = window.richListApp.socket.getStatus();
        return status.subscriptionCount > 0;
      });
      expect(subscribeWorks).toBe(true);
    });
  });

  test.describe('Router Configuration', () => {
    test('router is accessible', async ({ page }) => {
      await page.goto(BASE_URL);
      const routerExists = await page.evaluate(() => {
        return window.richListApp && window.richListApp.router !== undefined;
      });
      expect(routerExists).toBe(true);
    });

    test('router has navigate method', async ({ page }) => {
      await page.goto(BASE_URL);
      const hasNavigate = await page.evaluate(() => {
        return typeof window.richListApp.router.navigate === 'function';
      });
      expect(hasNavigate).toBe(true);
    });

    test('router has 7+ routes', async ({ page }) => {
      await page.goto(BASE_URL);
      const routeCount = await page.evaluate(() => {
        return window.richListApp.router.routes.size;
      });
      expect(routeCount).toBeGreaterThanOrEqual(7);
    });

    test('404 handler exists', async ({ page }) => {
      await page.goto(`${BASE_URL}/nonexistent-page-xyz`);
      const has404 = await page.evaluate(() => {
        return document.body.innerHTML.includes('404') || 
               document.body.innerHTML.includes('not found');
      });
      expect(has404).toBe(true);
    });
  });

  test.describe('Pages Load Without Errors', () => {
    const pages = [
      { path: '/', name: 'Search' },
      { path: '/dashboard', name: 'Dashboard' },
      { path: '/richlist', name: 'Rich List' },
      { path: '/price-chart', name: 'Price Chart' },
      { path: '/stats', name: 'Stats' },
      { path: '/historic', name: 'Historic' },
      { path: '/escrow', name: 'Escrow' }
    ];

    pages.forEach(({ path, name }) => {
      test(`${name} page loads without errors`, async ({ page }) => {
        await page.goto(`${BASE_URL}${path}`);
        const hasError = await page.evaluate(() => {
          return window.richListApp && window.richListApp.store && 
                 window.richListApp.store.getState('error') !== null;
        });
        expect(hasError).toBe(false);
      });
    });
  });

  test.describe('Console & Error Handling', () => {
    test('no console errors on load', async ({ page }) => {
      const errors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      
      await page.goto(BASE_URL);
      expect(errors.length).toBe(0);
    });

    test('no network errors', async ({ page }) => {
      const errors = [];
      page.on('requestfailed', request => {
        errors.push(request.url());
      });
      
      await page.goto(BASE_URL);
      expect(errors.length).toBe(0);
    });
  });
});
