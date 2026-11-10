(function () {
  'use strict';

  var esc = Charts.esc;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var app = $('#app');
  var S = { slot: '', cfg: null, master: null, rules: null, texts: null, api: null, trends: undefined, places: undefined, cart: {}, start: '', end: '', avail: null, openedAt: 0, prefill: null };
  var store = Api.safeStore();
  var WD = ['일', '월', '화', '수', '목', '금', '토'];

  function svg(inner, size) { size = size || 24; return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>'; }
  var ICON = {
    cone: svg('<path d="M10.2 3.5h3.6L18 18H6z"/><path d="M8.4 11h7.2M3.5 21h17"/>'),
    camera: svg('<path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13.5" r="3.5"/>'),
    prep: svg('<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4h6v3H9zM9 12h6M9 16h4"/>'),
    chart: svg('<path d="M5 20v-8M12 20V5M19 20v-12"/>'),
    pin: svg('<path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>'),
    globe: svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>'),
    apply: svg('<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>')
  };
  var ITEM_ICON = {
    walkie: svg('<rect x="8" y="8" width="8" height="13" rx="2"/><path d="M12 8V3M10 12h4M10 16h4"/>'),
    baton: svg('<path d="M5 19 17 7"/><path d="M15 3l1.5 3M21 9l-3-1.5M19 5l-2 2"/>'),
    cone: ICON.cone,
    heavycone: svg('<path d="M10 3h4l3 12H7z"/><path d="M8.4 9.5h7.2"/><rect x="4" y="15" width="16" height="5" rx="1.5"/>'),
    hangbar: svg('<path d="M3 8h18"/><path d="M3 8v6a2 2 0 0 0 4 0V8M17 8v6a2 2 0 0 0 4 0V8"/>'),
    fence: svg('<path d="M3 9h18M3 16h18M6 6v14M12 6v14M18 6v14"/>'),
    vest: svg('<path d="M7 3 4 6v15h6v-8l2 2 2-2v8h6V6l-3-3-3 3-2-1-2 1z"/>'),
    signboard: svg('<path d="M7.5 21 9 4h6l1.5 17M8.3 12h7.4M6 21h12"/>'),
    lantern: svg('<rect x="7" y="9" width="10" height="11" rx="2"/><path d="M9 9V7a3 3 0 0 1 6 0v2M12 12.5v3.5M7 20h10"/>'),
    chair: svg('<path d="M7 4v17M17 4v17M6 8.5h12M7 14.5h10"/>'),
    clapper: svg('<rect x="4" y="10" width="16" height="10" rx="1.5"/><path d="M4 10l1.6-4.8 15 3.8L20 10M9.2 6.2l-1.5 4M14.4 7.5l-1.6 3.8"/>'),
    wagon: svg('<path d="M3 6h3l2 9h10l2-7H7"/><circle cx="9" cy="19" r="1.6"/><circle cx="17" cy="19" r="1.6"/>'),
    powerbank: svg('<rect x="3" y="8" width="16" height="9" rx="2"/><path d="M21 11v3M10 10.5 8 13.5h4l-2 3"/>'),
    gopro5: svg('<rect x="5" y="6" width="14" height="12" rx="2"/><circle cx="12" cy="12" r="3.2"/>'),
    gopromax: svg('<rect x="4" y="6" width="16" height="12" rx="2"/><circle cx="9" cy="12" r="2.4"/><circle cx="15" cy="12" r="2.4"/>')
  };
  function itemIcon(it) { return '<span class="ico" aria-hidden="true">' + (ITEM_ICON[it.id] || (it.category === '안전통제' ? ICON.cone : ICON.camera)) + '</span>'; }
  function ph(_unused, title, lede) { return '<header class="ph"><h1>' + K(title) + '</h1>' + (lede ? '<p class="lede">' + K(lede) + '</p>' : '') + '</header>'; }
  function stepH(n, title, hint) { return '<div class="step-h"><span class="n">' + n + '</span><h2>' + title + '</h2>' + (hint ? '<span class="hint">' + hint + '</span>' : '') + '</div>'; }
  function linkRow(href, icon, title, desc) { return '<a class="linkrow" href="' + href + '"><span class="ic">' + icon + '</span><span><b>' + title + '</b><span class="d">' + K(desc) + '</span></span></a>'; }
  function subnav(cur) { return '<nav class="subnav" aria-label="로케이션"><a href="#/places"' + (cur === 'places' ? ' aria-current="page"' : '') + '>장소 소개</a><a href="#/trends"' + (cur === 'trends' ? ' aria-current="page"' : '') + '>트렌드</a></nav>'; }
  // 촬영지원 신청서(구글 폼) 주소. 설정이 비어 있으면 링크를 보여 주지 않는다.
  function formUrl() { var u = (S.cfg && S.cfg.applyFormUrl) || ''; return /^https:\/\/(docs\.google\.com\/forms|forms\.gle)\//.test(u) ? u : ''; }
  // 신청서에 파일 업로드 질문이 있으면 구글 로그인이 필요하다. config의 applyFormNeedsLogin 으로 안내를 켜고 끈다.
  function loginHint() { return S.cfg && S.cfg.applyFormNeedsLogin ? ' 구글_계정으로 로그인해야_열 수 있어요.' : ''; }
  // 필름코리아(한국영상위원회) 주소. 설정에 없으면 기본값을 쓴다.
  function fk(key) { var o = (S.cfg && S.cfg.filmkorea) || {}, d = { home: 'https://www.filmkorea.or.kr/', location: 'https://www.filmkorea.or.kr/location/location.jsp', request: 'https://www.filmkorea.or.kr/film/request.jsp', contacts: 'https://www.filmkorea.or.kr/member/contact_list.jsp' }; return o[key] || d[key]; }
  function linkRowExt(href, icon, title, desc) { return linkRow(href, icon, title, desc).replace('<a class="linkrow" href=', '<a class="linkrow" target="_blank" rel="noopener" href='); }
  function ext(href, text, cls) { return '<a' + (cls ? ' class="' + cls + '"' : '') + ' href="' + esc(href) + '" target="_blank" rel="noopener">' + text + '</a>'; }
  function nextOpenDay(from) { var d = from, st = settings(), n = 0; while (Core.isClosed(d, st) && n++ < 14) d = Core.addDays(d, 1); return d; }
  // 칸 하나가 물품 1개인 게이지. 보유 수량이 40개 이하일 때만 칸으로 나눈다.
  function gaugeHtml(remaining, stock, picked) {
    var pct = Math.round(remaining / stock * 100), cls = remaining < 1 ? 'out' : pct <= 25 ? 'low' : '';
    if (remaining >= 1 && stock <= 40) cls += ' cells';
    return '<div class="gauge ' + cls + '" style="--p:' + pct + '%;--r:' + Math.max(remaining, 1) + ';--n:' + stock + ';--q:' + (picked || 0) + '" aria-hidden="true"><i></i></div>';
  }
  function shortName(n) { return String(n).split(' (')[0]; }

  function items() { return S.master.items.filter(function (i) { return i.active !== false; }); }
  function idx() { return Core.byId(items()); }
  function ko(d) { var t = Core.parseDate(d); if (t == null) return ''; var x = new Date(t); return x.getUTCFullYear() + '년 ' + (x.getUTCMonth() + 1) + '월 ' + x.getUTCDate() + '일(' + WD[x.getUTCDay()] + ')'; }
  function json(url) { return fetch(url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(url); return r.json(); }); }
  // 구절 단위로 줄이 바뀌도록, 글 안의 '_'(한글·숫자 사이)를 줄바꿈 없는 공백으로 바꾼다.
  function K(s) {
    // 글 안의 '_'(한글·숫자 사이)는 줄바꿈 없는 공백으로, '택배·퀵·우편은'처럼 가운뎃점으로 이은 말은 한 덩어리로 묶는다(태그 안은 건드리지 않음).
    return String(s).replace(/(<[^>]*>)|([^<]+)/g, function (m, tag, text) {
      if (tag) return tag;
      var t = text, p;
      do { p = t; t = t.replace(/([가-힣0-9)])_([가-힣(0-9])/g, '$1\u00a0$2'); } while (t !== p);
      return t.replace(/[가-힣A-Za-z0-9]+(?:·[가-힣A-Za-z0-9]+)+[가-힣]{0,3}/g, '<span class="nw">$&</span>');
    });
  }
  function msg(kind, html) { return '<div class="msg ' + kind + '" role="' + (kind === 'err' ? 'alert' : 'status') + '">' + K(html) + '</div>'; }
  function list(arr) { return '<ul>' + arr.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>'; }
  function opts(arr, sel, ph) { return (ph ? '<option value="">' + esc(ph) + '</option>' : '') + arr.map(function (v) { return '<option' + (v === sel ? ' selected' : '') + '>' + esc(v) + '</option>'; }).join(''); }
  function seg(name, arr, sel) { // arr: [{v,t}]
    return '<div class="seg" role="radiogroup">' + arr.map(function (o, i) {
      return '<label><input type="radio" name="' + name + '" value="' + esc(o.v) + '"' + ((sel == null ? i === 0 : o.v === sel) ? ' checked' : '') + '><span>' + esc(o.t) + '</span></label>';
    }).join('') + '</div>';
  }
  function settings() { return S.master.settings || {}; }
  function dateBounds() {
    var s = settings(), today = Core.todayKST();
    return { min: Core.addDays(today, s.minAdvanceDays == null ? 1 : s.minAdvanceDays), max: Core.addDays(today, s.maxAdvanceDays || 90), maxDays: s.maxDays || 14 };
  }
  function statusBadge(st) {
    var m = { '예약됨': ['', '예약됨 · 방문 수령 대기'], '수령': ['ok', '수령 완료 · 반납 전'], '반납': ['ok', '반납 완료'], '해제': ['warn', '자동 해제됨'], '취소': ['bad', '취소됨'] }[st] || ['', st];
    return '<span class="badge ' + m[0] + '">' + esc(m[1]) + '</span>';
  }
  function itemsTable(its) {
    return '<table><thead><tr><th>물품</th><th class="num">수량</th></tr></thead><tbody>' + its.map(function (i) { return '<tr><td>' + esc(i.name) + '</td><td class="num">' + i.qty + '</td></tr>'; }).join('') + '</tbody></table>';
  }

  /* ---------- 내 기기에 저장한 코드 ---------- */
  function savedCodes() { try { return JSON.parse(store.get('gcon_my_codes') || '[]'); } catch (e) { return []; } }
  function saveCode(res) {
    var l = savedCodes().filter(function (x) { return x.code !== res.code; });
    l.unshift({ code: res.code, start: res.startDate, end: res.endDate });
    store.set('gcon_my_codes', JSON.stringify(l.slice(0, 10)));
  }

  /* ---------- 라우터 ---------- */
  var views = {};
  function route() {
    var parts = (location.hash.replace(/^#/, '') || '/').split('/').filter(Boolean);
    var name = parts[0] || 'home';
    if (!views[name]) name = 'home';
    $$('.nav a, .tabbar a').forEach(function (a) { if ((' ' + a.getAttribute('data-nav') + ' ').indexOf(' ' + name + ' ') >= 0) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    window.scrollTo(0, 0);
    views[name](parts.slice(1));
    if (routed) { try { app.focus({ preventScroll: true }); } catch (e) { /* 무시 */ } }
    routed = true;
  }
  var routed = false;

  /* ---------- 홈 ---------- */
  views.home = function () {
    var day = nextOpenDay(dateBounds().min);
    app.innerHTML =
      '<section class="hero"><div>' +
      '<div class="frame"><h1>경기도 촬영,<br>장비부터 장소까지<br>한 곳에서 준비하세요.</h1></div>' +
      '<p class="lede">' + K('안전통제 물품을 미리 예약하고, 촬영 환경에 맞는 구성을 추천받고, 경기도 촬영지를 둘러보세요.') + '</p>' +
      '<div class="row"><a class="btn" href="#/gear">장비 예약하기</a><a class="btn alt" href="#/kit">키트 추천받기</a></div>' +
      (formUrl() ? '<p class="muted" style="margin:20px 0 0">' + K('로케이션 촬영지원이 필요하다면 ') + ext(formUrl(), '촬영지원 신청서') + K('를 작성해 주세요.') + '</p>' : '') + '</div>' +
      '<aside class="sheet" aria-label="수령 가능 현황"><div class="sheet-h"><b>수령 가능 현황</b><span class="live"><i></i>' + (S.api.demo ? '예시' : '실시간') + '</span></div>' +
      '<p class="sheet-d">' + ko(day) + ' 수령 기준</p><div class="stock" id="stock"><p class="muted">불러오는 중…</p></div>' +
      '<p class="sheet-f"><span class="muted">보유 수량 중 남은 수량</span><a href="#/gear">날짜 골라 예약하기</a></p></aside></section>' +
      '<div class="sec-h"><h2>이렇게 진행돼요</h2></div>' +
      '<ol class="flow"><li><h3>예약코드 받기</h3><p>' + K('날짜와_물품을 고르면 예약코드가 나와요.') + '</p></li>' +
      '<li><h3>방문해서 수령</h3><p>' + K('수령일에 진흥원에서 코드를 보여 주세요. 본인_확인은 현장_종이_인수증에 적어요.') + '</p></li>' +
      '<li><h3>직접 반납</h3><p>' + K('반납일에 방문해 반납합니다. 택배·퀵·우편은 받지_않아요.') + '</p></li></ol>' +
      '<div id="home-places"></div>' +
      '<div class="sec-h"><h2>더 알아보기</h2></div><div class="linkrows" style="--cols:' + (formUrl() ? 2 : 3) + '">' +
      (formUrl() ? linkRow(formUrl(), ICON.apply, '로케이션 촬영지원 신청', '진흥원의 별도 신청서로 접수해요. 연락받을_정보를 적어야 해요.' + loginHint()).replace('<a class="linkrow" href=', '<a class="linkrow" target="_blank" rel="noopener" href=') : '') +
      linkRowExt(fk('location'), ICON.globe, '필름코리아', '경기도를_포함한 전국_영상위원회의 로케이션을 찾아보고, 촬영지원도 신청할_수 있어요.') +
      linkRow('#/prep', ICON.prep, '촬영 준비', '신청_시기_계산, 관할_확인, 현장_체크리스트') +
      linkRow('#/trends', ICON.chart, '로케이션 트렌드', '월별_신청_흐름과 많이_찾는 장소_유형') + '</div>' +
      '<p class="muted" style="margin-top:28px">' + K('로케이션 촬영지원 신청은 이 사이트에서 받지 않고, 기존_신청서로 접수합니다.') + '</p>';
    S.api.availability(day, day).then(function (r) {
      var el = $('#stock'); if (!el) return;
      if (!r.ok) { el.innerHTML = '<p class="muted">현황을 불러오지 못했어요.</p>'; return; }
      var ix = idx(), main = ['walkie', 'cone', 'baton', 'vest', 'fence'].filter(function (id) { return ix[id] && r.avail[id]; });
      var rows = main.map(function (id) {
        var a = r.avail[id];
        return '<div class="stock-row"><span class="nm">' + esc(shortName(ix[id].name)) + '</span><span class="v num">' + a.remaining + ' <small>/ ' + a.stock + '</small></span>' + gaugeHtml(a.remaining, a.stock) + '</div>';
      }).join('');
      var others = items().filter(function (it) { return main.indexOf(it.id) < 0 && r.avail[it.id]; });
      el.innerHTML = rows + (others.length ? '<div class="more"><p class="more-h">그 밖에도 <b>' + others.length + '종</b>을 더 빌릴 수 있어요</p><div class="tags">' + others.map(function (it) { return '<span class="tag">' + esc(shortName(it.name)) + ' <b class="num">' + r.avail[it.id].remaining + '</b></span>'; }).join('') + '</div></div>' : '');
    }).catch(function () { var el = $('#stock'); if (el) el.innerHTML = '<p class="muted">현황을 불러오지 못했어요.</p>'; });
    loadPlaces().then(function (pl) {
      var el = $('#home-places'); if (!el || !pl || !pl.items.length) return;
      var pick = pl.items.filter(function (p) { return p.featured !== '상시'; }).slice(0, 3);
      if (!pick.length) pick = pl.items.slice(0, 3);
      el.innerHTML = '<div class="sec-h"><h2>이번에 소개하는 로케이션</h2><a href="#/places">전체 보기</a></div><div class="pgrid">' + pick.map(function (p) { return placeCard(p, true); }).join('') + '</div>';
    });
  };

  /* ---------- 장비 대여 ---------- */
  views.gear = function () {
    S.openedAt = Date.now();
    if (S.prefill) { S.cart = S.prefill.cart; S.start = S.prefill.start || ''; S.end = S.prefill.end || ''; S.prefill = null; }
    var b = dateBounds();
    app.innerHTML =
      ph('Reserve', '장비 대여 예약', '경기도 안에서 촬영하면 누구나 무료로 빌릴_수_있어요. 수령·반납은 진흥원_방문만_가능합니다(택배·퀵·우편_불가).') +
      msg('info', '예약이 끝나면 <strong>예약코드</strong>가 나와요. 수령하러 방문할_때 이_코드를 보여 주세요.') +
      '<form id="gear-form" novalidate><div class="plate">' +
      '<section class="stepsec">' + stepH(1, '대여 기간') + '<div class="fields">' +
      '<div class="field"><label for="d-start">수령일 <span class="hint">평일만</span></label><input type="date" id="d-start" min="' + b.min + '" max="' + b.max + '" value="' + esc(S.start) + '"></div>' +
      '<div class="field"><label for="d-end">반납일 <span class="hint">최대 ' + b.maxDays + '일</span></label><input type="date" id="d-end" min="' + b.min + '" max="' + b.max + '" value="' + esc(S.end) + '"></div>' +
      '<div class="field"><label for="d-slot">수령하러 오는 시간 <span class="hint">10시~17시</span></label><select id="d-slot">' + opts(Core.VISIT_SLOTS, S.slot, '시간대 선택') + '</select></div></div>' +
      '<div id="date-msg"></div></section>' +
      '<section class="stepsec">' + stepH(2, '빌릴 물품', '담은 수량은 주황 칸으로 보여요') + '<div id="items"><p class="muted">' + (Object.keys(S.cart).length ? '추천받은 구성이 담겨 있어요. 대여 기간을 고르면 남은 수량을 확인해 반영합니다.' : '먼저 대여 기간을 골라 주세요. 그 기간에 남은 수량이 나타납니다.') + '</p></div>' +
      '<p class="muted">키트를 어떻게 꾸릴지 모르겠다면 <a href="#/kit">키트 추천</a>을 먼저 받아 보세요.</p></section>' +
      '<section class="stepsec">' + stepH(3, '촬영 정보', '개인·작품 정보는 묻지 않아요') + '<div class="fields">' +
      '<div class="field"><label for="f-sigun">촬영 시군</label><select id="f-sigun">' + opts(Core.SIGUN, '', '선택') + '</select></div>' +
      '<div class="field"><label for="f-kind">촬영 종류</label><select id="f-kind">' + opts(Core.KINDS, '', '선택') + '</select></div>' +
      '<div class="field"><label for="f-staff">스탭 규모 <span class="hint">선택</span></label><select id="f-staff">' + opts(Core.STAFF_BANDS, '', '선택 안 함') + '</select></div></div>' +
      '<p class="muted">이 정보는 이용 통계와 키트 추천에만 쓰며, 개별 예약 내용은 공개하지 않습니다.</p></section>' +
      '<section class="stepsec">' + stepH(4, '확인해 주세요') +
      chk('visitOnly', '수령과 반납은 진흥원을 직접 방문해서 합니다. 택배·퀵·우편 반납은 안 됩니다.') +
      chk('damage', '사용 중 또는 운반 중 파손·분실하면 같은 제품으로 변상합니다.') +
      chk('vest', '안전통제 장비를 빌리면 안전 조끼도 함께 빌리고, 함께 반납합니다.') +
      chk('noPersonalInfo', '예약코드를 잃어버리면 다시 찾을 수 없고, 수령일 다음 날까지 방문하지 않으면 예약이 자동으로 해제됩니다.') +
      '<div class="hp" aria-hidden="true" style="position:absolute;left:-9999px"><label>웹사이트 <input type="text" id="f-website" tabindex="-1" autocomplete="off"></label></div>' +
      '</section></div>' +
      '<div class="cartbar no-print"><div><strong id="cart-sum">선택한 물품이 없어요</strong><div id="cart-sub" class="muted"></div></div><button class="btn" type="submit" id="btn-submit">예약하기</button></div>' +
      '<div id="submit-msg"></div></form>';

    $('#d-start').addEventListener('change', onDates);
    $('#d-end').addEventListener('change', onDates);
    $('#d-slot').addEventListener('change', function () { S.slot = this.value; });
    $('#gear-form').addEventListener('submit', onSubmit);
    $('#items').addEventListener('click', onStep);
    $('#items').addEventListener('change', onQtyInput);
    $('#items').addEventListener('keydown', function (ev) { if (ev.target.classList && ev.target.classList.contains('qty') && ev.key === 'Enter') { ev.preventDefault(); ev.target.blur(); } });
    $('#items').addEventListener('focusin', function (ev) { if (ev.target.classList && ev.target.classList.contains('qty')) ev.target.select(); });
    if (S.start && S.end) refreshAvail(); else updateCart();
  };
  function chk(k, t) { return '<label class="check"><input type="checkbox" data-consent="' + k + '"> <span>' + esc(t) + '</span></label>'; }

  function onDates() {
    var s = $('#d-start').value, e = $('#d-end').value, b = dateBounds();
    if (s && (!e || e < s)) { e = s; $('#d-end').value = e; }
    if (s && e && Core.diffDays(s, e) + 1 > b.maxDays) { e = Core.addDays(s, b.maxDays - 1); $('#d-end').value = e; }
    S.start = s; S.end = e;
    refreshAvail();
  }
  function dateProblems(s, e) {
    var p = [], b = dateBounds(), st = settings();
    if (Core.parseDate(s) == null || Core.parseDate(e) == null) return ['수령일과 반납일을 모두 선택해 주세요.'];
    if (s < b.min) p.push('수령일은 ' + ko(b.min) + ' 이후로 선택해 주세요.');
    if (e < s) p.push('반납일은 수령일 이후여야 해요.');
    if (e >= s && Core.diffDays(s, e) + 1 > b.maxDays) p.push('대여 기간은 최대 ' + b.maxDays + '일입니다.');
    if (Core.isClosed(s, st)) p.push('수령일(' + ko(s) + ')은 운영일이 아니에요. 평일을 골라 주세요.');
    if (Core.isClosed(e, st)) p.push('반납일(' + ko(e) + ')은 운영일이 아니에요. 평일을 골라 주세요.');
    return p;
  }
  function refreshAvail() {
    var box = $('#date-msg'), itemsBox = $('#items');
    var p = dateProblems(S.start, S.end);
    if (p.length) {
      box.innerHTML = (S.start && S.end) ? msg('err', list(p)) : '';
      S.avail = null; itemsBox.innerHTML = '<p class="muted">대여 기간을 올바르게 고르면 남은 수량이 나타납니다.</p>'; updateCart(); return;
    }
    box.innerHTML = '<p class="muted">' + ko(S.start) + ' 수령, ' + ko(S.end) + ' 반납 (' + (Core.diffDays(S.start, S.end) + 1) + '일)</p>';
    itemsBox.innerHTML = '<p class="loading">남은 수량을 확인하는 중…</p>';
    S.api.availability(S.start, S.end).then(function (r) {
      if (!r.ok) { itemsBox.innerHTML = msg('err', esc((r.errors || ['남은 수량을 불러오지 못했어요.']).join(' '))); return; }
      S.avail = r.avail; clampCart(); renderItems(); updateCart();
    }).catch(function () { itemsBox.innerHTML = msg('err', '서버에 연결하지 못했어요. 잠시 뒤에 다시 시도해 주세요.'); });
  }
  function maxFor(it) { var a = S.avail && S.avail[it.id]; return Math.min(it.max || it.stock, a ? a.remaining : 0); }
  function clampCart() {
    items().forEach(function (it) { if (S.cart[it.id] > maxFor(it)) S.cart[it.id] = maxFor(it); if (!S.cart[it.id]) delete S.cart[it.id]; });
    ensureVest();
  }
  function ensureVest() {
    var need = Core.requiredVests(S.cart, idx()), vest = idx().vest;
    if (need > 0 && vest && (S.cart.vest | 0) < need) S.cart.vest = Math.min(need, maxFor(vest));
    if (!S.cart.vest) delete S.cart.vest;
  }
  function renderItems() {
    var by = {}, cats = ['안전통제', '촬영지원'];
    items().forEach(function (it) { (by[it.category] = by[it.category] || []).push(it); });
    var need = Core.requiredVests(S.cart, idx());
    $('#items').innerHTML = cats.map(function (c) {
      if (!by[c]) return '';
      return '<h3 class="cat">' + (c === '안전통제' ? '안전통제 장비' : '촬영 장비') + '<span>' + by[c].length + '종</span></h3><div class="items">' + by[c].map(function (it) {
        var a = S.avail[it.id], mx = maxFor(it), q = S.cart[it.id] | 0, off = mx < 1;
        var minQ = (it.id === 'vest') ? need : 0;
        var note = it.note ? '<div class="sub">' + esc(it.note) + '</div>' : '';
        var pct = Math.round(a.remaining / a.stock * 100);
        return '<div class="item' + (off ? ' off' : '') + '">' + itemIcon(it) +
          '<div><div class="nm">' + esc(it.name) + '</div>' + note +
          gaugeHtml(a.remaining, a.stock, q) +
          '<div class="left">' + (off ? '<span>이 기간에는 남은 수량이 없어요</span>' : '<span>남은 <b>' + a.remaining + '</b>개</span><span>한 번에 최대 ' + (it.max || it.stock) + '개</span>') + '</div></div>' +
          '<div class="step" role="group" aria-label="' + esc(it.name) + ' 수량"><button type="button" data-act="dec" data-id="' + it.id + '"' + (q <= minQ ? ' disabled' : '') + ' aria-label="줄이기">−</button><input class="qty" id="q-' + it.id + '" data-id="' + it.id + '" type="text" inputmode="numeric" autocomplete="off" aria-label="' + esc(it.name) + ' 수량 직접 입력" value="' + q + '"' + (off ? ' disabled' : '') + '><button type="button" data-act="inc" data-id="' + it.id + '"' + (q >= mx ? ' disabled' : '') + ' aria-label="늘리기">+</button></div></div>';
      }).join('') + '</div>';
    }).join('');
  }
  function onStep(ev) {
    var btn = ev.target.closest('button[data-act]'); if (!btn) return;
    var id = btn.getAttribute('data-id'), it = idx()[id], q = S.cart[id] | 0;
    q += btn.getAttribute('data-act') === 'inc' ? 1 : -1;
    q = Math.max(0, Math.min(q, maxFor(it)));
    if (q) S.cart[id] = q; else delete S.cart[id];
    ensureVest(); renderItems(); updateCart();
    var again = $('[data-act="' + btn.getAttribute('data-act') + '"][data-id="' + id + '"]'); if (again && !again.disabled) again.focus();
  }
  // 수량 칸에 직접 입력: 숫자만 받고, 남은 수량·한 번에 최대 수량·조끼 최소 수량 안으로 맞춘다.
  function onQtyInput(ev) {
    var inp = ev.target.closest ? ev.target.closest('input.qty') : null; if (!inp) return;
    var id = inp.getAttribute('data-id'), it = idx()[id], raw = inp.value.replace(/[^0-9]/g, ''), q = raw === '' ? 0 : parseInt(raw, 10), mx = maxFor(it), note = '';
    if (q > mx) { q = mx; note = shortName(it.name) + '은(는) 이 기간에 최대 ' + mx + '개까지 담을 수 있어요.'; }
    if (id === 'vest') { var need = Core.requiredVests(S.cart, idx()); if (q < need) { q = need; note = '안전통제 장비를 담았으면 안전 조끼가 최소 ' + need + '개 필요해요.'; } }
    if (q) S.cart[id] = q; else delete S.cart[id];
    S.qtyNote = note;
    ensureVest(); renderItems(); updateCart();
  }
  function updateCart() {
    var kinds = 0, total = 0;
    for (var id in S.cart) { kinds++; total += S.cart[id]; }
    $('#cart-sum').textContent = kinds ? '선택한 물품 ' + kinds + '종 · ' + total + '개' : '선택한 물품이 없어요';
    var sub = '', rec = Core.recommendedVests(S.cart, idx());
    if (Core.requiredVests(S.cart, idx()) > 0 && (S.cart.vest | 0) < rec) sub = '안전 조끼는 최소 1개가 필수예요. 통제 요원 수만큼 있으면 좋아서 ' + rec + '개를 권장해요.';
    $('#cart-sub').textContent = (S.qtyNote ? S.qtyNote + ' ' : '') + sub; S.qtyNote = '';
  }
  function onSubmit(ev) {
    ev.preventDefault();
    var box = $('#submit-msg'), btn = $('#btn-submit');
    var consent = {}; $$('[data-consent]').forEach(function (c) { consent[c.getAttribute('data-consent')] = c.checked; });
    var payload = {
      startDate: S.start, endDate: S.end, visitSlot: $('#d-slot').value, items: Object.assign({}, S.cart),
      sigun: $('#f-sigun').value, kind: $('#f-kind').value, staffBand: $('#f-staff').value, consent: consent,
      website: $('#f-website').value, openedAt: S.openedAt
    };
    var check = S.avail ? items().map(function (it) { return Object.assign({}, it, { stock: S.avail[it.id] ? S.avail[it.id].remaining : 0 }); }) : items();
    var v = Core.validateReserve(payload, { items: check, settings: settings(), reservations: [], today: Core.todayKST() });
    if (!v.ok) { box.innerHTML = msg('err', '<strong>확인해 주세요</strong>' + list(v.errors)); box.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    btn.disabled = true; btn.textContent = '예약하는 중…'; box.innerHTML = '';
    S.api.reserve(payload).then(function (r) {
      if (!r.ok) {
        box.innerHTML = msg('err', '<strong>예약하지 못했어요</strong>' + list(r.errors || ['잠시 뒤에 다시 시도해 주세요.']));
        btn.disabled = false; btn.textContent = '예약하기'; refreshAvail(); return;
      }
      saveCode(r.reservation); S.cart = {}; S.start = ''; S.end = ''; S.slot = '';
      renderDone(r.reservation);
    }).catch(function () {
      box.innerHTML = msg('err', '서버에 연결하지 못했어요. 예약이 접수됐는지 확실하지 않으니, 잠시 뒤 다시 시도하기 전에 <a href="#/my">내 예약</a>을 확인해 주세요.');
      btn.disabled = false; btn.textContent = '예약하기';
    });
  }
  function renderDone(r) {
    app.innerHTML =
      '<article class="ticket"><div class="ticket-main"><p class="eyebrow">Reservation</p><h1>예약이 접수됐어요</h1><p class="lede" style="margin-bottom:18px">수령일에 이 예약코드를 진흥원에서 보여 주세요.</p>' +
      '<p><span class="code" id="the-code">' + esc(r.code) + '</span></p>' +
      '<div class="row no-print"><button class="btn sm" id="copy" type="button">코드 복사</button><a class="btn sm alt" href="#/receipt/' + esc(r.code) + '">인수증 미리 채워 인쇄</a><a class="btn sm alt" href="#/my/' + esc(r.code) + '">예약 확인</a></div></div>' +
      '<div class="ticket-tear" aria-hidden="true"></div>' +
      '<div class="ticket-sub"><dl class="kv"><dt>수령일</dt><dd>' + ko(r.startDate) + '</dd>' + (r.visitSlot ? '<dt>방문 시간</dt><dd>' + esc(r.visitSlot) + '</dd>' : '') + '<dt>반납일</dt><dd>' + ko(r.endDate) + '</dd><dt>촬영 시군</dt><dd>' + esc(r.sigun) + '</dd></dl>' +
      itemsTable(r.items) +
      msg('warn', '<strong>코드를 꼭 저장해 두세요.</strong> 이 사이트는 이름·연락처를 받지 않기 때문에 코드를 잃어버리면 예약을 찾을 수 없어요. 화면을 캡처하거나 적어 두세요. (이 기기에도 자동 저장돼요.)') +
      msg('info', '수령일 <strong>다음 날까지</strong> 방문하지 않으면 예약이 자동으로 해제됩니다. 일정이 바뀌면 <a href="#/my/' + esc(r.code) + '">내 예약</a>에서 취소해 주세요.') + '</div></article>';
    $('#copy').addEventListener('click', function () {
      var b = this, done = function () { b.textContent = '복사했어요'; };
      if (navigator.clipboard) navigator.clipboard.writeText(r.code).then(done, done); else done();
    });
    window.scrollTo(0, 0);
  }

  /* ---------- 키트 추천 ---------- */
  views.kit = function () {
    var o = S.rules.options, b = dateBounds();
    app.innerHTML =
      ph('Kit', '키트 추천', '촬영 환경을 고르면 필요한 물품과_수량, 현장_체크리스트를 알려 드려요. 수량은 담당자가_정한 규칙표로 계산합니다.') +
      '<form id="kit-form" class="plate" style="padding-top:30px;padding-bottom:26px" novalidate>' +
      f('촬영 장소', seg('place', o.place)) + f('촬영 시간', seg('time', o.time)) + f('하루 촬영 시간', seg('hours', o.hours)) +
      f('차량이 지나가거나 움직이는 장면이 있나요?', seg('vehicle', [{ v: '0', t: '아니요' }, { v: '1', t: '예' }])) +
      f('보행자·주민이 많은 곳인가요?', seg('crowd', [{ v: '0', t: '아니요' }, { v: '1', t: '예' }])) +
      '<div class="fields">' +
      '<div class="field"><label for="k-control">도로·구역을 막아야 하는 지점 수</label><select id="k-control">' + [0, 1, 2, 3, 4, 5, 6, 7, 8].map(function (n) { return '<option value="' + n + '"' + (n === 1 ? ' selected' : '') + '>' + n + '곳</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="k-staff">스탭 규모</label><select id="k-staff">' + o.staff.map(function (s, i) { return '<option value="' + i + '"' + (i === 1 ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="k-kind">촬영 종류</label><select id="k-kind">' + opts(Core.KINDS, Core.KINDS[6]) + '</select></div></div>' +
      '<details><summary>남은 수량까지 확인하기 (선택)</summary><div class="fields" style="margin-top:10px"><div class="field"><label for="k-start">수령일</label><input type="date" id="k-start" min="' + b.min + '" max="' + b.max + '"></div><div class="field"><label for="k-end">반납일</label><input type="date" id="k-end" min="' + b.min + '" max="' + b.max + '"></div></div></details>' +
      '<p><button class="btn" type="submit">추천 받기</button></p></form><div id="kit-out"></div>';
    $('#kit-form').addEventListener('submit', onKit);
  };
  function f(label, html) { return '<div class="field"><label>' + esc(label) + '</label>' + html + '</div>'; }
  function radio(name) { var el = $('input[name="' + name + '"]:checked'); return el ? el.value : ''; }
  function onKit(ev) {
    ev.preventDefault();
    var inp = { place: radio('place'), time: radio('time'), hours: radio('hours'), vehicle: radio('vehicle') === '1', crowd: radio('crowd') === '1', control: +$('#k-control').value, tier: +$('#k-staff').value, kind: $('#k-kind').value };
    var s = $('#k-start').value, e = $('#k-end').value, out = $('#kit-out');
    var list0 = Kit.compute(inp, S.rules, idx());
    var useDates = s && e && !dateProblems(s, e).length;
    var p = useDates ? S.api.availability(s, e).then(function (r) { return r.ok ? r.avail : null; }) : Promise.resolve(null);
    p.then(function (avail) {
      if (!avail) { avail = {}; items().forEach(function (it) { avail[it.id] = { stock: it.stock, remaining: it.stock }; }); }
      var fitted = Kit.fit(list0, avail).filter(function (x) { return x.want > 0; });
      var shorts = fitted.filter(function (x) { return x.short > 0; });
      var chk = Kit.checklist(inp, S.texts);
      var cartNow = {}; fitted.forEach(function (x) { if (x.qty > 0) cartNow[x.id] = x.qty; });
      var ix = idx();
      out.innerHTML = '<div class="plate" style="padding-top:28px;padding-bottom:18px"><h2>추천 구성</h2>' +
        (fitted.length ? '' : '<p>이 조건에서는 따로 빌릴 필요가 없어 보여요.</p>') +
        (shorts.length ? msg('warn', '<strong>' + (useDates ? '선택한 기간에' : '보유 수량 기준으로') + ' 부족한 물품이 있어요.</strong>' + list(shorts.map(function (x) { return ix[x.id].name + ': ' + x.want + '개가 필요한데 ' + x.qty + '개만 빌릴 수 있어요. 날짜를 조정하거나 부족분은 직접 준비해 주세요.'; }))) : '') +
        '<div class="items">' + fitted.map(function (x) {
          var it = ix[x.id];
          return '<div class="item">' + itemIcon(it) + '<div><div class="nm">' + esc(it.name) + '</div><div class="sub">' + x.reasons.map(esc).join(' ') + '</div></div><div style="text-align:right"><strong class="num" style="font-size:1.5rem">' + x.qty + '</strong><span class="muted"> 개</span>' + (x.short ? '<div><span class="badge warn">' + x.short + '개 부족</span></div>' : '') + '</div></div>';
        }).join('') + '</div>' +
        (fitted.length ? '<p style="margin-top:14px"><button class="btn" id="kit-go" type="button">이 구성으로 예약하러 가기</button></p>' : '') +
        '</div>' +
        '<section class="block"><h2>현장 체크리스트</h2><div class="well"><ul class="clean">' + chk.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div></section>' +
        msg('info', esc(S.texts.notice)) +
        (S.rules.reviewed === false ? '<p class="muted">수량 규칙과 설명 문구는 담당자 검수 전 초안입니다.</p>' : '');
      var go = $('#kit-go');
      if (go) go.addEventListener('click', function () { S.prefill = { cart: cartNow, start: useDates ? s : '', end: useDates ? e : '' }; location.hash = '#/gear'; });
      out.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  /* ---------- 내 예약 ---------- */
  views.my = function (parts) {
    app.innerHTML = ph('My reservation', '내 예약 확인', '예약할 때 받은 코드를 입력하세요. 코드가 없으면 예약을_찾을_수_없어요.') +
      '<form id="my-form" class="card" novalidate><div class="field"><label for="my-code">예약코드</label><input type="text" id="my-code" placeholder="GCA-XXXX-XXXX" autocomplete="off" autocapitalize="characters" inputmode="text"></div><button class="btn" type="submit">확인</button></form>' +
      '<div id="my-out"></div><div id="my-saved"></div>' +
      '<p class="muted" style="margin-top:22px">' + K('예약 없이 현장에서 빌리는 분을 위한 ') + '<a href="#/receipt/blank">빈 인수증 인쇄</a>' + K('도 있어요.') + '</p>';
    $('#my-form').addEventListener('submit', function (e) { e.preventDefault(); lookup($('#my-code').value); });
    renderSaved();
    if (parts[0]) { $('#my-code').value = parts[0]; lookup(parts[0]); }
  };
  function renderSaved() {
    var l = savedCodes().slice(0, 5), box = $('#my-saved');
    if (!l.length) { box.innerHTML = ''; return; }
    box.innerHTML = '<div class="card"><h3>이 기기에 저장된 예약</h3><div id="saved-list"><p class="loading">불러오는 중…</p></div><button class="btn sm alt" id="clear-saved" type="button">저장 목록 지우기</button></div>';
    Promise.all(l.map(function (x) { return S.api.lookup(x.code).then(function (r) { return { x: x, r: r }; }); })).then(function (rs) {
      var el = $('#saved-list'); if (!el) return;
      el.innerHTML = '<table><tbody>' + rs.map(function (o) {
        return '<tr><td><a href="#/my/' + esc(o.x.code) + '">' + esc(o.x.code) + '</a></td><td>' + ko(o.x.start).replace(/\(.\)/, '') + ' ~ ' + ko(o.x.end).replace(/\(.\)/, '') + '</td><td>' + (o.r.ok ? statusBadge(o.r.reservation.status) : '<span class="badge bad">찾을 수 없음</span>') + '</td></tr>';
      }).join('') + '</tbody></table>';
    });
    $('#clear-saved').addEventListener('click', function () { store.set('gcon_my_codes', '[]'); renderSaved(); });
  }
  function lookup(code) {
    var out = $('#my-out'); out.innerHTML = '<p class="loading">찾는 중…</p>';
    S.api.lookup(code).then(function (r) {
      if (!r.ok) { out.innerHTML = msg('err', esc((r.errors || ['예약을 찾지 못했어요.']).join(' '))); return; }
      var x = r.reservation, can = x.status === '예약됨';
      out.innerHTML = '<div class="card"><h2>' + esc(x.code) + ' ' + statusBadge(x.status) + '</h2>' +
        '<dl class="kv"><dt>수령일</dt><dd>' + ko(x.startDate) + '</dd>' + (x.visitSlot ? '<dt>방문 시간</dt><dd>' + esc(x.visitSlot) + '</dd>' : '') + '<dt>반납일</dt><dd>' + ko(x.endDate) + '</dd><dt>촬영 시군</dt><dd>' + esc(x.sigun) + '</dd></dl>' + itemsTable(x.items) +
        (can ? msg('info', '수령일 다음 날까지 방문하지 않으면 자동으로 해제돼요.') : '') +
        '<div class="row no-print" style="margin-top:12px">' + ((x.status === '예약됨' || x.status === '수령' || x.status === '반납') ? '<a class="btn sm alt" href="#/receipt/' + esc(x.code) + '">인수증 미리 채워 인쇄</a>' : '') + (can ? '<button class="btn sm danger" id="cancel" type="button">예약 취소</button>' : '') + '</div></div>';
      var c = $('#cancel');
      if (c) c.addEventListener('click', function () {
        if (!window.confirm('이 예약을 취소할까요? 취소하면 되돌릴 수 없어요.')) return;
        S.api.cancel(x.code).then(function (rr) { if (rr.ok) lookup(x.code); else out.innerHTML = msg('err', esc((rr.errors || ['취소하지 못했어요.']).join(' '))); });
      });
    }).catch(function () { out.innerHTML = msg('err', '서버에 연결하지 못했어요. 잠시 뒤에 다시 시도해 주세요.'); });
  }

  /* ---------- 인수증 (개인정보 칸은 비워 둠) ---------- */
  // #/receipt/예약코드 : 예약 내용이 미리 채워진 인수증 / #/receipt/blank : 예약 없이 빌리는 분을 위한 빈 인수증(현장·관리자용)
  function receiptHtml(x) {
    var q = {}, safety = items().filter(function (i) { return i.category === '안전통제'; }), film = items().filter(function (i) { return i.category !== '안전통제'; });
    if (x) x.items.forEach(function (i) { q[i.id] = i.qty; });
    var n = Math.max(safety.length, film.length), rows = '';
    for (var i = 0; i < n; i++) {
      var a = safety[i], b = film[i];
      rows += '<tr><td colspan="2">' + (a ? esc(a.name) : '') + '</td><td class="c">' + (a && q[a.id] ? q[a.id] : '') + '</td><td colspan="2">' + (b ? esc(b.name) : '') + '</td><td class="c">' + (b && q[b.id] ? q[b.id] : '') + '</td></tr>';
    }
    var blankDate = '20&nbsp;&nbsp;&nbsp;&nbsp;년&nbsp;&nbsp;&nbsp;&nbsp;월&nbsp;&nbsp;&nbsp;&nbsp;일';
    return '<div class="receipt"><h2>촬영현장지원 물품 인수증</h2>' +
      '<table><tr><th colspan="6">인수자</th></tr>' +
      '<tr class="tall"><th>제작사(팀)</th><td colspan="5" class="blank"></td></tr><tr class="tall"><th>영상물 제목</th><td colspan="5" class="blank"></td></tr>' +
      '<tr class="tall"><th>연락처</th><td colspan="5" class="blank"></td></tr>' +
      '<tr><th colspan="6">인수 물품</th></tr><tr><th colspan="3">안전 통제 장비</th><th colspan="3">촬영 장비</th></tr>' +
      '<tr><th colspan="2">물품</th><th>개수</th><th colspan="2">물품</th><th>개수</th></tr>' + rows +
      '<tr><th>사용장소</th><td colspan="5">' + (x ? esc(x.sigun) : '') + '</td></tr>' +
      '<tr><th>사용기간</th><td colspan="5">' + (x ? ko(x.startDate) + ' ~ ' + ko(x.endDate) : '20&nbsp;&nbsp;&nbsp;년&nbsp;&nbsp;&nbsp;월&nbsp;&nbsp;&nbsp;일&nbsp;&nbsp;~&nbsp;&nbsp;&nbsp;월&nbsp;&nbsp;&nbsp;일') + '</td></tr>' +
      '<tr><th>반납일</th><td colspan="2">' + (x ? ko(x.endDate) : '&nbsp;&nbsp;&nbsp;&nbsp;월&nbsp;&nbsp;&nbsp;&nbsp;일') + '</td><th>수령 방문</th><td colspan="2">' + (x && x.visitSlot ? esc(x.visitSlot) : '') + '</td></tr>' +
      '<tr><th>예약코드</th><td colspan="5">' + (x ? esc(x.code) : '') + '</td></tr></table>' +
      '<div class="fine"><p>▸ 상기 물품을 사용기간 내 사용 후, 반납 일자에 경기콘텐츠진흥원 담당자에게 직접 반납해야 함. (택배, 퀵 서비스, 우편 반납 불가)</p>' +
      '<p>▸ 물품사용 및 운송 중 파손, 망실될 경우 제작사(팀)에서 동일 제품으로 변상해야 함.</p>' +
      '<p>▸ <strong><u>안전통제장비 대여 시 안전조끼 필수 대여</u></strong>하며, 상기 대여 물품과 함께 반납해야 함.</p>' +
      '<p><strong>본인은 대여 물품의 수량과 상태가 이상 없음을 확인하였으며, 상기와 같은 조건에 동의합니다.</strong></p>' +
      '<p><strong>경기콘텐츠진흥원의 촬영현장지원 물품대여를 요청합니다.</strong></p></div>' +
      '<p class="rdate">' + blankDate + '</p>' +
      '<table class="sign"><tr><th>대여자 성명</th><th>진흥원 담당자 성명</th><th>인수자 성명</th></tr>' +
      '<tr><td><span>(서명 또는 인)</span></td><td><span>(서명 또는 인)</span></td><td><span>(서명 또는 인)</span></td></tr></table></div>';
  }
  views.receipt = function (parts) {
    var code = parts[0] || '', toolbar = function (back) {
      return '<div class="no-print row" style="margin-bottom:14px"><button class="btn" id="do-print" type="button">인쇄하기</button><a class="btn alt" href="' + back + '">돌아가기</a></div>';
    }, hint = msg('info', '이름·연락처·제작사·영상물 제목·성명·서명은 일부러 비워 두었어요. 현장에서 직접 적어 주세요.').replace('class="msg info"', 'class="msg info no-print"');
    function show(x, back) {
      app.innerHTML = toolbar(back) + hint + receiptHtml(x);
      $('#do-print').addEventListener('click', function () { window.print(); });
    }
    if (!code || code.toLowerCase() === 'blank') { show(null, '#/my'); return; }
    app.innerHTML = '<p class="loading">인수증을 만드는 중…</p>';
    S.api.lookup(code).then(function (r) {
      if (!r.ok) { app.innerHTML = msg('err', esc((r.errors || ['예약을 찾지 못했어요.']).join(' '))) + '<p><a href="#/my">내 예약으로 돌아가기</a></p>'; return; }
      var x = r.reservation;
      if (x.status === '해제' || x.status === '취소') { app.innerHTML = msg('warn', '이 예약은 ' + esc(x.status) + ' 상태라 인수증을 만들 수 없어요.') + '<p><a href="#/my/' + esc(x.code) + '">내 예약으로 돌아가기</a></p>'; return; }
      show(x, '#/my/' + encodeURIComponent(x.code));
    }).catch(function () { app.innerHTML = msg('err', '서버에 연결하지 못했어요. 잠시 뒤에 다시 시도해 주세요.'); });
  };

  /* ---------- 촬영 준비 ---------- */
  views.prep = function () {
    var o = S.rules.options;
    app.innerHTML = ph('Prepare', '촬영 준비', '이 화면의 계산과 선택은 내 브라우저_안에서만 처리되고 서버로_보내지_않습니다.') +
      '<div class="card"><h2>로케이션 촬영지원 신청</h2>' + (S.cfg.applyFormUrl ? '<p>' + K(esc(S.cfg.applyFormNote || '') + loginHint()) + '</p><p><a class="btn" href="' + esc(S.cfg.applyFormUrl) + '" target="_blank" rel="noopener">촬영지원 신청서 열기</a></p>' : '<p>' + esc(S.cfg.applyFormNote || '') + ' 신청서 링크는 준비 중입니다.</p>') + '</div>' +
      '<div class="card"><h2>신청은 언제까지 해야 할까요?</h2><div class="fields"><div class="field"><label for="p-date">크랭크인(첫 촬영) 예정일</label><input type="date" id="p-date"></div><div class="field"><label for="p-kind">작품 종류</label><select id="p-kind">' + opts(Core.KINDS, Core.KINDS[0]) + '</select></div></div><button class="btn" id="p-go" type="button">확인하기</button><div id="p-out"></div></div>' +
      '<div class="card"><h2>우리 지역이 맞나요?</h2><div class="field"><label for="a-reg">촬영하려는 지역</label><select id="a-reg">' + opts(['경기도', '서울', '인천', '그 밖의 지역'], '', '선택') + '</select></div><div id="a-out"></div></div>' +
      '<div class="card"><h2>촬영 전 체크리스트</h2><div class="field"><label for="c-place">촬영 장소</label><select id="c-place"><option value="">선택</option>' + o.place.map(function (p) { return '<option value="' + p.v + '">' + esc(p.t) + '</option>'; }).join('') + '</select></div><div id="c-out"></div></div>';
    $('#p-go').addEventListener('click', onLead);
    $('#a-reg').addEventListener('change', function () {
      var v = this.value, t = { '경기도': msg('ok', '경기도 안에서 촬영한다면 장비 대여와 로케이션 촬영지원을 이용할 수 있어요.'), '서울': msg('info', '서울 촬영은 서울영상위원회에 문의해 주세요. 경기도와 서울에 걸쳐 촬영하면 경기도 구간만 이곳에서 지원해요. ' + ext(fk('contacts'), '전국 영상위원회 연락처 보기')), '인천': msg('info', '인천 촬영은 인천영상위원회에 문의해 주세요. 경기도와 인천에 걸쳐 촬영하면 경기도 구간만 이곳에서 지원해요. ' + ext(fk('contacts'), '전국 영상위원회 연락처 보기')), '그 밖의 지역': msg('info', '해당 지역의 영상위원회나 지자체에 문의해 주세요. ' + ext(fk('contacts'), '전국 영상위원회 연락처 보기')) }[v] || '';
      $('#a-out').innerHTML = t;
    });
    $('#c-place').addEventListener('change', function () {
      if (!this.value) { $('#c-out').innerHTML = ''; return; }
      var l = (S.texts.byPlace[this.value] || []).concat(S.texts.general);
      $('#c-out').innerHTML = '<ul class="clean">' + l.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
    });
  };
  function onLead() {
    var d = $('#p-date').value, kind = $('#p-kind').value, out = $('#p-out');
    if (Core.parseDate(d) == null) { out.innerHTML = msg('err', '날짜를 선택해 주세요.'); return; }
    var left = Core.diffDays(Core.todayKST(), d);
    loadTrends().then(function (t) {
      var row = t && t.leadTime && t.leadTime.filter(function (x) { return x.label === kind; })[0], weeks = row ? row.weeks : null;
      var typ = weeks ? '이 종류의 작품은 보통 첫 촬영 <strong>약 ' + weeks + '주 전</strong>에 신청했어요(중앙값, 신청 ' + row.n + '건 기준).' : '';
      if (left < 0) out.innerHTML = msg('err', '첫 촬영일이 이미 지났어요. 지금 바로 문의해 주세요.');
      else if (weeks && left < weeks * 7) out.innerHTML = msg('warn', '첫 촬영까지 <strong>' + left + '일</strong> 남았어요. ' + typ + ' 평소보다 빠듯하니 서둘러 신청하세요. 장소와 협조 기관과 협의할 시간이 필요해요.');
      else out.innerHTML = msg('ok', '첫 촬영까지 <strong>' + left + '일</strong> 남았어요. ' + (typ || '') + ' 일찍 신청할수록 좋아요.');
    });
  }

  /* ---------- 로케이션 소개 (담당자가 고르고 승인한 장소만) ---------- */
  function loadPlaces() {
    if (S.places !== undefined) return Promise.resolve(S.places);
    return json('data/locations.json').then(function (d) { S.places = d && d.items ? d : null; return S.places; }, function () { S.places = null; return null; });
  }
  function placeCard(p, compact) {
    var tags = (p.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('');
    return '<article class="card pcard' + (compact ? ' compact' : '') + '">' +
      '<div class="pimg"><img src="' + esc(p.photo) + '" alt="' + esc(p.name) + (p.sample ? ' 예시 이미지' : ' 사진') + '" loading="lazy">' + (p.sample ? '<span class="sample-tag">예시</span>' : '') + '<span class="loc">' + esc(p.sigun) + '</span></div>' +
      '<div class="pbody"><div class="pmeta"><span class="badge">' + esc(p.type) + '</span>' + (p.featured !== '상시' ? '<span class="badge ok">' + esc(p.featured) + '</span>' : '') + '</div>' +
      '<h3>' + esc(p.name) + '</h3><p class="sum">' + esc(p.summary) + '</p>' +
      (tags ? '<div class="tags" aria-label="어울리는 촬영">' + tags + '</div>' : '') +
      (!compact && p.note ? '<p class="pnote"><strong>촬영 참고</strong> ' + esc(p.note) + '</p>' : '') +
      (!compact && p.credit ? '<p class="muted pcredit">사진 출처: ' + esc(p.credit) + '</p>' : '') + '</div></article>';
  }
  views.places = function () {
    app.innerHTML = subnav('places') + ph('Locations', '로케이션 소개', '') + '<p class="loading">불러오는 중…</p>';
    loadPlaces().then(function (pl) {
      var rule = msg('info', '<strong>이렇게 골라 소개해요.</strong> 담당자가 공개해도_되는_곳인지 하나씩 확인해 승인한 장소만 올립니다. 마지막 촬영이 끝난 지 충분히_지난 곳만 소개하고, 특정_작품과 연결하지 않습니다. 지금 촬영 중인 장소는 올리지 않아요.');
      if (!pl || !pl.items.length) { app.innerHTML = subnav('places') + ph('Locations', '로케이션 소개', '') + rule + msg('info', '소개할 장소를 준비하고 있어요. 곧 올라옵니다.'); return; }
      var all = pl.items, state = { feat: 'all', sigun: '', type: '' };
      var siguns = Core.SIGUN.filter(function (s) { return all.some(function (p) { return p.sigun === s; }); });
      var types = all.map(function (p) { return p.type; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
      var cnt = function (f) { return f === 'all' ? all.length : all.filter(function (p) { return p.featured === f; }).length; };
      app.innerHTML = subnav('places') + ph('Locations', '로케이션 소개', '경기도에서 촬영하기 좋은 장소를 사진과 함께 소개합니다.') + rule +
        (pl.meta && pl.meta.hasSample ? msg('warn', '<strong>시연용 예시입니다.</strong> 화면의 장소·설명·이미지는 실제 소개가 아니며, 담당자가 실제 장소와 사진으로 바꾸면 이 안내가 사라집니다.') : '') +
        '<div class="tabs" role="group" aria-label="추천 구분">' + [['all', '전체'], ['이번 주', '이번 주'], ['이달의', '이달의']].map(function (t, i) { return '<button type="button" data-f="' + t[0] + '" aria-pressed="' + (i === 0) + '">' + t[1] + ' ' + cnt(t[0]) + '</button>'; }).join('') + '</div>' +
        '<div class="fields" style="margin-bottom:22px"><div class="field"><label for="pl-sigun">시군</label><select id="pl-sigun">' + opts(siguns, '', '전체') + '</select></div><div class="field"><label for="pl-type">장소 유형</label><select id="pl-type">' + opts(types, '', '전체') + '</select></div></div>' +
        '<p class="muted" id="pl-count" aria-live="polite"></p><div class="pgrid" id="pl-grid"></div>' +
        '<div class="apply-cta"><p><strong>더 많은 로케이션이 궁금한가요?</strong><br>' + K('필름코리아는 한국영상위원회가_운영하는 전국_로케이션·촬영지원_사이트예요. 경기도를_포함한 전국_영상위원회의 로케이션을 찾아보고, 촬영지원도_신청할_수_있어요.') + '</p><div class="row">' + ext(fk('location'), '필름코리아에서 찾아보기', 'btn alt') + ext(fk('request'), '촬영지원 신청 안내', 'btn alt') + '</div></div>' +
        (formUrl() ? '<div class="apply-cta"><p><strong>마음에 드는 장소가 있나요?</strong><br>' + K('촬영지원 신청서에 장소_이름을 적어 신청해 주세요. 신청서는 진흥원의 별도 폼이라 연락받을_정보를 적어야 해요.' + loginHint()) + '</p>' + ext(formUrl(), '촬영지원 신청서 열기', 'btn') + '</div>' : '');
      function draw() {
        var list = all.filter(function (p) { return (state.feat === 'all' || p.featured === state.feat) && (!state.sigun || p.sigun === state.sigun) && (!state.type || p.type === state.type); });
        $('#pl-count').textContent = list.length + '곳';
        $('#pl-grid').innerHTML = list.length ? list.map(function (p) { return placeCard(p, false); }).join('') : '<p class="muted">조건에 맞는 장소가 없어요. 다른 조건을 골라 보세요.</p>';
      }
      $$('.tabs button').forEach(function (b) { b.addEventListener('click', function () { state.feat = b.getAttribute('data-f'); $$('.tabs button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); draw(); }); });
      $('#pl-sigun').addEventListener('change', function () { state.sigun = this.value; draw(); });
      $('#pl-type').addEventListener('change', function () { state.type = this.value; draw(); });
      draw();
    });
  };

  /* ---------- 로케이션 트렌드 ---------- */
  function loadTrends() {
    if (S.trends !== undefined) return Promise.resolve(S.trends);
    return json('data/trends.json').then(function (t) { S.trends = t; return t; }, function () { S.trends = null; return null; });
  }
  views.trends = function () {
    app.innerHTML = subnav('trends') + ph('Trends', '로케이션 트렌드', '') + '<p class="loading">불러오는 중…</p>';
    loadTrends().then(function (t) {
      if (!t) { app.innerHTML = subnav('trends') + ph('Trends', '로케이션 트렌드', '') + msg('info', '아직 공개된 집계가 없어요. 곧 올라옵니다.'); return; }
      var m = t.meta || {};
      function sec(title, body, note) { return '<section class="block"><h2>' + title + '</h2><div class="well">' + body + '</div>' + (note ? '<p class="muted">' + K(note) + '</p>' : '') + '</section>'; }
      var place = t.placeTypes || {};
      app.innerHTML = subnav('trends') + ph('Trends', '로케이션 트렌드', '') + '<div id="trend-places"></div><p class="muted" style="margin-bottom:34px">' + K('촬영지원 신청서를 집계한 통계입니다. 기준일은 ' + esc(m.asOf || '') + (m.provisional ? '이고 잠정 집계입니다.' : '입니다.') + ' 작품·제작사·신청자는 식별할 수 없고, ' + (m.k || 3) + '건_미만인 항목은 표시하지 않습니다.') + '</p>' +
        sec('월별 촬영지원 신청', Charts.columns((t.monthly || []).map(function (r) { return { label: r.month.slice(5) + '월' + (r.month === (m.asOf || '').slice(0, 7) ? '*' : ''), count: r.count }; })), '신청서 1건을 1건으로 셉니다. *표시는 기준일까지의 건수라 아직 진행 중인 달입니다.') +
        sec('작품 종류', Charts.hbars(t.kinds || [], { percent: true })) +
        sec('많이 찾는 촬영 장소 유형', '<div class="tabs" role="group" aria-label="기간 선택"><button type="button" data-p="recent" aria-pressed="true">최근 4주</button><button type="button" data-p="year" aria-pressed="false">올해 누적</button></div><div id="place-out"></div>', '신청서 본문에서 장소 유형을 읽어 센 값이라 한 신청이 여러 유형에 들어갈 수 있어요.') +
        (t.kindPlaces && t.kindPlaces.length ? sec('작품 종류별로 많이 찾는 장소', '<table><thead><tr><th>작품 종류</th><th>많이 찾는 장소 유형</th></tr></thead><tbody>' + t.kindPlaces.map(function (r) { return '<tr><td>' + esc(r.kind) + '</td><td>' + r.top.map(esc).join(', ') + '</td></tr>'; }).join('') + '</tbody></table>') : '') +
        sec('시군별 촬영 신청', Charts.hbars((t.sigun && t.sigun.items) || []), '촬영 시군이 신청서에 적힌 경우만 집계해요. 올해 누적이며 ' + (m.k || 3) + '건 미만인 시군은 뺐어요.') +
        (t.leadTime && t.leadTime.length ? sec('신청 시기', '<table><thead><tr><th>작품 종류</th><th class="num">보통 첫 촬영 몇 주 전에 신청?</th></tr></thead><tbody>' + t.leadTime.map(function (r) { return '<tr><td>' + esc(r.label) + '</td><td class="num">약 ' + r.weeks + '주 전</td></tr>'; }).join('') + '</tbody></table>', '신청일과 첫 촬영일의 차이(중앙값)입니다. 신청이 10건 이상인 종류만 보여 드려요. <a href="#/prep">내 일정 확인하기</a>') : '') +
        sec('촬영 규모', '<h3>스탭 인원</h3>' + Charts.hbars(t.staff || []) + '<h3 style="margin-top:14px">제작 예산</h3>' + Charts.hbars(t.budget || []) + (t.duration ? '<p style="margin-top:14px">촬영 기간은 중앙값 <strong>' + t.duration.medianDays + '일</strong>이에요.</p>' : '')) +
        sec('1차 배급 매체', Charts.hbars(t.distribution || [], { percent: true })) +
        '<div id="rental-stats"></div>' +
        '<p class="muted"><a href="#/privacy">어떤 정보를 어떻게 공개하는지 보기</a></p>';
      loadPlaces().then(function (pl) {
        var el = $('#trend-places'); if (!el || !pl || !pl.items.length) return;
        var pick = pl.items.filter(function (p) { return p.featured !== '상시'; }).slice(0, 3);
        if (!pick.length) pick = pl.items.slice(0, 3);
        el.innerHTML = '<section class="block"><h2>이번에 소개하는 로케이션</h2><p class="muted">통계가 아니라 담당자가 직접 고른 장소입니다.' + (pl.meta && pl.meta.hasSample ? ' <strong>(시연용 예시)</strong>' : '') + '</p><div class="pgrid">' + pick.map(function (p) { return placeCard(p, true); }).join('') + '</div><p style="margin-top:16px"><a href="#/places">로케이션 소개 전체 보기</a></p></section>';
      });
      function drawPlace(p) { $('#place-out').innerHTML = Charts.hbars(p === 'recent' ? place.recent4w || [] : place.year || []); }
      drawPlace('recent');
      $$('.tabs button').forEach(function (b) { b.addEventListener('click', function () { $$('.tabs button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); drawPlace(b.getAttribute('data-p')); }); });
      S.api.stats().then(function (r) {
        if (!r || !r.ok || !r.items || !r.items.length) return;
        var el = $('#rental-stats'); if (el) el.innerHTML = sec('많이 빌린 물품', Charts.hbars(r.items), '최근 90일 대여 건수예요.');
      }).catch(function () { /* 무시 */ });
    });
  };

  /* ---------- 개인정보·공개 원칙 ---------- */
  views.privacy = function () {
    app.innerHTML = ph('Privacy', '개인정보와 공개 원칙', '이 사이트가 받지 않는 정보와, 통계·장소를 공개하는 기준입니다.') +
      '<div class="card"><h2>이 사이트는 개인정보를 받지 않습니다</h2><table><thead><tr><th>받는 정보</th><th>받지 않는 정보</th></tr></thead><tbody><tr><td>물품·수량, 수령일·반납일<br>촬영 시군, 촬영 종류, 스탭 규모(선택)<br>규정 확인 체크</td><td>이름, 연락처, 이메일<br>소속, 제작사, 작품명, 영상물 제목<br>주소, 구체적인 촬영 장소<br>자유롭게 쓰는 입력칸 전체<br>로그인, 접속자 추적</td></tr></tbody></table>' +
      '<p style="margin-top:12px">본인 확인은 수령일에 진흥원을 방문해 <strong>종이 인수증</strong>에 적는 방식으로 합니다. 예약은 코드로만 확인하기 때문에 코드를 잃어버리면 찾을 수 없습니다.</p></div>' +
      '<div class="card"><h2>로케이션 통계는 이렇게 공개합니다</h2><ul class="clean"><li>촬영지원 신청서 원본은 내부 업무용이며, 이 사이트는 원본에 연결돼 있지 않습니다. 가공·집계가 끝난 파일만 공개합니다.</li><li>작품명, 감독·배우, 제작사, 신청자 정보, 촬영 날짜, 구체 장소는 공개하지 않습니다.</li><li>' + 3 + '건 미만인 항목은 표시하지 않습니다.</li><li>시군은 올해 누적으로, 장소는 유형(도로·학교 등)까지만 보여 드립니다.</li><li>"로케이션 소개"의 구체적인 장소는 통계에서 자동으로 나온 것이 아니라, 담당자가 공개 가능 여부를 확인하고 승인한 곳만 올립니다. 마지막 촬영이 끝난 지 충분히 지난 곳이며, 특정 작품·인물·촬영 시점과 연결되는 내용은 쓰지 않습니다. 사진이 없는 곳은 소개하지 않고, 사진에 담긴 위치·기기 정보는 지웁니다.</li><li>공개 전에 작품명·인명이 섞여 있는지 자동으로 검사합니다.</li></ul></div>' +
      '<div class="card"><h2>알아 두세요</h2><ul class="clean"><li>로케이션 촬영지원 신청서는 이 사이트가 아니라 진흥원의 별도 구글 폼입니다. 담당자가 연락하려면 신청 정보가 필요해서, 신청서에서는 이름·연락처 같은 정보를 받습니다.</li><li>키트 추천은 참고용이며 최종 수량은 수령할 때 담당자가 확인합니다.</li><li>수량과 규정은 진흥원 사정에 따라 바뀔 수 있습니다.</li><li>이 사이트를 운영하는 곳: ' + esc(S.cfg.orgName || '') + (S.cfg.contact ? ' · 문의 ' + esc(S.cfg.contact) : '') + '</li></ul></div>';
  };

  /* ---------- 시작 ---------- */
  Promise.all([json('data/config.json'), json('data/equipment.json'), json('data/rules.json'), json('data/texts.json')]).then(function (a) {
    S.cfg = a[0]; S.rules = a[2]; S.texts = a[3];
    if (/[?&]demo=1/.test(location.search)) S.cfg.apiUrl = '';   // ?demo=1 : 서버에 보내지 않고 이 브라우저에서만 체험
    var api = Api.create(S.cfg, a[1]);
    return api.getMaster().then(function (m) { return m; }, function () { return a[1]; }).then(function (m) {
      S.master = m && m.items ? m : a[1]; S.api = api;
    });
  }).then(function () {
    if (S.api.demo) $('#notice-demo').hidden = false;
    $('#foot-org').innerHTML = '<strong>' + esc(S.cfg.orgName || '') + '</strong>이 운영합니다.' + (S.cfg.contact ? ' 문의 ' + esc(S.cfg.contact) : '') + (formUrl() ? ' ' + ext(formUrl(), '로케이션 촬영지원 신청서') : '') + ' ' + ext(fk('home'), '필름코리아');
    window.addEventListener('hashchange', route);
    route();
  }).catch(function () {
    app.innerHTML = '<div class="msg err" role="alert">페이지를 불러오지 못했어요. 새로고침해 주세요.</div>';
  });
})();
