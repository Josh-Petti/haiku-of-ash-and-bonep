(function () {
  'use strict';

  /**
   * Reader script for chapter pages
   * - injects top/bottom chapter nav if not present
   * - updates reading progress bar and percentage
   * - persists per-chapter scroll position/progress
   * - provides keyboard shortcuts: n (next), p (prev), t (toc)
   */

  function qs(sel, root = document) { return root.querySelector(sel); }
  function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

  function buildNavLinks(number, totalApprox = 30) {
    // number is numeric chapter index (1..n), prologue may be 0 or data-type="prologue"
    const prevNum = number > 1 ? number - 1 : null;
    const nextNum = number ? number + 1 : null;
    return { prevNum, nextNum };
  }

  function pathForIndex(num) {
    if (!num) return '../line1-patreonreader.html';
    // mapping: prologue might be 'prologue', but gated chapters use 'patreonchapter-X.html'
    if (num === 1) return 'patreonchapter-1.html';
    return `patreonchapter-${num}.html`;
  }

  function init() {
    const article = qs('article.chapter');
    if (!article) return; // not a chapter page

    const isComments = article.dataset.type === 'comments';

    const progressTrack = qs('.reading-progress__track');
    const progressBar = qs('.reading-progress__bar');
    const percentLabel = qs('.reading-progress__percent');

    // make sure progress UI exists; if not, create minimal one
    let progressRoot = qs('.reading-progress');
    if (!progressRoot) {
      progressRoot = document.createElement('div');
      progressRoot.className = 'reading-progress';
      progressRoot.innerHTML = '<span class="reading-progress__track"><span class="reading-progress__bar"></span></span><span class="reading-progress__percent" aria-hidden="true">0%</span>';
      // insert at top of main content
      const main = qs('main') || document.body;
      main.insertBefore(progressRoot, main.firstChild);
    }

    const track = qs('.reading-progress__track', progressRoot);
    const bar = qs('.reading-progress__bar', progressRoot);
    const percent = qs('.reading-progress__percent', progressRoot);

    // determine chapter index: prefer data-number, fallback to id or data-type
    const dataNumber = article.dataset.number ? parseInt(article.dataset.number, 10) : NaN;
    const isPrologue = article.dataset.type === 'prologue' || article.id === 'prologue';
    const chapterIndex = !isNaN(dataNumber) ? dataNumber : (isPrologue ? 0 : null);
    const storageKey = `ashbones:act1:chapter:${ (chapterIndex === 0 ? 'prologue' : (chapterIndex||article.id)) }:scroll`;

    // inject simple nav if not present
    function injectNav(position = 'top') {
      const sel = position === 'top' ? '.chapter-top-nav' : '.chapter-nav';
      if (qs(sel)) return; // keep existing nav if present

      const nav = document.createElement('nav');
      nav.className = position === 'top' ? 'chapter-top-nav' : 'chapter-nav';
      nav.setAttribute('aria-label', position === 'top' ? 'Chapter top navigation' : 'Chapter navigation');

      const { prevNum, nextNum } = buildNavLinks(chapterIndex);

      // previous link
      if (prevNum !== null && prevNum !== undefined && prevNum > 0) {
        const aPrev = document.createElement('a');
        aPrev.href = pathForIndex(prevNum);
        aPrev.textContent = 'Previous';
        aPrev.dataset.role = 'prev';
        nav.appendChild(aPrev);
      } else {
        const aPrev = document.createElement('a');
        aPrev.href = '../line1-patreonreader.html';
        aPrev.textContent = 'Table of Contents';
        nav.appendChild(aPrev);
      }

      // TOC link always in middle
      const aToc = document.createElement('a');
      aToc.href = '../line1-patreonreader.html';
      aToc.textContent = 'Table of Contents';
      aToc.setAttribute('aria-label', 'Back to Act I table of contents');
      nav.appendChild(aToc);

      // next link
      if (nextNum) {
        const aNext = document.createElement('a');
        aNext.href = pathForIndex(nextNum);
        aNext.textContent = 'Next';
        aNext.dataset.role = 'next';
        nav.appendChild(aNext);
      } else {
        // if no clear next, don't show a broken link; fetch a safe fallback
        const aNext = document.createElement('a');
        aNext.href = '../line1-patreonreader.html';
        aNext.textContent = 'End of Act';
        nav.appendChild(aNext);
      }

      // insert nav into DOM
      if (position === 'top') {
        article.parentElement.insertBefore(nav, article);
      } else {
        // bottom
        article.parentElement.insertBefore(nav.cloneNode(true), article.nextSibling);
      }
    }

    if (!isComments) {
      const hasCustomTopNav = !!qs('.chapter-top-nav');
      if (!hasCustomTopNav) {
        injectNav('top');
        injectNav('bottom');
      }
    }

    // ensure nav controls are visible and toggles wired up
    qsa('.chapter-top-nav, .chapter-nav').forEach((navEl) => {
      navEl.classList.add('is-visible');
      const toggle = qs('.chapter-nav-toggle', navEl);
      const links =
        qs('.chapter-top-nav__links', navEl) ||
        qs('.chapter-nav__links', navEl);
      if (toggle && links) {
        toggle.addEventListener('click', () => {
          const expanded = toggle.getAttribute('aria-expanded') === 'true';
          toggle.setAttribute('aria-expanded', String(!expanded));
          navEl.classList.toggle('is-open', !expanded);
          links.classList.toggle('is-expanded', !expanded);
        });
      }
    });

    // restore saved scroll position (if within same origin)
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const val = parseFloat(saved);
        if (!Number.isNaN(val) && val > 0 && val < 1) {
          // set scroll to percentage of document height
          const y = Math.floor((document.documentElement.scrollHeight - window.innerHeight) * val);
          window.scrollTo(0, y);
        }
      }
    } catch (e) { /* ignore storage errors */ }

    // update progress on scroll: compute article visible percentage
    function updateProgress() {
      const rect = article.getBoundingClientRect();
      const windowH = window.innerHeight;
      // article height clipped by viewport
      const visible = Math.max(0, Math.min(rect.bottom, windowH) - Math.max(rect.top, 0));
      const percentVisible = Math.round((visible / rect.height) * 100);
      const clamped = Math.max(0, Math.min(100, percentVisible));
      bar.style.width = clamped + '%';
      percent.textContent = clamped + '%';
      // persist small value (0..1) for resume
      try { localStorage.setItem(storageKey, String(clamped / 100)); } catch (e) {}
    }

    let ticking = false;
    function onScroll() {
      if (!ticking) {
        window.requestAnimationFrame(() => { updateProgress(); ticking = false; });
        ticking = true;
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    // initial update
    updateProgress();

    // keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      if (e.key === 'n') {
        const next = qs('.chapter-nav a[data-role="next"], .chapter-top-nav a[data-role="next"]');
        if (next) { location.href = next.href; }
      } else if (e.key === 'p') {
        const prev = qs('.chapter-nav a[data-role="prev"], .chapter-top-nav a[data-role="prev"]');
        if (prev) { location.href = prev.href; }
      } else if (e.key === 't') {
        const toc = qs('.chapter-nav a[href*="line1-patreonreader.html"], .chapter-top-nav a[href*="line1-patreonreader.html"]');
        if (toc) { location.href = toc.href; }
      }
    });

    // Small API
    window.AshBonesReader = {
      updateProgress,
      storageKey
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
