/* =========================================================
   르비오 LEVIO — 메인 스크립트
   의존성 없음 (Vanilla JS)
   ========================================================= */
(function () {
  'use strict';

  var $  = function (s, ctx) { return (ctx || document).querySelector(s); };
  var $$ = function (s, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(s)); };
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 스크롤 잠금 (중첩 대응) ---------- */
  var lockCount = 0;
  function lockScroll() { lockCount++; document.body.classList.add('is-locked'); }
  function unlockScroll() {
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) document.body.classList.remove('is-locked');
  }

  /* =========================================================
     1. 레이어 팝업
     ========================================================= */
  (function layerPopup() {
    var pop = $('#layerpop');
    if (!pop) return;

    var STORAGE_KEY = 'levio_pop_hide_until';
    var hideUntil = 0;
    try { hideUntil = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10); } catch (e) {}
    if (hideUntil && Date.now() < hideUntil) return;

    var track  = $('#popTrack');
    var slides = $$('.layerpop__slide', track);
    var dotBox = $('#popDots');
    var today  = $('#popToday');
    var idx = 0, timer = null;

    slides.forEach(function (_, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', (i + 1) + '번째 슬라이드');
      b.addEventListener('click', function () { go(i); });
      dotBox.appendChild(b);
    });
    var dots = $$('button', dotBox);

    function go(i) {
      idx = (i + slides.length) % slides.length;
      track.style.transform = 'translateX(' + (-100 * idx) + '%)';
      dots.forEach(function (d, n) { d.classList.toggle('is-on', n === idx); });
    }
    function play() { if (!reduceMotion) timer = setInterval(function () { go(idx + 1); }, 3500); }
    function stop() { clearInterval(timer); timer = null; }

    function close() {
      if (today && today.checked) {
        var until = new Date();
        until.setHours(23, 59, 59, 999);
        try { localStorage.setItem(STORAGE_KEY, String(until.getTime())); } catch (e) {}
      }
      stop();
      pop.hidden = true;
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }

    $$('[data-close-pop]', pop).forEach(function (el) { el.addEventListener('click', close); });
    pop.addEventListener('mouseenter', stop);
    pop.addEventListener('mouseleave', play);

    pop.hidden = false;
    go(0);
    play();
    document.addEventListener('keydown', onKey);
  })();

  /* =========================================================
     2. 히어로 슬라이더
     ========================================================= */
  (function heroSlider() {
    var track = $('#heroTrack');
    if (!track) return;

    var viewport = $('#heroViewport');
    var slides = $$('.hero__slide', track);
    var dotBox = $('#heroDots');
    var nowEl  = $('#heroNow');
    var allEl  = $('#heroAll');
    var playBtn = $('#heroPlay');
    var idx = 0, timer = null, playing = true;
    var DURATION = 5500;

    if (allEl) allEl.textContent = slides.length;

    slides.forEach(function (_, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', (i + 1) + '번째 배너');
      b.addEventListener('click', function () { go(i); restart(); });
      dotBox.appendChild(b);
    });
    var dots = $$('button', dotBox);

    function go(i) {
      idx = (i + slides.length) % slides.length;
      track.style.transform = 'translateX(' + (-100 * idx) + '%)';
      dots.forEach(function (d, n) { d.classList.toggle('is-on', n === idx); });
      slides.forEach(function (s, n) {
        s.classList.toggle('is-active', n === idx);
        s.setAttribute('aria-hidden', n === idx ? 'false' : 'true');
      });
      if (nowEl) nowEl.textContent = idx + 1;
    }
    function start() {
      if (reduceMotion || !playing) return;
      timer = setInterval(function () { go(idx + 1); }, DURATION);
    }
    function stop() { clearInterval(timer); timer = null; }
    function restart() { stop(); start(); }

    if (playBtn) {
      playBtn.addEventListener('click', function () {
        playing = !playing;
        playBtn.dataset.playing = String(playing);
        playBtn.setAttribute('aria-label', playing ? '자동재생 정지' : '자동재생 시작');
        playing ? start() : stop();
      });
    }
    var prev = $('#heroPrev'), next = $('#heroNext');
    if (prev) prev.addEventListener('click', function () { go(idx - 1); restart(); });
    if (next) next.addEventListener('click', function () { go(idx + 1); restart(); });

    viewport.addEventListener('mouseenter', stop);
    viewport.addEventListener('mouseleave', start);

    /* 스와이프 */
    var sx = 0, sy = 0, dragging = false;
    viewport.addEventListener('touchstart', function (e) {
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; dragging = true; stop();
    }, { passive: true });
    viewport.addEventListener('touchend', function (e) {
      if (!dragging) return;
      dragging = false;
      var dx = e.changedTouches[0].clientX - sx;
      var dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(idx + (dx < 0 ? 1 : -1));
      start();
    });

    /* 키보드 */
    viewport.setAttribute('tabindex', '0');
    viewport.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft')  { go(idx - 1); restart(); }
      if (e.key === 'ArrowRight') { go(idx + 1); restart(); }
    });

    /* 탭이 백그라운드면 정지 */
    document.addEventListener('visibilitychange', function () {
      document.hidden ? stop() : start();
    });

    go(0);
    start();
  })();

  /* =========================================================
     3. 해시태그 필터
     ========================================================= */
  (function tagFilter() {
    var tags = $$('.tags .tag');
    var grid = $('#bestGrid');
    var empty = $('#bestEmpty');
    if (!tags.length || !grid) return;

    var items = $$('.prod', grid);

    tags.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var f = btn.dataset.filter;
        tags.forEach(function (b) {
          var on = b === btn;
          b.classList.toggle('is-on', on);
          b.setAttribute('aria-selected', String(on));
        });
        var shown = 0;
        items.forEach(function (li) {
          var ok = (f === 'all' || li.dataset.cat === f);
          li.hidden = !ok;
          if (ok) shown++;
        });
        if (empty) empty.hidden = shown !== 0;
      });
    });
  })();

  /* =========================================================
     4. 타임세일 카운트다운
     ========================================================= */
  (function countdown() {
    var box = $('#timesale');
    if (!box) return;
    var end = new Date(box.dataset.deadline).getTime();
    if (isNaN(end)) return;

    var dEl = $('#cdD'), hEl = $('#cdH'), mEl = $('#cdM'), sEl = $('#cdS');
    var pad = function (n, len) { return String(n).padStart(len || 2, '0'); };

    function tick() {
      var diff = end - Date.now();
      if (diff <= 0) {
        dEl.textContent = '000'; hEl.textContent = mEl.textContent = sEl.textContent = '00';
        clearInterval(t);
        return;
      }
      var s = Math.floor(diff / 1000);
      dEl.textContent = pad(Math.floor(s / 86400), 3);
      hEl.textContent = pad(Math.floor(s % 86400 / 3600));
      mEl.textContent = pad(Math.floor(s % 3600 / 60));
      sEl.textContent = pad(s % 60);
    }
    tick();
    var t = setInterval(tick, 1000);
  })();

  /* =========================================================
     5. 리뷰 캐러셀 (가로 스크롤 + 버튼)
     ========================================================= */
  (function reviewSlider() {
    var vp = $('#reviewViewport');
    if (!vp) return;
    var prev = $('#reviewPrev'), next = $('#reviewNext');
    var first = $('.review__item', vp);

    function step() {
      if (!first) return 340;
      var gap = parseFloat(getComputedStyle($('#reviewTrack')).columnGap || '24') || 24;
      return first.getBoundingClientRect().width + gap;
    }
    function sync() {
      if (!prev || !next) return;
      var max = vp.scrollWidth - vp.clientWidth - 2;
      prev.disabled = vp.scrollLeft <= 2;
      next.disabled = vp.scrollLeft >= max;
      prev.style.opacity = prev.disabled ? '.35' : '1';
      next.style.opacity = next.disabled ? '.35' : '1';
    }
    if (prev) prev.addEventListener('click', function () { vp.scrollBy({ left: -step(), behavior: reduceMotion ? 'auto' : 'smooth' }); });
    if (next) next.addEventListener('click', function () { vp.scrollBy({ left:  step(), behavior: reduceMotion ? 'auto' : 'smooth' }); });
    vp.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    sync();
  })();

  /* =========================================================
     6. 모바일 드로어 + 아코디언
     ========================================================= */
  (function drawer() {
    var box = $('#drawer');
    var open = $('#menuOpen');
    if (!box || !open) return;

    function show() {
      box.hidden = false;
      lockScroll();
      document.addEventListener('keydown', onKey);
      var f = $('.drawer__panel button', box);
      if (f) f.focus();
    }
    function hide() {
      box.hidden = true;
      unlockScroll();
      document.removeEventListener('keydown', onKey);
      open.focus();
    }
    function onKey(e) { if (e.key === 'Escape') hide(); }

    open.addEventListener('click', show);
    $$('[data-close-drawer]', box).forEach(function (el) { el.addEventListener('click', hide); });

    /* 아코디언 */
    $$('.acc__head', box).forEach(function (head) {
      head.addEventListener('click', function () {
        var item = head.closest('.acc__item');
        var on = item.classList.toggle('is-open');
        head.setAttribute('aria-expanded', String(on));
      });
    });

    /* 데스크탑으로 넓어지면 자동 닫기 */
    window.addEventListener('resize', function () {
      if (window.innerWidth > 1023 && !box.hidden) hide();
    });
  })();

  /* =========================================================
     7. 검색 오버레이
     ========================================================= */
  (function search() {
    var bar = $('#searchbar');
    var open = $('#searchOpen');
    var close = $('#searchClose');
    if (!bar || !open) return;

    function toggle(on) {
      bar.hidden = !on;
      open.setAttribute('aria-expanded', String(on));
      if (on) { var i = $('#searchInput'); if (i) i.focus(); }
      else open.focus();
    }
    open.addEventListener('click', function () { toggle(bar.hidden); });
    if (close) close.addEventListener('click', function () { toggle(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !bar.hidden) toggle(false);
    });
  })();

  /* =========================================================
     8. 언어 드롭다운
     ========================================================= */
  (function lang() {
    var wrap = $('.utility__lang');
    if (!wrap) return;
    var btn = $('.lang__btn', wrap);

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var on = wrap.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', String(on));
    });
    document.addEventListener('click', function () {
      wrap.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
    });
  })();

  /* =========================================================
     9. 헤더 그림자 + 맨 위로
     ========================================================= */
  (function scrollUI() {
    var header = $('#header');
    var topBtn = $('#topBtn');
    var ticking = false;

    function update() {
      var y = window.pageYOffset;
      if (header) header.classList.toggle('is-stuck', y > 10);
      if (topBtn) topBtn.classList.toggle('is-on', y > 500);
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    update();

    if (topBtn) {
      topBtn.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      });
    }
  })();

  /* =========================================================
     10. 스크롤 등장 애니메이션
     ========================================================= */
  (function reveal() {
    var items = $$('.reveal');
    if (!items.length) return;

    if (reduceMotion || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.06 });

    /* 같은 그리드 안에서는 순차 지연 */
    items.forEach(function (el) {
      var siblings = el.parentElement ? $$('.reveal', el.parentElement) : [el];
      var i = siblings.indexOf(el);
      if (i > 0) el.style.transitionDelay = Math.min(i, 6) * 60 + 'ms';
      io.observe(el);
    });
  })();

})();
