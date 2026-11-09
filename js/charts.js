/* 간단한 막대 그래프(외부 라이브러리 없음). 모든 값은 글자로도 표시해 스크린리더에서 읽힌다. */
var Charts = (function () {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function hbars(rows, opts) {
    opts = opts || {};
    if (!rows || !rows.length) return '<p class="muted">집계 중입니다.</p>';
    var max = Math.max.apply(null, rows.map(function (r) { return r.count; })) || 1;
    var uniq = rows.filter(function (r) { return r.count === max; }).length === 1;   // 가장 큰 값이 하나일 때만 강조
    var total = opts.percent ? rows.reduce(function (a, r) { return a + r.count; }, 0) : 0;
    return '<div class="bars" role="list">' + rows.map(function (r) {
      var w = Math.max(1, Math.round(r.count / max * 100));
      var v = opts.percent ? Math.round(r.count / total * 100) + '%' : r.count;
      return '<div class="bar' + (uniq && r.count === max ? ' peak' : '') + '" role="listitem"><span>' + esc(r.label) + '</span><span class="track" aria-hidden="true"><span class="fill" style="display:block;width:' + w + '%"></span></span><span class="v">' + v + (opts.percent ? '' : '건') + '</span></div>';
    }).join('') + '</div>';
  }

  function columns(rows) {
    if (!rows || !rows.length) return '<p class="muted">집계 중입니다.</p>';
    var max = Math.max.apply(null, rows.map(function (r) { return r.count; })) || 1;
    var uniq = rows.filter(function (r) { return r.count === max; }).length === 1;
    return '<div class="cols" role="list">' + rows.map(function (r) {
      var h = Math.max(2, Math.round(r.count / max * 100));
      return '<div class="col' + (uniq && r.count === max ? ' peak' : '') + '" role="listitem"><span class="n">' + r.count + '</span><span class="fill" style="height:' + h + '%" aria-hidden="true"></span><span class="m">' + esc(r.label) + '</span></div>';
    }).join('') + '</div>';
  }

  return { hbars: hbars, columns: columns, esc: esc };
})();
