/*
 * 예약 핵심 로직. 브라우저(체험 모드·화면 검증)와 Apps Script(백엔드)가 같은 파일을 씁니다.
 * 개인정보를 다루지 않습니다. 허용 필드는 whitelist로만 받습니다.
 * 이 파일을 고치면 backend/Core.gs 로 복사하세요: python pipeline/sync_core.py
 */
var Core = (function () {
  'use strict';

  var ACTIVE = ['예약됨', '수령'];
  var CODE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // 0,1,I,O 제외 32자
  var SIGUN = ['수원시', '성남시', '의정부시', '안양시', '부천시', '광명시', '평택시', '동두천시', '안산시', '고양시', '과천시', '구리시', '남양주시', '오산시', '시흥시', '군포시', '의왕시', '하남시', '용인시', '파주시', '이천시', '안성시', '김포시', '화성시', '광주시', '양주시', '포천시', '여주시', '연천군', '가평군', '양평군'];
  var KINDS = ['극영화/단편', '극영화/독립장편', '극영화/상업장편', 'TV/OTT 드라마', 'TV/OTT 예능/교양', '다큐멘터리', '뮤직비디오', '광고/PR영상', '기타 숏폼 영상', '기타(뉴스,화보 등)'];
  var STAFF_BANDS = ['9명 이하', '10~29명', '30~59명', '60~99명', '100명 이상'];
  var VISIT_SLOTS = ['10:00~11:00', '11:00~12:00', '12:00~13:00', '13:00~14:00', '14:00~15:00', '15:00~16:00', '16:00~17:00']; // 수령 방문은 10시~17시만
  var CONSENTS = ['visitOnly', 'damage', 'vest', 'noPersonalInfo'];
  var DAY_MS = 86400000;

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  /* ---------- 날짜 (모두 'YYYY-MM-DD' 문자열, 한국 시간 기준) ---------- */
  function todayKST(nowMs) {
    var d = new Date((nowMs == null ? Date.now() : nowMs) + 9 * 3600 * 1000);
    return d.toISOString().slice(0, 10);
  }
  function parseDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    if (!m) return null;
    var t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
    var d = new Date(t);
    if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return null;
    return t;
  }
  function fmt(t) {
    var d = new Date(t);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }
  function addDays(s, n) { return fmt(parseDate(s) + n * DAY_MS); }
  function diffDays(a, b) { return Math.round((parseDate(b) - parseDate(a)) / DAY_MS); }
  function isWeekday(s) { var w = new Date(parseDate(s)).getUTCDay(); return w !== 0 && w !== 6; }
  function isClosed(s, settings) {
    return !isWeekday(s) || ((settings && settings.closedDates) || []).indexOf(s) >= 0;
  }
  function eachDay(a, b) {
    var out = [], n = diffDays(a, b);
    for (var i = 0; i <= n; i++) out.push(addDays(a, i));
    return out;
  }

  /* ---------- 코드 ---------- */
  function makeCode(rand8) { // rand8: 0~255 정수 8개 (256 % 32 == 0 이라 치우침 없음)
    var s = '';
    for (var i = 0; i < 8; i++) s += CODE_CHARS.charAt(rand8[i] % 32);
    return 'GCA-' + s.slice(0, 4) + '-' + s.slice(4);
  }
  function normalizeCode(raw) {
    var c = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (c.length === 11 && c.indexOf('GCA') === 0) c = c.slice(3);
    if (c.length !== 8) return null;
    for (var i = 0; i < 8; i++) if (CODE_CHARS.indexOf(c.charAt(i)) < 0) return null;
    return 'GCA-' + c.slice(0, 4) + '-' + c.slice(4);
  }

  /* ---------- 재고 ---------- */
  // 예약 구간의 각 날짜별로 사용 수량을 합산해, 구간 안 최소 잔여 수량을 돌려준다.
  // 수령했지만 반납일이 지난 예약은 반납 처리 전까지 물품이 사무실에 없으므로 계속 점유한다.
  function availability(items, reservations, start, end, today) {
    var out = {}, days = eachDay(start, end);
    items.forEach(function (it) { out[it.id] = { stock: it.stock, remaining: it.stock }; });
    days.forEach(function (day) {
      var used = {};
      reservations.forEach(function (r) {
        if (ACTIVE.indexOf(r.status) < 0) return;
        var e = (r.status === '수령' && r.endDate < today) ? '9999-12-31' : r.endDate;
        if (day < r.startDate || day > e) return;
        for (var id in r.items) used[id] = (used[id] || 0) + (r.items[id] | 0);
      });
      items.forEach(function (it) {
        var rem = it.stock - (used[it.id] || 0);
        if (rem < out[it.id].remaining) out[it.id].remaining = rem;
      });
    });
    items.forEach(function (it) { if (out[it.id].remaining < 0) out[it.id].remaining = 0; });
    return out;
  }

  function byId(items) {
    var m = {};
    items.forEach(function (it) { m[it.id] = it; });
    return m;
  }

  // 안전통제 장비(안전조끼 제외)를 빌리면 안전조끼를 최소 1개 함께 빌려야 한다(인수증 규정).
  // 인원수에 맞춘 개수는 규정에 없어서 '권장'으로만 안내한다(recommendedVests).
  function requiredVests(cart, idx) {
    for (var id in cart) {
      var q = cart[id] | 0;
      if (q > 0 && idx[id] && idx[id].category === '안전통제' && id !== 'vest') return 1;
    }
    return 0;
  }
  function recommendedVests(cart, idx) {
    return Math.max(requiredVests(cart, idx), cart.walkie | 0, cart.baton | 0);
  }

  function shouldExpire(r, today) {
    return r.status === '예약됨' && today > addDays(r.startDate, 1);
  }

  /* ---------- 예약 검증·생성 ---------- */
  // payload는 whitelist 필드만 읽는다. 그 밖의 필드(자유 입력 포함)는 무시한다.
  function validateReserve(p, ctx) {
    var errors = [], s = ctx.settings || {};
    var maxDays = s.maxDays || 14, minAdv = s.minAdvanceDays == null ? 1 : s.minAdvanceDays, maxAdv = s.maxAdvanceDays || 90;
    var idx = byId(ctx.items), today = ctx.today;
    var start = p.startDate, end = p.endDate;

    if (parseDate(start) == null || parseDate(end) == null) {
      errors.push('수령일과 반납일을 선택해 주세요.');
    } else {
      if (end < start) errors.push('반납일은 수령일 이후여야 해요.');
      if (start < addDays(today, minAdv)) errors.push('수령일은 오늘 이후 ' + (minAdv > 0 ? minAdv + '일 뒤부터' : '') + ' 선택할 수 있어요.');
      if (start > addDays(today, maxAdv)) errors.push('수령일은 오늘부터 ' + maxAdv + '일 안에서 선택해 주세요.');
      if (end >= start && diffDays(start, end) + 1 > maxDays) errors.push('대여 기간은 최대 ' + maxDays + '일입니다.');
      if (isClosed(start, s)) errors.push('수령일은 진흥원 운영일(평일)이어야 해요.');
      if (isClosed(end, s)) errors.push('반납일은 진흥원 운영일(평일)이어야 해요.');
    }

    var cart = {}, total = 0;
    var src = p.items || {};
    for (var id in src) {
      var q = src[id];
      if (!idx[id]) { errors.push('알 수 없는 물품이 있어요.'); continue; }
      if (typeof q !== 'number' || q % 1 !== 0 || q < 0) { errors.push(idx[id].name + ' 수량이 올바르지 않아요.'); continue; }
      if (q === 0) continue;
      cart[id] = q; total += q;
    }
    if (total === 0) errors.push('빌릴 물품을 하나 이상 선택해 주세요.');

    if (errors.length === 0) {
      var av = availability(ctx.items, ctx.reservations, start, end, today);
      for (var cid in cart) {
        var it = idx[cid];
        var cap = Math.min(it.max || it.stock, av[cid].remaining);
        if ((it.max || it.stock) < cart[cid]) errors.push(it.name + '은(는) 한 번에 최대 ' + (it.max || it.stock) + '개까지 빌릴 수 있어요.');
        else if (av[cid].remaining < cart[cid]) errors.push(it.name + '은(는) 선택한 기간에 ' + av[cid].remaining + '개만 남아 있어요.');
      }
      var needVest = requiredVests(cart, idx);
      if (needVest > 0 && (cart.vest | 0) < needVest) errors.push('안전통제 장비를 빌리면 안전 조끼를 ' + needVest + '개 이상 함께 빌려야 해요.');
    }

    if (VISIT_SLOTS.indexOf(p.visitSlot) < 0) errors.push('수령하러 올 시간대를 선택해 주세요. (10시~17시)');
    if (SIGUN.indexOf(p.sigun) < 0) errors.push('촬영 시군을 선택해 주세요. (경기도 안에서 촬영할 때만 대여할 수 있어요.)');
    if (KINDS.indexOf(p.kind) < 0) errors.push('촬영 종류를 선택해 주세요.');
    if (p.staffBand && STAFF_BANDS.indexOf(p.staffBand) < 0) errors.push('스탭 규모 선택이 올바르지 않아요.');
    var c = p.consent || {};
    for (var i = 0; i < CONSENTS.length; i++) if (c[CONSENTS[i]] !== true) { errors.push('확인 항목에 모두 동의해 주세요.'); break; }

    if (ctx.activeCount != null && s.maxActive && ctx.activeCount >= s.maxActive) errors.push('지금은 예약이 많아 새 예약을 받을 수 없어요. 잠시 뒤에 다시 시도해 주세요.');

    return { ok: errors.length === 0, errors: errors, cart: cart };
  }

  // 검증을 통과하면 저장할 예약 객체를 만든다. 개인정보 필드는 존재하지 않는다.
  function processReserve(p, ctx) {
    var v = validateReserve(p, ctx);
    if (!v.ok) return { ok: false, errors: v.errors };
    var existing = {};
    ctx.reservations.forEach(function (r) { existing[r.code] = true; });
    var code = null;
    for (var i = 0; i < 8 && !code; i++) { var c = makeCode(ctx.rand8()); if (!existing[c]) code = c; }
    if (!code) return { ok: false, errors: ['예약코드를 만들지 못했어요. 다시 시도해 주세요.'] };
    return {
      ok: true,
      reservation: {
        code: code, status: '예약됨', createdAt: ctx.nowISO,
        startDate: p.startDate, endDate: p.endDate, items: v.cart,
        sigun: p.sigun, kind: p.kind, staffBand: p.staffBand || '', visitSlot: p.visitSlot
      }
    };
  }

  // 고객에게 보여 주는 필드만 골라 돌려준다.
  function publicView(r, items) {
    var idx = byId(items), list = [];
    for (var id in r.items) list.push({ id: id, name: idx[id] ? idx[id].name : id, category: idx[id] ? idx[id].category : '', qty: r.items[id] });
    return { code: r.code, status: r.status, startDate: r.startDate, endDate: r.endDate, visitSlot: r.visitSlot || '', sigun: r.sigun, kind: r.kind, items: list };
  }

  return {
    SIGUN: SIGUN, KINDS: KINDS, STAFF_BANDS: STAFF_BANDS, VISIT_SLOTS: VISIT_SLOTS, ACTIVE: ACTIVE,
    todayKST: todayKST, parseDate: parseDate, addDays: addDays, diffDays: diffDays, isWeekday: isWeekday, isClosed: isClosed, eachDay: eachDay,
    makeCode: makeCode, normalizeCode: normalizeCode,
    availability: availability, byId: byId, requiredVests: requiredVests, recommendedVests: recommendedVests,
    shouldExpire: shouldExpire, validateReserve: validateReserve, processReserve: processReserve, publicView: publicView
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Core;
