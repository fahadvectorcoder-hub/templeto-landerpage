/* =========================================================
   TEMPLETO – page scripts
   Everything is wrapped in one IIFE (no globals) and every
   feature finds its elements through `data-tp-*` attributes,
   then quietly skips itself if they aren't on the page.
   ========================================================= */
(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.remove('tp-no-js');

  var $  = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  /* ---------- Footer year ---------- */
  function initYear() {
    $$('[data-tp-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
  }

  /* ---------- Header: frosted background after scrolling ---------- */
  function initHeader() {
    var header = $('[data-tp-header]');
    if (!header) return;
    var onScroll = function () { header.classList.toggle('is-scrolled', window.scrollY > 24); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Mobile menu ---------- */
  function initMobileMenu() {
    var toggle = $('[data-tp-menu-toggle]');
    var menu = $('[data-tp-menu]');
    if (!toggle || !menu) return;

    var setOpen = function (open) {
      menu.classList.toggle('hidden', !open);
      toggle.setAttribute('aria-expanded', String(open));
    };
    toggle.addEventListener('click', function () { setOpen(menu.classList.contains('hidden')); });
    $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { setOpen(false); }); });
  }

  /* ---------- Active nav link follows the section in view ---------- */
  function initScrollSpy() {
    var links = $$('[data-tp-nav-link]');
    var sections = $$('main section[id]');
    if (!links.length || !sections.length || !('IntersectionObserver' in window)) return;

    // the hero (#home) highlights the links marked data-tp-nav-home
    var setActive = function (id) {
      links.forEach(function (l) {
        var on = id === 'home' ? l.hasAttribute('data-tp-nav-home') : l.getAttribute('href') === '#' + id;
        l.classList.toggle('is-active', on);
      });
    };
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) setActive(e.target.id); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(function (s) { spy.observe(s); });
  }

  /* ---------- Scroll-reveal animations ---------- */
  function initReveal() {
    var items = $$('[data-tp-reveal]');
    if (!items.length) return;
    if (!('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-visible');
        io.unobserve(e.target);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    items.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Hero: dismiss purchase notification ---------- */
  function initToast() {
    $$('[data-tp-toast]').forEach(function (toast) {
      var close = $('[data-tp-toast-close]', toast);
      if (!close) return;
      close.addEventListener('click', function () {
        toast.classList.add('is-dismissed');
        setTimeout(function () { toast.remove(); }, 500);
      });
    });
  }

  /* ---------- Tabs that swap a preview image ----------
     <div data-tp-tabs>
       <button data-tp-tab data-tp-image="…" data-tp-alt="…">…</button>
       <img data-tp-tab-image>
     </div>                                                  */
  function initTabs() {
    $$('[data-tp-tabs]').forEach(function (group) {
      var tabs = $$('[data-tp-tab]', group);
      var img = $('[data-tp-tab-image]', group);
      if (!tabs.length || !img) return;

      var select = function (tab, focus) {
        if (tab.classList.contains('is-active')) return;
        tabs.forEach(function (t) {
          var on = t === tab;
          t.classList.toggle('is-active', on);
          t.setAttribute('aria-selected', String(on));
          t.tabIndex = on ? 0 : -1;
        });
        if (focus) tab.focus();

        var src = tab.getAttribute('data-tp-image');
        img.classList.add('is-switching');
        setTimeout(function () {
          var done = function () { img.classList.remove('is-switching'); };
          img.alt = tab.getAttribute('data-tp-alt') || img.alt;
          if (!src || img.getAttribute('src') === src) { done(); return; }
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
          img.src = src;
        }, 300);
      };

      tabs.forEach(function (tab, i) {
        tab.addEventListener('click', function () { select(tab, false); });
        tab.addEventListener('keydown', function (e) {
          var next = null;
          if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
          if (e.key === 'ArrowLeft')  next = tabs[(i - 1 + tabs.length) % tabs.length];
          if (e.key === 'Home') next = tabs[0];
          if (e.key === 'End')  next = tabs[tabs.length - 1];
          if (next) { e.preventDefault(); select(next, true); }
        });
      });
    });
  }

  /* ---------- Filterable grid (demos) ----------
     <div data-tp-filter-group>
       <button data-tp-filter="all|fashion|…">…</button>
       <ul><li data-tp-item data-tp-cats="fashion footwear">…</li></ul>
       <p data-tp-filter-empty hidden>…</p>
     </div>
     Animation uses the Web Animations API, so no inline styles
     are written into the markup.                                   */
  function initFilter() {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var ease = 'cubic-bezier(.22, 1, .36, 1)';

    $$('[data-tp-filter-group]').forEach(function (group) {
      var buttons = $$('[data-tp-filter]', group);
      var items = $$('[data-tp-item]', group);
      var empty = $('[data-tp-filter-empty]', group);
      if (!buttons.length || !items.length) return;

      var run = 0; // cancels an in-flight transition when another tab is clicked

      var matches = function (item, cat) {
        if (cat === 'all') return true;
        return (' ' + (item.getAttribute('data-tp-cats') || '') + ' ').indexOf(' ' + cat + ' ') > -1;
      };

      var animate = function (el, frames, opts) {
        if (reduce || !el.animate) return Promise.resolve();
        return el.animate(frames, opts).finished.catch(function () {});
      };

      var apply = function (cat) {
        var id = ++run;
        var leaving = items.filter(function (el) { return !el.hidden; });

        // make sure scroll-reveal never keeps a filtered card invisible
        items.forEach(function (el) { el.classList.add('is-visible'); });

        Promise.all(leaving.map(function (el) {
          return animate(el,
            [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(16px) scale(.96)' }],
            { duration: 220, easing: 'ease-in', fill: 'forwards' });
        })).then(function () {
          if (id !== run) return;
          var shown = 0;
          items.forEach(function (el) {
            el.getAnimations && el.getAnimations().forEach(function (a) { a.cancel(); });
            var on = matches(el, cat);
            el.hidden = !on;
            if (!on) return;
            animate(el,
              [{ opacity: 0, transform: 'translateY(36px) scale(.96)' }, { opacity: 1, transform: 'none' }],
              { duration: 650, delay: Math.min(shown, 11) * 60, easing: ease, fill: 'backwards' });
            shown++;
          });
          if (empty) empty.hidden = shown > 0;
        });
      };

      buttons.forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (btn.classList.contains('is-active')) return;
          buttons.forEach(function (b) {
            var on = b === btn;
            b.classList.toggle('is-active', on);
            b.setAttribute('aria-pressed', String(on));
          });
          // keep the active pill centred when the bar scrolls sideways (mobile)
          var bar = btn.parentElement;
          if (bar && bar.scrollWidth > bar.clientWidth && bar.scrollTo) {
            bar.scrollTo({ left: btn.offsetLeft - (bar.clientWidth - btn.offsetWidth) / 2, behavior: reduce ? 'auto' : 'smooth' });
          }
          apply(btn.getAttribute('data-tp-filter'));
        });
      });
    });
  }

  /* ---------- Count-up numbers ----------
     <span data-tp-count="100">100</span>  → counts 0 → 100 when seen
     data-tp-decimals="1" for values like 2.4                          */
  function initCountUp() {
    var els = $$('[data-tp-count]');
    if (!els.length || !('IntersectionObserver' in window)) return;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    var run = function (el) {
      var target = parseFloat(el.getAttribute('data-tp-count')) || 0;
      var dec = parseInt(el.getAttribute('data-tp-decimals'), 10) || 0;
      var duration = 1800;
      var t0 = null;
      var step = function (t) {
        if (t0 === null) t0 = t;
        var p = Math.min((t - t0) / duration, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = (target * eased).toFixed(dec);
        if (p < 1) window.requestAnimationFrame(step);
      };
      window.requestAnimationFrame(step);
    };

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        run(e.target);
      });
    }, { threshold: 0.6 });

    els.forEach(function (el) {
      el.textContent = (0).toFixed(parseInt(el.getAttribute('data-tp-decimals'), 10) || 0);
      io.observe(el);
    });
  }

  /* ---------- Feature cards → detail popup ----------
     Card:  <article data-tp-feature data-tp-popup-text="…">
              <h3 data-tp-feature-title>…</h3>
              <img data-tp-feature-img …>
              <button data-tp-feature-open>…</button>
            </article>
     Popup: <dialog data-tp-modal> with data-tp-modal-title / -text / -img
            and data-tp-modal-close                                       */
  function initFeatureModal() {
    var modal = $('[data-tp-modal]');
    var cards = $$('[data-tp-feature]');
    if (!modal || !cards.length || typeof modal.showModal !== 'function') return;

    var title = $('[data-tp-modal-title]', modal);
    var text = $('[data-tp-modal-text]', modal);
    var img = $('[data-tp-modal-img]', modal);
    var lastTrigger = null;

    var open = function (card, trigger) {
      var t = $('[data-tp-feature-title]', card);
      var i = $('[data-tp-feature-img]', card);
      if (title && t) title.textContent = t.textContent;
      if (text) text.textContent = card.getAttribute('data-tp-popup-text') || '';
      if (img && i) {
        img.src = i.getAttribute('src');
        img.alt = i.getAttribute('alt') || '';
        img.width = i.naturalWidth || i.width;
        img.height = i.naturalHeight || i.height;
      }
      lastTrigger = trigger || null;
      modal.classList.remove('is-closing');
      modal.showModal();
      modal.scrollTop = 0;
    };

    var close = function () {
      if (!modal.open || modal.classList.contains('is-closing')) return;
      modal.classList.add('is-closing');
      setTimeout(function () {
        modal.classList.remove('is-closing');
        modal.close();
      }, 240);
    };

    cards.forEach(function (card) {
      var btn = $('[data-tp-feature-open]', card);
      card.addEventListener('click', function (e) {
        if (e.target.closest('a')) return; // let real links work
        open(card, btn);
      });
    });

    $$('[data-tp-modal-close]', modal).forEach(function (b) { b.addEventListener('click', close); });

    // click on the dark backdrop closes
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });

    // Esc: play the closing animation instead of snapping shut
    modal.addEventListener('cancel', function (e) { e.preventDefault(); close(); });

    modal.addEventListener('close', function () {
      if (lastTrigger && lastTrigger.focus) lastTrigger.focus({ preventScroll: true });
    });
  }

  /* ---------- Auto-advancing tabs ----------
     <div data-tp-autotabs>
       <div data-tp-autotab-list>
         <button data-tp-autotab data-tp-image="…">…</button> …
       </div>
       <img data-tp-autotab-img>            (optional: one image swapped per tab)
       <button data-tp-autotab-panel>…      (optional: one panel per tab, gets .is-active)
     </div>
     Timing comes from the CSS progress bar (2s): when it ends we move on.
     Hovering the tab bar / keyboard focus / off-screen → paused.                        */
  function initAutoTabs() {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    $$('[data-tp-autotabs]').forEach(function (root) {
      var tabs = $$('[data-tp-autotab]', root);
      var list = $('[data-tp-autotab-list]', root) || (tabs[0] && tabs[0].parentElement);
      var img = $('[data-tp-autotab-img]', root);
      var panels = $$('[data-tp-autotab-panel]', root); // optional: one panel per tab
      if (!tabs.length) return;

      var index = Math.max(0, tabs.findIndex(function (t) { return t.classList.contains('is-active'); }));
      var hovering = false, focused = false, inView = false, dragging = false;
      var carousel = $('[data-tp-carousel]', root); // optional: centred drag carousel of panels

      var updatePause = function () {
        root.classList.toggle('is-paused', hovering || focused || dragging || !inView);
      };

      // Carousel: an endless loop. The panels are duplicated so there are
      // always phones beyond both edges; vIndex keeps counting up/down
      // forever and every slide's position is measured from it, so items
      // only ever wrap around while they are off-screen.
      var slides = panels.slice();
      var vIndex = index;
      if (carousel && panels.length) {
        panels.forEach(function (p) {
          var c = p.cloneNode(true);
          c.removeAttribute('data-tp-autotab-panel');
          c.removeAttribute('aria-current');
          c.setAttribute('aria-hidden', 'true');
          c.setAttribute('data-tp-clone', '');
          c.tabIndex = -1;
          carousel.appendChild(c);
          slides.push(c);
        });
      }
      var placePanels = function () {
        if (!carousel) return;
        var N = slides.length, half = Math.floor(N / 2);
        slides.forEach(function (p, k) {
          var pos = ((k - vIndex) % N + N + half) % N - half;
          var prev = p.getAttribute('data-tp-pos');
          var wraps = prev !== null && Math.abs(pos - parseInt(prev, 10)) > 1;
          p.classList.toggle('is-wrapping', wraps);
          p.setAttribute('data-tp-pos', String(pos));
          if (wraps) {
            window.requestAnimationFrame(function () {
              window.requestAnimationFrame(function () { p.classList.remove('is-wrapping'); });
            });
          }
        });
      };

      var select = function (i, restart, vDelta) {
        var tab = tabs[i];
        var same = i === index;
        index = i;
        tabs.forEach(function (t, n) {
          var on = n === i;
          t.classList.toggle('is-active', on);
          t.setAttribute('aria-selected', String(on));
          t.tabIndex = on ? 0 : -1;
        });
        panels.forEach(function (p, n) {
          p.classList.toggle('is-active', n === i);
          p.setAttribute('aria-current', n === i ? 'true' : 'false');
        });
        if (carousel) {
          var count = tabs.length;
          if (typeof vDelta === 'number') {
            vIndex += vDelta;
          } else {                       // shortest way round to tab i
            var d = ((i - vIndex) % count + count) % count;
            if (d > count / 2) d -= count;
            vIndex += d;
          }
          placePanels();
        }

        // restart the progress bar when the same tab is chosen again
        if (same && restart) {
          tab.classList.remove('is-active');
          void tab.offsetWidth;
          tab.classList.add('is-active');
        }

        // keep the active tab visible in the sideways-scrolling row (mobile)
        if (list && list.scrollWidth > list.clientWidth && list.scrollTo) {
          list.scrollTo({ left: tab.offsetLeft - (list.clientWidth - tab.offsetWidth) / 2, behavior: reduce ? 'auto' : 'smooth' });
        }

        if (img) {
          var src = tab.getAttribute('data-tp-image');
          if (src && img.getAttribute('src') !== src) img.src = src;
          img.alt = tab.getAttribute('data-tp-alt') || img.alt;
          if (!reduce && img.animate && !same) {
            img.animate(
              [{ opacity: 0, transform: 'translateY(18px) scale(.985)' }, { opacity: 1, transform: 'none' }],
              { duration: 600, easing: 'cubic-bezier(.22, 1, .36, 1)' }
            );
          }
        }
      };

      tabs.forEach(function (tab, i) {
        tab.addEventListener('click', function () { select(i, true); });
        tab.addEventListener('keydown', function (e) {
          var n = null;
          if (e.key === 'ArrowDown' || e.key === 'ArrowRight') n = (i + 1) % tabs.length;
          if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
          if (n !== null) { e.preventDefault(); select(n, true); tabs[n].focus(); }
        });
        // progress bar finished → next tab
        tab.addEventListener('animationend', function (e) {
          if (e.animationName !== 'tp-progress' || i !== index) return;
          select((index + 1) % tabs.length, false, 1);
        });
      });

      // clicking a panel (e.g. a phone) selects its tab
      var suppressClick = false;
      slides.forEach(function (p, k) {
        p.addEventListener('click', function () {
          if (suppressClick) return;
          var i = k % tabs.length;
          if (tabs[i]) select(i, true);
        });
      });

      // Drag / swipe the carousel
      if (carousel) {
        placePanels();
        var startX = 0, dx = 0, pid = null;
        var stepPx = function () {
          var a = panels[0].getBoundingClientRect().width;
          return a * 1.14 || 1;               // matches --tp-step in CSS
        };
        carousel.addEventListener('pointerdown', function (e) {
          if (e.button !== undefined && e.button !== 0) return;
          pid = e.pointerId; startX = e.clientX; dx = 0;
          suppressClick = false;
        });
        carousel.addEventListener('pointermove', function (e) {
          if (pid !== e.pointerId) return;
          dx = e.clientX - startX;
          if (!dragging && Math.abs(dx) > 6) {
            dragging = true;
            suppressClick = true;
            carousel.classList.add('is-dragging');
            try { carousel.setPointerCapture(pid); } catch (err) {}
            updatePause();
          }
          if (dragging) carousel.style.setProperty('--tp-drag', dx + 'px');
        });
        var end = function (e) {
          if (pid !== e.pointerId) return;
          pid = null;
          if (!dragging) return;
          dragging = false;
          carousel.classList.remove('is-dragging');
          carousel.style.removeProperty('--tp-drag');
          var steps = Math.round(-dx / stepPx());
          if (steps === 0 && Math.abs(dx) > 40) steps = dx < 0 ? 1 : -1; // a short flick still moves one
          var n = tabs.length;
          select(((index + steps) % n + n) % n, true, steps);
          updatePause();
          setTimeout(function () { suppressClick = false; }, 0);
        };
        carousel.addEventListener('pointerup', end);
        carousel.addEventListener('pointercancel', end);
      }

      // pause only while the pointer is over the tab bar (about to click),
      // not the whole section – otherwise desktop users would rarely see it play
      var hoverTarget = list || root;
      hoverTarget.addEventListener('mouseenter', function () { hovering = true; updatePause(); });
      hoverTarget.addEventListener('mouseleave', function () { hovering = false; updatePause(); });
      // only keyboard focus pauses (a mouse click shouldn't stop the autoplay)
      root.addEventListener('focusin', function (e) {
        var kb = true;
        try { kb = e.target.matches(':focus-visible'); } catch (err) {}
        focused = kb;
        updatePause();
      });
      root.addEventListener('focusout', function (e) {
        if (!root.contains(e.relatedTarget)) { focused = false; updatePause(); }
      });

      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
          inView = entries[0].isIntersecting;
          updatePause();
        }, { threshold: 0.25 }).observe(root);
      } else {
        inView = true;
      }
      updatePause();

      // centre the starting tab in a sideways-scrolling bar (mobile)
      var centre = function () {
        var t = tabs[index];
        if (list && t && list.scrollWidth > list.clientWidth) {
          list.scrollLeft = t.offsetLeft - (list.clientWidth - t.offsetWidth) / 2;
        }
      };
      centre();
      window.addEventListener('load', centre);
    });
  }

  /* ---------- Endless marquee rows ----------
     <div class="tp-marquee"><div data-tp-marquee class="tp-marquee-track">cards…</div></div>
     The cards are duplicated once (hidden from screen readers) and the CSS
     animation moves the track by half its width → seamless loop.        */
  function initMarquee() {
    $$('[data-tp-marquee]').forEach(function (track) {
      if (track.getAttribute('data-tp-marquee') === 'ready') return;
      Array.prototype.slice.call(track.children).forEach(function (card) {
        var c = card.cloneNode(true);
        c.setAttribute('aria-hidden', 'true');
        $$('a, button', c).forEach(function (el) { el.tabIndex = -1; });
        track.appendChild(c);
      });
      track.setAttribute('data-tp-marquee', 'ready');
    });
  }

  /* ---------- FAQ accordion with autoplay ----------
     <div data-tp-faq>
       <div data-tp-faq-item>
         <button data-tp-faq-toggle aria-expanded aria-controls>…</button>
         <div class="tp-faq-a" id>…</div>
       </div> …
     </div>
     The open item's timer line (CSS, 5s) fires animationend → next item.
     Hover over the list / keyboard focus / off-screen → paused.        */
  function initFaq() {
    $$('[data-tp-faq]').forEach(function (root) {
      var items = $$('[data-tp-faq-item]', root);
      if (!items.length) return;
      var hovering = false, focused = false, inView = false;

      var updatePause = function () {
        root.classList.toggle('is-paused', hovering || focused || !inView);
      };

      var open = function (i) {
        items.forEach(function (item, n) {
          var on = n === i;
          item.classList.toggle('is-open', on);
          var btn = $('[data-tp-faq-toggle]', item);
          if (btn) btn.setAttribute('aria-expanded', String(on));
        });
      };

      items.forEach(function (item, i) {
        var btn = $('[data-tp-faq-toggle]', item);
        if (btn) {
          btn.addEventListener('click', function () {
            // clicking the open question closes it (and stops the autoplay)
            open(item.classList.contains('is-open') ? -1 : i);
          });
        }
        item.addEventListener('animationend', function (e) {
          if (e.animationName !== 'tp-progress' || e.target !== item) return;
          if (item.classList.contains('is-open')) open((i + 1) % items.length);
        });
      });

      root.addEventListener('mouseenter', function () { hovering = true; updatePause(); });
      root.addEventListener('mouseleave', function () { hovering = false; updatePause(); });
      root.addEventListener('focusin', function (e) {
        var kb = true;
        try { kb = e.target.matches(':focus-visible'); } catch (err) {}
        focused = kb;
        updatePause();
      });
      root.addEventListener('focusout', function (e) {
        if (!root.contains(e.relatedTarget)) { focused = false; updatePause(); }
      });

      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
          inView = entries[0].isIntersecting;
          updatePause();
        }, { threshold: 0.3 }).observe(root);
      } else {
        inView = true;
      }
      updatePause();
    });
  }

  var start = function () {
    initYear();
    initHeader();
    initMobileMenu();
    initScrollSpy();
    initReveal();
    initToast();
    initTabs();
    initFilter();
    initCountUp();
    initFeatureModal();
    initAutoTabs();
    initMarquee();
    initFaq();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
