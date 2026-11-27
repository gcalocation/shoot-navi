/*
 * 키트 추천. 수량은 rules.json의 규칙표로만 계산한다(AI가 숫자를 정하지 않음).
 * 입력은 선택형 값뿐이라 개인정보가 들어올 수 없다.
 */
var Kit = (function () {
  'use strict';

  function has(arr, v) { return arr.indexOf(v) >= 0; }
  function arr(v) { return Array.isArray(v) ? v : (v ? [v] : []); }   // 값 하나(문자열)도, 여러 개(배열)도 받는다

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

  // 한 가지 상황(장소 하나, 시간 하나)에 대한 추천.
  // inp: {place, time, hours, vehicle, crowd, control(0~8), tier(0~4), kind}
  function computeOne(inp, rules, itemsById) {
    var acc = {}, order = [];
    rules.rules.forEach(function (r) {
      if (!itemsById[r.item]) return;   // 지금 빌릴 수 없는 물품(사용 중지 등)은 추천하지 않는다
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
      var it = acc[id], caps = [];
      // 추천 수량은 규칙표의 상한과, 한 번에 빌릴 수 있는 최대 수량(물품의 1건 최대) 중 작은 쪽을 넘지 않는다.
      if (rules.caps && rules.caps[id]) caps.push(rules.caps[id]);
      if (itemsById[id] && itemsById[id].max) caps.push(itemsById[id].max);
      if (caps.length) it.qty = Math.min.apply(null, [it.qty].concat(caps));
      return it;
    });

    // 안전통제 장비가 하나라도 있으면 안전 조끼를 함께 권한다(최소 1개는 규정, 개수는 권장).
    var safety = list.some(function (x) { return itemsById[x.id] && itemsById[x.id].category === '안전통제' && x.id !== 'vest'; });
    if (safety) {
      var w = 0, b = 0;
      list.forEach(function (x) { if (x.id === 'walkie') w = x.qty; if (x.id === 'baton') b = x.qty; });
      var rec = Math.max(1, w, b);
      var cap = (itemsById.vest && itemsById.vest.max) || rec;
      var why = ['안전통제 장비를 빌리면 안전 조끼를 함께 빌려야 합니다. 통제 요원과 무전기를 쓰는 사람 수에 맞춰 권장 개수를 잡았습니다.'];
      if (inp.time === 'night') why.push('야간에는 통제 요원이 멀리서도 눈에 띄도록 모두 입는 것이 좋습니다.');
      list.push({ id: 'vest', qty: Math.min(rec, cap), reasons: why });
    }
    return list;
  }

  // 장소·시간을 여러 개 골랐을 때: 장소×시간 조합마다 따로 계산해서, 물품별로 가장 많이 필요한 수량을 쓴다.
  // (예: 도로+공원, 낮+밤이면 도로·밤 기준이 가장 많으니 그 수량이 나온다. 규칙을 그대로 두고 여러 상황을 겹쳐 본다.)
  function compute(inp, rules, itemsById) {
    var places = arr(inp.place), times = arr(inp.time);
    if (!places.length) places = [''];
    if (!times.length) times = [''];
    var acc = {}, order = [];
    places.forEach(function (p) {
      times.forEach(function (t) {
        var one = computeOne(Object.assign({}, inp, { place: p, time: t }), rules, itemsById);
        one.forEach(function (x) {
          if (!acc[x.id]) { acc[x.id] = { id: x.id, qty: 0, reasons: [] }; order.push(x.id); }
          if (x.qty > acc[x.id].qty) acc[x.id].qty = x.qty;
          x.reasons.forEach(function (r) { if (acc[x.id].reasons.indexOf(r) < 0) acc[x.id].reasons.push(r); });
        });
      });
    });
    return order.map(function (id) { return acc[id]; });
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
    arr(inp.place).forEach(function (p) { add(texts.byPlace && texts.byPlace[p]); });
    if (has(arr(inp.time), 'night')) add(texts.night);
    if (inp.crowd) add(texts.crowd);
    if (inp.hours === 'long') add(texts.long);
    if (inp.vehicle) add(texts.vehicle);
    add(texts.general);
    return out;
  }

  return { compute: compute, fit: fit, checklist: checklist, matches: matches };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Kit;
