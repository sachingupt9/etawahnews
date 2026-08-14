/* ===================================================================
   main.js — Navigation, mobile menu, theme, breaking-news ticker,
   toast notifications, date display. Loaded on every page.
=================================================================== */

const PV = (() => {

  const API_BASE = 'http://localhost:4000/api';

  /* ---------------- Theme ---------------- */
  function initTheme(){
    const saved = localStorage.getItem('pv-theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    const toggle = document.querySelector('.theme-toggle');
    if (toggle){
      toggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('pv-theme', next);
      });
    }
  }

  /* ---------------- Mobile nav ---------------- */
  function initMobileNav(){
    const hamburger = document.querySelector('.hamburger');
    const navList = document.querySelector('.nav-list');
    if (!hamburger || !navList) return;
    hamburger.addEventListener('click', () => {
      const isOpen = navList.classList.toggle('open');
      hamburger.setAttribute('aria-expanded', isOpen);
    });
  }

  /* ---------------- Search panel toggle ---------------- */
  function initSearchToggle(){
    const btn = document.querySelector('.search-toggle');
    const panel = document.querySelector('.search-panel');
    if (!btn || !panel) return;
    btn.addEventListener('click', () => {
      panel.classList.toggle('open');
      if (panel.classList.contains('open')){
        panel.querySelector('input')?.focus();
      }
    });
    const form = panel.querySelector('form');
    if (form){
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const q = form.querySelector('input').value.trim();
        if (q) window.location.href = `news.html?q=${encodeURIComponent(q)}`;
      });
    }
  }

  /* ---------------- Live date ---------------- */
  function renderDate(){
    const el = document.querySelector('[data-current-date]');
    if (!el) return;
    const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    el.textContent = new Date().toLocaleDateString('en-US', opts);
  }

  /* ---------------- Breaking news ticker ---------------- */
  function initTicker(){
    const track = document.querySelector('.ticker-track');
    if (!track) return;
    const items = [
      'Government announces new nationwide digital literacy mission with free training centres.',
      'Parliament passes Clean Energy Amendment Bill, setting 50% renewable target by 2032.',
      'Central bank holds interest rates steady, citing easing inflation.',
      'National team clinches regional championship title in dramatic final.',
      'Coastal cities expand flood-resilience infrastructure ahead of monsoon season.'
    ];
    let idx = 0;
    const nodes = items.map((text, i) => {
      const div = document.createElement('div');
      div.className = 'ticker-item' + (i === 0 ? ' active' : '');
      div.textContent = text;
      track.appendChild(div);
      return div;
    });
    setInterval(() => {
      nodes[idx].classList.remove('active');
      idx = (idx + 1) % nodes.length;
      nodes[idx].classList.add('active');
    }, 4500);
  }

  /* ---------------- Toast notifications ---------------- */
  function ensureToastContainer(){
    let c = document.querySelector('.toast-container');
    if (!c){
      c = document.createElement('div');
      c.className = 'toast-container';
      c.setAttribute('role', 'status');
      c.setAttribute('aria-live', 'polite');
      document.body.appendChild(c);
    }
    return c;
  }

  function toast(message, type = 'info', duration = 4500){
    const c = ensureToastContainer();
    const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${icons[type] || icons.info}</span><span>${message}</span><button class="toast-close" aria-label="Dismiss">✕</button>`;
    c.appendChild(el);
    const remove = () => { el.style.opacity = '0'; setTimeout(() => el.remove(), 200); };
    el.querySelector('.toast-close').addEventListener('click', remove);
    setTimeout(remove, duration);
  }

  /* ---------------- Active nav link highlighting ---------------- */
  function highlightActiveNav(){
    const path = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-list a').forEach(a => {
      const href = a.getAttribute('href');
      if (href === path) a.classList.add('active');
    });
  }

  function init(){
    initTheme();
    initMobileNav();
    initSearchToggle();
    renderDate();
    initTicker();
    highlightActiveNav();
  }

  document.addEventListener('DOMContentLoaded', init);

  return { toast, API_BASE };
})();
