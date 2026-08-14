/* ===================================================================
   search.js — Client-side search over headlines, categories,
   descriptions, and tags. Runs on news.html (Latest News page).
=================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.querySelector('#search-form-page');
  const input = document.querySelector('#search-input-page');
  const grid = document.querySelector('#all-news-grid');
  const infoEl = document.querySelector('#search-results-info');
  if (!form || !grid) return;

  const data = await NewsStore.load();

  function runSearch(query){
    const q = query.trim().toLowerCase();
    if (!q){
      grid.innerHTML = data.map(NewsStore.cardHTML).join('');
      if (infoEl) infoEl.textContent = `Showing all ${data.length} stories.`;
      return;
    }
    const results = data.filter(item => {
      const haystack = [
        item.title, item.category, item.description, item.subtitle || '',
        ...(item.tags || [])
      ].join(' ').toLowerCase();
      return haystack.includes(q);
    });

    if (infoEl) infoEl.textContent = `${results.length} result${results.length === 1 ? '' : 's'} for "${query}"`;

    if (!results.length){
      grid.innerHTML = `<div class="no-results" style="grid-column:1/-1;">
        <div class="icon">🔍</div>
        <h3>No news articles found.</h3>
        <p>Try a different keyword, category, or check your spelling.</p>
      </div>`;
      return;
    }
    grid.innerHTML = results.map(NewsStore.cardHTML).join('');
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    runSearch(input.value);
    const url = new URL(window.location);
    url.searchParams.set('q', input.value);
    window.history.replaceState({}, '', url);
  });

  input.addEventListener('input', () => runSearch(input.value));

  // Pre-fill from ?q= query param (e.g. from header search)
  const params = new URLSearchParams(window.location.search);
  const initialQ = params.get('q');
  if (initialQ){
    input.value = initialQ;
    runSearch(initialQ);
  } else {
    runSearch('');
  }
});
