/* ===================================================================
   news.js — Loads news.json, renders hero/cards/category/article
   layouts. Exposes NewsStore for search.js / other pages.
=================================================================== */

const NewsStore = (() => {
  let cache = null;

  async function load(){
    if (cache) return cache;
    try{
      const res = await fetch('data/news.json');
      if (!res.ok) throw new Error('Failed to load news data');
      cache = await res.json();
    }catch(e){
      // Fallback path for pages nested one level deep (e.g. admin/)
      try{
        const res2 = await fetch('../data/news.json');
        cache = await res2.json();
      }catch(e2){
        console.error('Could not load news data', e2);
        cache = [];
      }
    }
    return cache;
  }

  function formatDate(iso){
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function cardHTML(item){
    return `
    <article class="news-card">
      <a class="thumb" href="article.html?slug=${item.slug}" aria-label="${item.title}">
        <img src="${item.image}" alt="${item.title}" loading="lazy">
        <span class="badge">${item.category}</span>
      </a>
      <div class="news-card-body">
        <h3><a href="article.html?slug=${item.slug}">${item.title}</a></h3>
        <p>${item.description}</p>
        <div class="card-footer">
          <span class="dateline">${formatDate(item.date)}</span>
          <span class="dateline">${item.author}</span>
        </div>
      </div>
    </article>`;
  }

  function sideStoryHTML(item){
    return `
    <div class="side-story">
      <img src="${item.image}" alt="${item.title}" loading="lazy">
      <div>
        <span class="dateline">${item.category}</span>
        <h3><a href="article.html?slug=${item.slug}">${item.title}</a></h3>
      </div>
    </div>`;
  }

  function skeletonCards(n){
    return Array.from({length:n}).map(() => `
      <div class="news-card"><div class="thumb skeleton skeleton-card"></div>
      <div class="news-card-body"><div class="skeleton" style="height:14px;width:80%;margin-bottom:8px;"></div>
      <div class="skeleton" style="height:12px;width:100%;"></div></div></div>`).join('');
  }

  /* ---------------- Homepage ---------------- */
  async function renderHome(){
    const grid = document.querySelector('#latest-news-grid');
    if (grid) grid.innerHTML = skeletonCards(8);
    const data = await load();

    // Hero
    const featured = data.filter(d => d.featured);
    const main = featured[0] || data[0];
    const heroFeature = document.querySelector('#hero-feature');
    if (heroFeature && main){
      heroFeature.innerHTML = `
        <a href="article.html?slug=${main.slug}"><img src="${main.image}" alt="${main.title}"></a>
        <div class="hero-feature-content">
          <span class="badge accent">${main.category}</span>
          <h1><a href="article.html?slug=${main.slug}">${main.title}</a></h1>
          <p class="excerpt">${main.description}</p>
          <div class="hero-meta">
            <span class="dateline"><strong>By</strong> ${main.author} — ${formatDate(main.date)}</span>
          </div>
          <a class="btn btn-accent" href="article.html?slug=${main.slug}">Read More →</a>
        </div>`;
    }
    const heroSide = document.querySelector('#hero-side');
    if (heroSide){
      const others = data.filter(d => d.id !== main.id).slice(0, 4);
      heroSide.innerHTML = others.map(sideStoryHTML).join('');
    }

    if (grid){
      grid.innerHTML = data.slice(0, 8).map(cardHTML).join('');
    }

    // Category strips
    document.querySelectorAll('[data-category-strip]').forEach(el => {
      const cat = el.getAttribute('data-category-strip');
      const items = data.filter(d => d.category === cat).slice(0, 3);
      el.innerHTML = items.map(cardHTML).join('') || '<p>No stories yet in this category.</p>';
    });
  }

  /* ---------------- Latest news page ---------------- */
  async function renderAllNews(){
    const grid = document.querySelector('#all-news-grid');
    if (!grid) return;
    grid.innerHTML = skeletonCards(8);
    const data = await load();
    grid.innerHTML = data.map(cardHTML).join('');
  }

  /* ---------------- Category page ---------------- */
  async function renderCategoryPage(){
    const params = new URLSearchParams(window.location.search);
    const cat = params.get('cat') || 'National';
    const data = await load();
    const items = data.filter(d => d.category === cat);

    document.querySelectorAll('[data-category-name]').forEach(el => el.textContent = cat);
    document.title = `${cat} News | Public Voice`;

    const featuredEl = document.querySelector('#category-featured');
    const supportingEl = document.querySelector('#category-supporting');
    if (!items.length){
      if (featuredEl) featuredEl.innerHTML = '<p style="padding:30px;">No stories published in this category yet.</p>';
      if (supportingEl) supportingEl.innerHTML = '';
      return;
    }
    const [first, ...rest] = items;
    if (featuredEl){
      featuredEl.innerHTML = `
        <a href="article.html?slug=${first.slug}"><img src="${first.image}" alt="${first.title}"></a>
        <div class="news-card-body">
          <span class="badge">${first.category}</span>
          <h3><a href="article.html?slug=${first.slug}">${first.title}</a></h3>
          <p>${first.description}</p>
          <div class="card-footer"><span class="dateline">${formatDate(first.date)}</span><span class="dateline">${first.author}</span></div>
        </div>`;
    }
    if (supportingEl){
      supportingEl.innerHTML = rest.map(cardHTML).join('') || '<p>More stories coming soon.</p>';
    }
  }

  /* ---------------- Article page ---------------- */
  async function renderArticlePage(){
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug');
    const data = await load();
    const article = data.find(d => d.slug === slug) || data[0];
    if (!article) return;

    document.title = `${article.title} | Public Voice`;
    const set = (sel, html) => { const el = document.querySelector(sel); if (el) el.innerHTML = html; };

    set('[data-article-category]', article.category);
    set('[data-article-title]', article.title);
    set('[data-article-subtitle]', article.subtitle || '');
    set('[data-article-author]', article.author);
    set('[data-article-date]', `Published: ${formatDate(article.date)}`);
    set('[data-article-updated]', `Updated: ${formatDate(article.updated || article.date)}`);
    set('[data-article-image]', `<img src="${article.image}" alt="${article.title}">`);
    const img = document.querySelector('[data-article-image] img');
    if (img) img.setAttribute('loading', 'eager');
    set('[data-article-caption]', `${article.title} — file photo.`);
    set('[data-article-body]', article.content.map(p => `<p>${p}</p>`).join(''));
    set('[data-article-tags]', article.tags.map(t => `<span class="tag">#${t}</span>`).join(''));

    // Related stories (same category, excluding current)
    const related = data.filter(d => d.category === article.category && d.id !== article.id).slice(0, 3);
    const relatedGrid = document.querySelector('#related-news-grid');
    if (relatedGrid) relatedGrid.innerHTML = related.map(cardHTML).join('') || '<p>No related stories yet.</p>';

    // Prev/Next navigation by id
    const idx = data.findIndex(d => d.id === article.id);
    const prev = data[idx - 1];
    const next = data[idx + 1];
    const prevEl = document.querySelector('#article-prev');
    const nextEl = document.querySelector('#article-next');
    if (prevEl){
      if (prev){ prevEl.href = `article.html?slug=${prev.slug}`; prevEl.querySelector('.title').textContent = prev.title; prevEl.style.visibility='visible'; }
      else prevEl.style.visibility = 'hidden';
    }
    if (nextEl){
      if (next){ nextEl.href = `article.html?slug=${next.slug}`; nextEl.querySelector('.title').textContent = next.title; nextEl.style.visibility='visible'; }
      else nextEl.style.visibility = 'hidden';
    }

    // Share links
    const url = window.location.href;
    const shareLinks = {
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(article.title)}&url=${encodeURIComponent(url)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(article.title + ' ' + url)}`
    };
    Object.entries(shareLinks).forEach(([k, href]) => {
      const el = document.querySelector(`[data-share="${k}"]`);
      if (el) el.href = href;
    });
  }

  /* ---------------- Videos page ---------------- */
  const VIDEO_DATA = [
    { id:'v1', title:'Inside the Digital Literacy Mission Rollout', category:'National', date:'2026-08-14', youtube:'dQw4w9WgXcQ', thumb:'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&q=80' },
    { id:'v2', title:'Explained: The Clean Energy Amendment Bill', category:'Politics', date:'2026-08-13', youtube:'dQw4w9WgXcQ', thumb:'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800&q=80' },
    { id:'v3', title:'Championship Final Highlights', category:'Sports', date:'2026-08-10', youtube:'dQw4w9WgXcQ', thumb:'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800&q=80' },
    { id:'v4', title:'Behind the Scenes at the Film Festival', category:'Entertainment', date:'2026-08-09', youtube:'dQw4w9WgXcQ', thumb:'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&q=80' },
    { id:'v5', title:'Coastal Cities and the Race Against Flooding', category:'Environment', date:'2026-08-08', youtube:'dQw4w9WgXcQ', thumb:'https://images.unsplash.com/photo-1500534623283-312aade485b7?w=800&q=80' },
    { id:'v6', title:'A Closer Look at the New Metro Lines', category:'National', date:'2026-08-04', youtube:'dQw4w9WgXcQ', thumb:'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&q=80' }
  ];

  function renderVideosPage(){
    const heroEl = document.querySelector('#video-hero');
    const gridEl = document.querySelector('#video-grid');
    if (!heroEl && !gridEl) return;
    const [first, ...rest] = VIDEO_DATA;
    if (heroEl){
      heroEl.innerHTML = `
        <div class="thumb"><img src="${first.thumb}" alt="${first.title}"><div class="play-btn" aria-hidden="true">▶</div></div>`;
      heroEl.addEventListener('click', () => openVideoModal(first.youtube, first.title));
      heroEl.style.cursor = 'pointer';
    }
    if (gridEl){
      gridEl.innerHTML = rest.map(v => `
        <div class="video-card" data-yt="${v.youtube}" data-title="${v.title}" style="cursor:pointer;">
          <div class="thumb"><img src="${v.thumb}" alt="${v.title}" loading="lazy"><div class="play-btn" aria-hidden="true">▶</div></div>
          <span class="badge">${v.category}</span>
          <h3>${v.title}</h3>
          <span class="dateline">${formatDate(v.date)}</span>
        </div>`).join('');
      gridEl.querySelectorAll('.video-card').forEach(card => {
        card.addEventListener('click', () => openVideoModal(card.dataset.yt, card.dataset.title));
      });
    }
  }

  function openVideoModal(youtubeId, title){
    let overlay = document.querySelector('#video-modal-overlay');
    if (!overlay){
      overlay = document.createElement('div');
      overlay.id = 'video-modal-overlay';
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `<div class="modal" style="max-width:820px;">
        <button class="modal-close" aria-label="Close video">✕</button>
        <h3 id="video-modal-title" style="margin-bottom:14px;"></h3>
        <div style="position:relative;padding-top:56.25%;">
          <iframe id="video-modal-frame" style="position:absolute;inset:0;width:100%;height:100%;border:0;" allowfullscreen></iframe>
        </div></div>`;
      document.body.appendChild(overlay);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) closeVideoModal(); });
      overlay.querySelector('.modal-close').addEventListener('click', closeVideoModal);
    }
    overlay.querySelector('#video-modal-title').textContent = title;
    overlay.querySelector('#video-modal-frame').src = `https://www.youtube.com/embed/${youtubeId}?autoplay=1`;
    overlay.classList.add('open');
  }
  function closeVideoModal(){
    const overlay = document.querySelector('#video-modal-overlay');
    if (!overlay) return;
    overlay.querySelector('#video-modal-frame').src = '';
    overlay.classList.remove('open');
  }

  return { load, formatDate, cardHTML, renderHome, renderAllNews, renderCategoryPage, renderArticlePage, renderVideosPage };
})();

document.addEventListener('DOMContentLoaded', () => {
  NewsStore.renderHome();
  NewsStore.renderAllNews();
  NewsStore.renderCategoryPage();
  NewsStore.renderArticlePage();
  NewsStore.renderVideosPage();
});
