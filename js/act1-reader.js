(function () {
  'use strict';

  /**
   * Act 1 TOC script
   * - debounce search input
   * - persist last-read chapter index and visually mark the card
   * - keyboard arrow navigation among visible cards
   */

  function debounce(fn, wait = 180) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
  }

  function init() {
    const search = document.getElementById('chapter-search');
    const grid = document.getElementById('toc-grid');
    const countEl = document.getElementById('chapter-count');
    const progress = document.getElementById('act-progress');
    const clearBtn = document.getElementById('clear-progress');
    const yearEl = document.getElementById('year');

    if (!grid || !countEl || !progress || !yearEl) return;

    const items = Array.from(grid.querySelectorAll('a.toc-card'));
    const total = items.length;
    yearEl.textContent = new Date().getFullYear();

    // update visible count text
    function updateCount(visible) {
      countEl.textContent = visible + (visible === 1 ? ' chapter' : ' chapters');
    }

    // mark a card as last-read and persist the index
    function setProgress(index) {
      if (!index) return;
      localStorage.setItem('act1-last-read', String(index));
      progress.value = Math.min(total, index);
      progress.setAttribute('aria-valuenow', String(progress.value));
      // mark visually
      items.forEach(a => a.removeAttribute('data-last'));
      const last = items.find(a => (parseInt(a.dataset.index, 10) || 0) === index);
      if (last) last.setAttribute('data-last', 'true');
    }

    // restore last-read and highlight
    const saved = parseInt(localStorage.getItem('act1-last-read'), 10);
    if (!isNaN(saved)) setProgress(saved);

    // filter function used by search (case-insensitive)
    function filter(q = '') {
      const term = String(q).trim().toLowerCase();
      let visible = 0;
      items.forEach(a => {
        const title = (a.dataset.title || a.textContent || '').toLowerCase();
        const label = (a.querySelector('.toc-card__label')?.textContent || '').toLowerCase();
        const chapter = (a.dataset.chapter || '').toLowerCase();
        const matches = !term || title.includes(term) || label.includes(term) || chapter.includes(term);
        if (a.parentElement) a.parentElement.style.display = matches ? '' : 'none';
        if (matches) visible++;
      });
      updateCount(visible);
    }

    // debounce the search to reduce layout churn
    const debouncedFilter = debounce((val) => filter(val), 140);
    if (search) {
      search.addEventListener('input', e => debouncedFilter(e.target.value));
      // allow pressing / to focus search
      document.addEventListener('keydown', (e) => { if (e.key === '/' && document.activeElement !== search) { e.preventDefault(); search.focus(); } });
    }

    // click handler: record progress when a chapter is opened
    items.forEach(a => {
      a.addEventListener('click', () => {
        const idx = parseInt(a.dataset.index, 10) || 0;
        setProgress(idx);
      });
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        localStorage.removeItem('act1-last-read');
        progress.value = 0;
        progress.setAttribute('aria-valuenow', '0');
        items.forEach(a => a.removeAttribute('data-last'));
      });
    }

    // keyboard navigation: arrow keys cycle through visible cards
    let focusedIndex = -1;
    document.addEventListener('keydown', (e) => {
      // ignore when typing into inputs
      if (/input|textarea/i.test(document.activeElement?.tagName)) return;
      const visibleItems = items.filter(a => a.parentElement && a.parentElement.style.display !== 'none');
      if (!visibleItems.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        focusedIndex = (focusedIndex + 1) % visibleItems.length;
        visibleItems[focusedIndex].focus();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        focusedIndex = (focusedIndex - 1 + visibleItems.length) % visibleItems.length;
        visibleItems[focusedIndex].focus();
      }
    });

    // initial count
    updateCount(total);
    window.AshBones = { filter, setProgress };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
