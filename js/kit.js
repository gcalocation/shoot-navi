/*
 * 키트 추천. 수량은 rules.json의 규칙표로만 계산한다(AI가 숫자를 정하지 않음).
 * 입력은 선택형 값뿐이라 개인정보가 들어올 수 없다.
 */
var Kit = (function () {
  'use strict';

  function has(arr, v) { return arr.indexOf(v) >= 0; }

  function matches(w, inp) {
    if (w.place && !has(w.place, inp.place)) return false;
    if (w.notPlace && has(w.notPlace, inp.place)) return false;
    if (w.time && !has(w.time, inp.time)) return false;
    if (w.hours && !has(w.hours, inp.hours)) return false;
    if (w.kind && !has(w.kind, inp.kind)) return false;
    if (w.vehicle != null && !!w.vehicle !== !!inp.vehicle) return false;
    if (w.crowd != null && !!w.crowd !== !!inp.crowd) return false;
    if (w.minControl != null && inp.control < w.minControl) return false;
    if (w.minTier != null && inp.tier < w.minTier) return false;
    return true;
  }

  // inp: {place, time, hours, vehicle, crowd, control(0~8), tier(0~4), kind}
  function compute(inp, rules, itemsById) {
    var acc = {}, order = [];
    rules.rules.forEach(function (r) {
      if (!matches(r.when || {}, inp)) return;
      var q = r.qty || {};
      var n = (q.base || 0) + (q.perControl || 0) * inp.control + (q.perTier || 0) * inp.tier;
      if (q.min != null) n = Math.max(n, q.min);
      if (q.max != null) n = Math.min(n, q.max);
      n = Math.ceil(n);
      if (n <= 0) return;
      if (!acc[r.item]) { acc[r.item] = { id: r.item, qty: 0, reasons: [] }; order.push(r.item); }
      acc[r.item].qty += n;
      if (acc[r.item].reasons.indexOf(r.why) < 0) acc[r.item].reasons.push(r.why);
    });

    var list = order.map(function (id) {
      var it = acc[id], cap = (rules.caps && rules.caps[id]) || (itemsById[id] && itemsById[id].max) || it.qty;
      it.qty = Math.min(it.qty, cap);
      return it;
    });

    // 안전통제 장비가 하나라도 있으면 안전 조끼를 함께 권한다(최소 1개는 규정, 개수는 권장).
    var safety = list.some(function (x) { return itemsById[x.id] && itemsById[x.id].category === '안전통제' && x.id !== 'vest'; });
    if (safety) {
      var w = 0, b = 0;
      list.forEach(function (x) { if (x.id === 'walkie') w = x.qty; if (x.id === 'baton') b = x.qty; });
      var rec = Math.max(1, w, b);
      var cap = (itemsById.vest && itemsById.vest.max) || rec;
      list.push({ id: 'vest', qty: Math.min(rec, cap), reasons: ['안전통제 장비를 빌리면 안전 조끼를 함께 빌려야 합니다. 통제 요원과 무전기를 쓰는 사람 수에 맞춰 권장 개수를 잡았습니다.'] });
    }
    return list;
  }

  // 재고(avail: {id:{stock,remaining}}) 안으로 줄이고, 부족분을 기록한다.
  function fit(list, avail) {
    return list.map(function (x) {
      var rem = avail && avail[x.id] ? avail[x.id].remaining : x.qty;
      var give = Math.min(x.qty, rem);
      return { id: x.id, want: x.qty, qty: give, short: x.qty - give, reasons: x.reasons };
    });
  }

  function checklist(inp, texts) {
    var out = [], seen = {};
    function add(arr) { (arr || []).forEach(function (t) { if (!seen[t]) { seen[t] = 1; out.push(t); } }); }
    add(texts.byPlace && texts.byPlace[inp.place]);
    if (inp.time === 'night') add(texts.night);
    if (inp.crowd) add(texts.crowd);
    if (inp.hours === 'long') add(texts.long);
    if (inp.vehicle) add(texts.vehicle);
    add(texts.general);
    return out;
  }

  return { compute: compute, fit: fit, checklist: checklist, matches: matches };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Kit;
