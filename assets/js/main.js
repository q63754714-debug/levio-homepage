/* =========================================================
   르비오 LEVIO — 메인 스크립트 v5
   의존성 없음 (Vanilla JS)
   모듈: 팝업 · 히어로 · 필터 · 카운트다운 · 리뷰 · 드로어 ·
         검색 · 언어 · 스크롤UI · 리빌 · 파인더 · 카운터 · 패럴랙스
   ========================================================= */
(function () {
  'use strict';

  var $  = function (s, ctx) { return (ctx || document).querySelector(s); };
  var $$ = function (s, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(s)); };
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 스크롤 잠금 (드로어용) ---------- */
  var lockCount = 0;
  function lockScroll() { lockCount++; document.body.classList.add('is-locked'); }
  function unlockScroll() {
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) document.body.classList.remove('is-locked');
  }

  /* =========================================================
     1. 레이어 팝업 (비차단 코너 카드)
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
    var DURATION = 6000;

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

    viewport.setAttribute('tabindex', '0');
    viewport.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft')  { go(idx - 1); restart(); }
      if (e.key === 'ArrowRight') { go(idx + 1); restart(); }
    });

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
     4. 타임세일 카운트다운 (틱 애니메이션 포함)
     ========================================================= */
  (function countdown() {
    var box = $('#timesale');
    if (!box) return;
    var end = new Date(box.dataset.deadline).getTime();
    if (isNaN(end)) return;

    var dEl = $('#cdD'), hEl = $('#cdH'), mEl = $('#cdM'), sEl = $('#cdS');
    var pad = function (n, len) { return String(n).padStart(len || 2, '0'); };

    function setVal(el, val) {
      if (el.textContent === val) return;
      el.textContent = val;
      if (reduceMotion) return;
      el.classList.remove('tick');
      void el.offsetWidth; /* 리플로 강제로 애니메이션 재시작 */
      el.classList.add('tick');
    }

    function tick() {
      var diff = end - Date.now();
      if (diff <= 0) {
        setVal(dEl, '000'); setVal(hEl, '00'); setVal(mEl, '00'); setVal(sEl, '00');
        clearInterval(t);
        return;
      }
      var s = Math.floor(diff / 1000);
      setVal(dEl, pad(Math.floor(s / 86400), 3));
      setVal(hEl, pad(Math.floor(s % 86400 / 3600)));
      setVal(mEl, pad(Math.floor(s % 3600 / 60)));
      setVal(sEl, pad(s % 60));
    }
    tick();
    var t = setInterval(tick, 1000);
  })();

  /* =========================================================
     5. 리뷰 캐러셀
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

    $$('.acc__head', box).forEach(function (head) {
      head.addEventListener('click', function () {
        var item = head.closest('.acc__item');
        var on = item.classList.toggle('is-open');
        head.setAttribute('aria-expanded', String(on));
      });
    });

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
     9. 헤더 그림자 + 맨 위로 + 패럴랙스
     ========================================================= */
  (function scrollUI() {
    var header = $('#header');
    var topBtn = $('#topBtn');
    var pxEls = $$('[data-parallax]');
    var ticking = false;

    function update() {
      var y = window.pageYOffset;
      if (header) header.classList.toggle('is-stuck', y > 10);
      if (topBtn) topBtn.classList.toggle('is-on', y > 500);

      /* 패럴랙스: 뷰포트 중심 대비 요소 위치 × 속도 */
      if (!reduceMotion) {
        var vh2 = window.innerHeight / 2;
        pxEls.forEach(function (el) {
          var r = el.getBoundingClientRect();
          if (r.bottom < -80 || r.top > window.innerHeight + 80) return;
          var speed = parseFloat(el.dataset.parallax) || 0;
          var delta = (r.top + r.height / 2 - vh2) * speed;
          el.style.transform = 'translate3d(0,' + delta.toFixed(1) + 'px,0)';
        });
      }
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    window.addEventListener('resize', update);
    update();

    if (topBtn) {
      topBtn.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      });
    }
  })();

  /* =========================================================
     10. 스크롤 리빌 (스태거)
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
        /* 뷰포트를 이미 지나친 요소(top < 0)도 노출.
           앵커 점프로 건너뛴 섹션이 opacity:0 으로 남는 것을 막는다. */
        if (!en.isIntersecting && en.boundingClientRect.top >= 0) return;
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.06 });

    items.forEach(function (el) {
      var siblings = el.parentElement ? $$('.reveal', el.parentElement) : [el];
      var i = siblings.indexOf(el);
      if (i > 0) el.style.transitionDelay = Math.min(i, 6) * 60 + 'ms';
      io.observe(el);
    });

    /* 새로고침·앵커 진입 등으로 이미 스크롤된 상태면 위쪽 요소를 즉시 노출 */
    function revealAbove() {
      items.forEach(function (el) {
        if (el.classList.contains('is-in')) return;
        if (el.getBoundingClientRect().top < window.innerHeight) {
          el.style.transitionDelay = '0ms';
          el.classList.add('is-in');
          io.unobserve(el);
        }
      });
    }
    if (window.pageYOffset > 0) revealAbove();
    window.addEventListener('hashchange', function () { setTimeout(revealAbove, 60); });
  })();

  /* =========================================================
     11. 숫자 카운터 (스트립)
     ========================================================= */
  (function counters() {
    var els = $$('[data-counter]');
    if (!els.length) return;

    function animate(el) {
      var target = parseInt(el.dataset.counter, 10) || 0;
      if (reduceMotion) { el.textContent = target; return; }
      var t0 = null, DUR = 1200;
      function frame(ts) {
        if (!t0) t0 = ts;
        var p = Math.min((ts - t0) / DUR, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased);
        if (p < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }

    if (!('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.textContent = el.dataset.counter; });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        animate(en.target);
        io.unobserve(en.target);
      });
    }, { threshold: 0.4 });
    els.forEach(function (el) { io.observe(el); });
  })();

  /* =========================================================
     12. 고민 파인더 — 키워드 매칭 제품 추천
     ========================================================= */
  (function finder() {
    var form = $('#finderForm');
    var input = $('#finderInput');
    var result = $('#finderResult');
    if (!form || !input || !result) return;

    var PRODUCTS = [
      {
        id: 'bio', name: 'BIO 10B 바이오 10B', img: 'assets/img/d-bio.webp',
        spec: '프로바이오틱스 100억 CFU · 1일 1캡슐',
        del: '39,000원', price: '33,000원',
        reason: '장이 보내는 신호에는 유산균 루틴부터 시작해 보세요. 100억 보장균수가 장까지 살아서 도착합니다.',
        kw: ['장', '소화', '변', '배', '속', '더부룩', '가스', '유산균', '프로바이오', '예민']
      },
      {
        id: 'collagen', name: 'COLLAGEN GLOW 콜라겐 글로우', img: 'assets/img/p-collagen.webp',
        spec: '데일리 이너뷰티 · 1일 1정 · 60일',
        del: '45,000원', price: '38,000원',
        reason: '푸석함이 느껴질 땐 안에서 채우는 게 먼저예요. 저분자 콜라겐으로 매일의 이너뷰티 루틴을 만들어 보세요.',
        kw: ['피부', '푸석', '탄력', '콜라겐', '미용', '주름', '건조', '뷰티', '광']
      },
      {
        id: 'move', name: 'MOVE 1200 무브 1200', img: 'assets/img/d-move.webp',
        spec: '콘드로이친 1,200 mg · 1일 1포 · 30일',
        del: '49,000원', price: '43,000원',
        reason: '계단이 부담스러워지기 시작했다면 관절 · 연골을 챙길 때입니다. 하루 한 포로 간편하게 이어가세요.',
        kw: ['관절', '무릎', '연골', '계단', '시큰', '뼈', '콘드로이친', '등산', '부담']
      },
      {
        id: 'active', name: 'ACTIVE B8 액티브 B8', img: 'assets/img/d-active.webp',
        spec: '비타민 B군 8종 · 에너지 · 활력',
        del: '32,000원', price: '28,000원',
        reason: '무거운 아침이 반복된다면 에너지 대사에 필요한 비타민 B군 8종으로 하루의 시동을 걸어 보세요.',
        kw: ['피로', '아침', '무거', '활력', '에너지', '회식', '야근', '지침', '비타민', '기운', '나른']
      },
      {
        id: 'night', name: 'NIGHT 02 나이트 02', img: 'assets/img/d-night.webp',
        spec: '식물 유래 멜라토닌 2 mg · 수면 루틴',
        del: '36,000원', price: '31,000원',
        reason: '잠들기까지 오래 걸린다면, 잠들기 30분 전 한 알의 루틴을 만들어 보세요. 식물 유래 멜라토닌 2mg입니다.',
        kw: ['잠', '수면', '불면', '뒤척', '새벽', '멜라토닌', '피곤한데', '밤']
      },
      {
        id: 'mag', name: 'MAG 350 마그네슘 350', img: 'assets/img/p-mag.webp',
        spec: '마그네슘 350 mg · 1일 2정 · 30일',
        del: '29,000원', price: '25,000원',
        reason: '눈 밑 떨림과 근육 경련이 잦다면 마그네슘 신호일 수 있어요. 하루 350mg으로 채워 보세요.',
        kw: ['떨림', '눈밑', '눈 밑', '근육', '경련', '마그네슘', '쥐', '뭉침']
      }
    ];

    function match(text) {
      var scored = PRODUCTS.map(function (p) {
        var score = 0;
        p.kw.forEach(function (k) { if (text.indexOf(k) !== -1) score += k.length >= 2 ? 2 : 1; });
        return { p: p, score: score };
      }).filter(function (x) { return x.score > 0; });
      scored.sort(function (a, b) { return b.score - a.score; });
      return scored.map(function (x) { return x.p; });
    }

    function cardHTML(p, isSub) {
      return '' +
        '<div class="rcard' + (isSub ? ' rcard--sub' : '') + '">' +
          '<span class="rcard__thumb"><img src="' + p.img + '" alt="' + p.name + '"></span>' +
          '<div class="rcard__body">' +
            '<span class="rcard__match">' + (isSub ? 'Also good' : 'Best match') + '</span>' +
            '<strong class="rcard__name">' + p.name + '</strong>' +
            '<p class="rcard__reason">' + p.reason + '</p>' +
            '<p class="rcard__price"><del>' + p.del + '</del><ins>' + p.price + '</ins></p>' +
            '<span class="rcard__cta">' +
              '<a href="#" class="btn btn--dark btn--sm">자세히 보기</a>' +
              '<a href="#" class="btn btn--line btn--sm">장바구니 담기</a>' +
            '</span>' +
          '</div>' +
        '</div>';
    }

    function render(text) {
      var found = match(text);
      if (!found.length) {
        result.innerHTML =
          '<div class="finder__none">' +
            '아직 딱 맞는 제품을 찾지 못했어요.<br>' +
            '<b>장 · 피부 · 관절 · 피로 · 수면 · 근육 떨림</b> 중 가까운 고민을 선택하거나 조금 더 자세히 적어주세요.' +
          '</div>';
      } else {
        var html = cardHTML(found[0], false);
        if (found[1]) html += cardHTML(found[1], true);
        result.innerHTML = html;
      }
      /* 등장 애니메이션 */
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          $$('.rcard, .finder__none', result).forEach(function (el, i) {
            el.style.transitionDelay = i * 120 + 'ms';
            el.classList.add('is-in');
          });
        });
      });
      var y = result.getBoundingClientRect().top + window.pageYOffset - 140;
      if (Math.abs(window.pageYOffset - y) > 60) {
        window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
      }
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var text = input.value.trim();
      if (!text) { input.focus(); return; }
      $$('.chip').forEach(function (c) { c.classList.remove('is-on'); });
      render(text);
    });

    $$('.chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        $$('.chip').forEach(function (c) { c.classList.toggle('is-on', c === chip); });
        input.value = chip.dataset.concern || chip.textContent.trim();
        render(input.value);
      });
    });
  })();

})();
