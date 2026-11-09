/*
 * 서버 통신. apiUrl이 있으면 Apps Script 웹앱을, 없으면 체험 모드(이 브라우저의 localStorage)를 쓴다.
 * 두 모드 모두 같은 Core 로직으로 검증한다.
 */
var Api = (function () {
  'use strict';

  function mem() {
    var store = {};
    return { get: function (k) { return store[k] == null ? null : store[k]; }, set: function (k, v) { store[k] = v; } };
  }
  function safeStore() {
    try {
      var k = '__t'; window.localStorage.setItem(k, '1'); window.localStorage.removeItem(k);
      return { get: function (key) { return window.localStorage.getItem(key); }, set: function (key, v) { window.localStorage.setItem(key, v); } };
    } catch (e) { return mem(); }
  }

  function rand8() {
    var a = new Uint8Array(8);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return Array.prototype.slice.call(a);
  }

  /* ---------- 체험 모드 ---------- */
  function demo(master) {
    var db = safeStore(), KEY = 'gcon_demo_reservations_v1';
    function load() { try { return JSON.parse(db.get(KEY) || '[]'); } catch (e) { return []; } }
    function save(list) { db.set(KEY, JSON.stringify(list)); }
    function expire(list) {
      var today = Core.todayKST(), changed = false;
      list.forEach(function (r) { if (Core.shouldExpire(r, today)) { r.status = '해제'; changed = true; } });
      if (changed) save(list);
      return list;
    }
    function ok(v) { return Promise.resolve(v); }
    return {
      demo: true,
      getMaster: function () { return ok(master); },
      availability: function (start, end) {
        var list = expire(load());
        return ok({ ok: true, avail: Core.availability(master.items, list, start, end, Core.todayKST()) });
      },
      reserve: function (p) {
        var list = expire(load());
        var active = list.filter(function (r) { return Core.ACTIVE.indexOf(r.status) >= 0; }).length;
        var res = Core.processReserve(p, {
          items: master.items, settings: master.settings, reservations: list, today: Core.todayKST(),
          activeCount: active, nowISO: new Date().toISOString(), rand8: rand8
        });
        if (!res.ok) return ok(res);
        list.push(res.reservation); save(list);
        return ok({ ok: true, code: res.reservation.code, reservation: Core.publicView(res.reservation, master.items) });
      },
      lookup: function (code) {
        var c = Core.normalizeCode(code);
        if (!c) return ok({ ok: false, errors: ['예약코드 형식이 올바르지 않아요. (예: GCA-7K4Q-2M8P)'] });
        var r = expire(load()).filter(function (x) { return x.code === c; })[0];
        return ok(r ? { ok: true, reservation: Core.publicView(r, master.items) } : { ok: false, errors: ['이 예약코드로 찾은 예약이 없어요.'] });
      },
      cancel: function (code) {
        var c = Core.normalizeCode(code), list = load(), r = list.filter(function (x) { return x.code === c; })[0];
        if (!r) return ok({ ok: false, errors: ['예약을 찾지 못했어요.'] });
        if (r.status !== '예약됨') return ok({ ok: false, errors: ['이미 수령했거나 처리가 끝난 예약은 취소할 수 없어요. 방문해서 반납해 주세요.'] });
        r.status = '취소'; save(list);
        return ok({ ok: true, reservation: Core.publicView(r, master.items) });
      },
      stats: function () { return ok({ ok: true, items: [] }); }
    };
  }

  /* ---------- 실서비스(Apps Script) ---------- */
  function real(url) {
    function get(params) {
      var q = Object.keys(params).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&');
      return fetch(url + (url.indexOf('?') < 0 ? '?' : '&') + q, { redirect: 'follow' }).then(function (r) { return r.json(); });
    }
    function post(body) {
      // text/plain 으로 보내 CORS 사전 요청(preflight)을 피한다.
      return fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), redirect: 'follow' }).then(function (r) { return r.json(); });
    }
    return {
      demo: false,
      getMaster: function () { return get({ action: 'config' }); },
      availability: function (s, e) { return get({ action: 'availability', start: s, end: e }); },
      reserve: function (p) { return post(Object.assign({ action: 'reserve' }, p)); },
      lookup: function (code) { return get({ action: 'lookup', code: code }); },
      cancel: function (code) { return post({ action: 'cancel', code: code }); },
      stats: function () { return get({ action: 'stats' }); }
    };
  }

  return { create: function (cfg, master) { return cfg.apiUrl ? real(cfg.apiUrl) : demo(master); }, safeStore: safeStore };
})();
