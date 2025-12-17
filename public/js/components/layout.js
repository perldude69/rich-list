// Layout Helper Component
// Provides shared layout utilities for all pages

import { renderNavbar, attachNavbarListeners } from './navbar.js';

export function renderPageLayout(content) {
  return `
    <div class="layout">
      ${renderNavbar()}
      <div class="main-content">
        <div class="container">
          ${content}
        </div>
      </div>
    </div>
  `;
}

export function initializePageLayout() {
  attachNavbarListeners();
  
  // Update active nav link
  const currentPath = window.location.pathname;
  document.querySelectorAll('.nav-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPath || href === '/' && currentPath === '/') {
      link.classList.add('active');
    } else if (href !== '/' && currentPath.startsWith(href)) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}
