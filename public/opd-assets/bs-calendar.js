/*!
 * Bikram Sambat (BS) Calendar Engine & UI Adapter (public/bs-calendar.js)
 * Converts all displayed dates, date pickers, booking calendars, and printouts
 * across index.html, opd.html, desk.html, and lab.html to '30 Kartik 2083' format
 * while preserving ISO AD (YYYY-MM-DD) values in the background for server APIs.
 */
(function () {
  'use strict';

  var BS_MONTHS = [
    'Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
    'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
  ];
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Official BS month lengths for years 2000 BS (1943 AD) through 2099 BS (2043 AD)
  // Anchor: 2000-01-01 BS = 1943-04-14 AD
  var BS_MAP = {
    2000:[30,32,31,32,31,30,30,30,29,30,29,31],2001:[31,31,32,31,31,31,30,29,30,29,30,30],
    2002:[31,31,32,32,31,30,30,29,30,29,30,30],2003:[31,32,31,32,31,30,30,30,29,29,30,31],
    2004:[30,32,31,32,31,30,30,30,29,30,29,31],2005:[31,31,32,31,31,31,30,29,30,29,30,30],
    2006:[31,31,32,32,31,30,30,29,30,29,30,30],2007:[31,32,31,32,31,30,30,30,29,29,30,31],
    2008:[31,31,31,32,31,31,29,30,30,29,29,31],2009:[31,31,32,31,31,31,30,29,30,29,30,30],
    2010:[31,31,32,32,31,30,30,29,30,29,30,30],2011:[31,32,31,32,31,30,30,30,29,29,30,31],
    2012:[31,31,31,32,31,31,29,30,30,29,30,30],2013:[31,31,32,31,31,31,30,29,30,29,30,30],
    2014:[31,31,32,32,31,30,30,29,30,29,30,30],2015:[31,32,31,32,31,30,30,30,29,29,30,31],
    2016:[31,31,31,32,31,31,29,30,30,29,30,30],2017:[31,31,32,31,31,31,30,29,30,29,30,30],
    2018:[31,32,31,32,31,30,30,29,30,29,30,30],2019:[31,32,31,32,31,30,30,30,29,30,29,31],
    2020:[31,31,31,32,31,31,30,29,30,29,30,30],2021:[31,31,32,31,31,31,30,29,30,29,30,30],
    2022:[31,32,31,32,31,30,30,30,29,29,30,30],2023:[31,32,31,32,31,30,30,30,29,30,29,31],
    2024:[31,31,31,32,31,31,30,29,30,29,30,30],2025:[31,31,32,31,31,31,30,29,30,29,30,30],
    2026:[31,32,31,32,31,30,30,30,29,29,30,31],2027:[30,32,31,32,31,30,30,30,29,30,29,31],
    2028:[31,31,32,31,31,31,30,29,30,29,30,30],2029:[31,31,32,31,32,30,30,29,30,29,30,30],
    2030:[31,32,31,32,31,30,30,30,29,29,30,31],2031:[30,32,31,32,31,30,30,30,29,30,29,31],
    2032:[31,31,32,31,31,31,30,29,30,29,30,30],2033:[31,31,32,32,31,30,30,29,30,29,30,30],
    2034:[31,32,31,32,31,30,30,30,29,29,30,31],2035:[30,32,31,32,31,31,29,30,30,29,29,31],
    2036:[31,31,32,31,31,31,30,29,30,29,30,30],2037:[31,31,32,32,31,30,30,29,30,29,30,30],
    2038:[31,32,31,32,31,30,30,30,29,29,30,31],2039:[31,31,31,32,31,31,29,30,30,29,30,30],
    2040:[31,31,32,31,31,31,30,29,30,29,30,30],2041:[31,31,32,32,31,30,30,29,30,29,30,30],
    2042:[31,32,31,32,31,30,30,30,29,29,30,31],2043:[31,31,31,32,31,31,29,30,30,29,30,30],
    2044:[31,31,32,31,31,31,30,29,30,29,30,30],2045:[31,32,31,32,31,30,30,29,30,29,30,30],
    2046:[31,32,31,32,31,30,30,30,29,29,30,31],2047:[31,31,31,32,31,31,30,29,30,29,30,30],
    2048:[31,31,32,31,31,31,30,29,30,29,30,30],2049:[31,32,31,32,31,30,30,30,29,29,30,30],
    2050:[31,32,31,32,31,30,30,30,29,30,29,31],2051:[31,31,31,32,31,31,30,29,30,29,30,30],
    2052:[31,31,32,31,31,31,30,29,30,29,30,30],2053:[31,32,31,32,31,30,30,30,29,29,30,30],
    2054:[31,32,31,32,31,30,30,30,29,30,29,31],2055:[31,31,32,31,31,31,30,29,30,29,30,30],
    2056:[31,31,32,31,32,30,30,29,30,29,30,30],2057:[31,32,31,32,31,30,30,30,29,29,30,31],
    2058:[30,32,31,32,31,30,30,30,29,30,29,31],2059:[31,31,32,31,31,31,30,29,30,29,30,30],
    2060:[31,31,32,32,31,30,30,29,30,29,30,30],2061:[31,32,31,32,31,30,30,30,29,29,30,31],
    2062:[30,32,31,32,31,31,29,30,29,30,29,31],2063:[31,31,32,31,31,31,30,29,30,29,30,30],
    2064:[31,31,32,32,31,30,30,29,30,29,30,30],2065:[31,32,31,32,31,30,30,30,29,29,30,31],
    2066:[31,31,31,32,31,31,29,30,30,29,29,31],2067:[31,31,32,31,31,31,30,29,30,29,30,30],
    2068:[31,31,32,32,31,30,30,29,30,29,30,30],2069:[31,32,31,32,31,30,30,30,29,29,30,31],
    2070:[31,31,31,32,31,31,29,30,30,29,30,30],2071:[31,31,32,31,31,31,30,29,30,29,30,30],
    2072:[31,32,31,32,31,30,30,29,30,29,30,30],2073:[31,32,31,32,31,30,30,30,29,29,30,31],
    2074:[31,31,31,32,31,31,30,29,30,29,30,30],2075:[31,31,32,31,31,31,30,29,30,29,30,30],
    2076:[31,32,31,32,31,30,30,30,29,29,30,30],2077:[31,32,31,32,31,30,30,30,29,30,29,31],
    2078:[31,31,31,32,31,31,30,29,30,29,30,30],2079:[31,31,32,31,31,31,30,29,30,29,30,30],
    2080:[31,32,31,32,31,30,30,30,29,29,30,30],2081:[31,32,31,32,31,30,30,30,29,30,29,31],
    2082:[31,31,32,31,31,31,30,29,30,29,30,30],2083:[31,31,32,31,31,31,30,29,30,29,30,30],
    2084:[31,32,31,32,31,30,30,30,29,29,30,31],2085:[30,32,31,32,31,30,30,30,29,30,29,31],
    2086:[31,31,32,31,31,31,30,29,30,29,30,30],2087:[31,31,32,32,31,30,30,29,30,29,30,30],
    2088:[31,32,31,32,31,30,30,30,29,29,30,31],2089:[30,32,31,32,31,31,29,30,29,30,29,31],
    2090:[31,31,32,31,31,31,30,29,30,29,30,30],2091:[31,31,32,32,31,30,30,29,30,29,30,30],
    2092:[31,32,31,32,31,30,30,30,29,29,30,31],2093:[31,31,31,32,31,31,29,30,30,29,29,31],
    2094:[31,31,32,31,31,31,30,29,30,29,30,30],2095:[31,31,32,32,31,30,30,29,30,29,30,30],
    2096:[31,32,31,32,31,30,30,30,29,29,30,31],2097:[31,31,31,32,31,31,29,30,30,29,30,30],
    2098:[31,31,32,31,31,31,30,29,30,29,30,30],2099:[31,32,31,32,31,30,30,29,30,29,30,30]
  };

  var ANCHOR_UTC = Date.UTC(1943, 3, 14); // 1943-04-14 AD = 1 Baisakh 2000 BS

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function todayAdYmd() {
    var now = new Date();
    return now.getFullYear() + '-' + pad2(now.getMonth() + 1) + '-' + pad2(now.getDate());
  }

  function adToBs(dateOrY, m, d) {
    var y, mo, da, dow;
    if (dateOrY instanceof Date) {
      if (isNaN(dateOrY.getTime())) return null;
      y = dateOrY.getFullYear();
      mo = dateOrY.getMonth() + 1;
      da = dateOrY.getDate();
      dow = dateOrY.getDay();
    } else if (typeof dateOrY === 'string') {
      var p = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateOrY.trim());
      if (!p) return null;
      y = +p[1]; mo = +p[2]; da = +p[3];
      dow = new Date(y, mo - 1, da).getDay();
    } else if (typeof dateOrY === 'number') {
      y = +dateOrY; mo = +m; da = +d;
      dow = new Date(y, mo - 1, da).getDay();
    } else {
      return null;
    }
    var diffDays = Math.round((Date.UTC(y, mo - 1, da) - ANCHOR_UTC) / 86400000);
    if (diffDays < 0) {
      return { year: y + 57, month: mo, day: da, monthName: BS_MONTHS[(mo - 1) % 12], weekday: WEEKDAYS[dow], formatted: da + ' ' + BS_MONTHS[(mo - 1) % 12] + ' ' + (y + 57) };
    }
    for (var by = 2000; by <= 2099; by++) {
      var months = BS_MAP[by];
      for (var bm = 0; bm < 12; bm++) {
        var md = months[bm];
        if (diffDays < md) {
          return {
            year: by,
            month: bm + 1,
            day: diffDays + 1,
            monthName: BS_MONTHS[bm],
            weekday: WEEKDAYS[dow],
            formatted: (diffDays + 1) + ' ' + BS_MONTHS[bm] + ' ' + by
          };
        }
        diffDays -= md;
      }
    }
    return { year: y + 57, month: mo, day: da, monthName: BS_MONTHS[(mo - 1) % 12], weekday: WEEKDAYS[dow], formatted: da + ' ' + BS_MONTHS[(mo - 1) % 12] + ' ' + (y + 57) };
  }

  function bsToAd(by, bm, bd) {
    var days = 0;
    for (var y = 2000; y < by; y++) {
      var mArr = BS_MAP[y] || [31,31,32,31,31,31,30,29,30,29,30,30];
      for (var i = 0; i < 12; i++) days += mArr[i];
    }
    var curArr = BS_MAP[by] || [31,31,32,31,31,31,30,29,30,29,30,30];
    for (var m = 0; m < bm - 1; m++) days += curArr[m];
    days += (bd - 1);
    var dt = new Date(ANCHOR_UTC + days * 86400000);
    var ay = dt.getUTCFullYear(), amo = dt.getUTCMonth() + 1, ada = dt.getUTCDate();
    return {
      year: ay, month: amo, day: ada,
      ymd: ay + '-' + pad2(amo) + '-' + pad2(ada),
      date: new Date(ay, amo - 1, ada)
    };
  }

  function formatBsYmd(s) {
    if (!s || typeof s !== 'string') return '';
    var b = adToBs(s);
    return b ? b.formatted : s;
  }

  function formatBsWhen(iso) {
    var d = iso instanceof Date ? iso : new Date(iso);
    if (isNaN(d.getTime())) return '';
    var b = adToBs(d);
    if (!b) return '';
    return b.formatted + ', ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  // 1. Override Date.prototype.toLocaleDateString & toLocaleString so all pages format in BS
  var origToLocaleDateString = Date.prototype.toLocaleDateString;
  var origToLocaleString = Date.prototype.toLocaleString;

  Date.prototype.toLocaleDateString = function (locales, opts) {
    if (isNaN(this.getTime())) return origToLocaleDateString.apply(this, arguments);
    var b = adToBs(this);
    if (!b) return origToLocaleDateString.apply(this, arguments);
    if (opts && opts.month && !opts.day) {
      return b.monthName + ' ' + b.year;
    }
    if (opts && opts.weekday === 'long') {
      return b.weekday + ', ' + b.formatted;
    }
    return b.formatted;
  };

  Date.prototype.toLocaleString = function (locales, opts) {
    if (isNaN(this.getTime())) return origToLocaleString.apply(this, arguments);
    var b = adToBs(this);
    if (!b) return origToLocaleString.apply(this, arguments);
    return b.formatted + ', ' + pad2(this.getHours()) + ':' + pad2(this.getMinutes());
  };

  window.BS = { adToBs: adToBs, bsToAd: bsToAd, formatBsYmd: formatBsYmd, formatBsWhen: formatBsWhen, months: BS_MONTHS, map: BS_MAP };
  window.fmtYmd = formatBsYmd;
  window.fmtWhen = formatBsWhen;

  // Capture live booking settings from /api/public/portal or /api/admin/inbox
  var liveBookingCfg = null;
  if (window.fetch) {
    var origFetch = window.fetch;
    window.fetch = function () {
      return origFetch.apply(this, arguments).then(function (res) {
        try {
          var clone = res.clone();
          clone.json().then(function (data) {
            if (data && data.booking) liveBookingCfg = data.booking;
            else if (data && data.portal && data.portal.booking) liveBookingCfg = data.portal.booking;
          }).catch(function () {});
        } catch (e) {}
        return res;
      });
    };
  }

  function getPortalBookingConfig() {
    if (liveBookingCfg) return liveBookingCfg;
    try {
      var p = JSON.parse(localStorage.getItem('dp_portal') || '{}');
      if (p && p.booking) return p.booking;
    } catch (e) {}
    try {
      var emb = JSON.parse((document.getElementById('portal-data') || {}).textContent || '{}');
      if (emb && emb.booking) return emb.booking;
    } catch (e) {}
    return { offDays: [6], offDates: [] };
  }

  // 2. Inject styling for the BS Date Input & Popup Calendar
  function injectStyles() {
    if (document.getElementById('bs-cal-styles')) return;
    var style = document.createElement('style');
    style.id = 'bs-cal-styles';
    style.textContent =
      '.bs-date-btn{display:inline-flex;align-items:center;justify-content:space-between;gap:10px;font:inherit;font-size:13px;color:#0f172a;background:#fff;border:1px solid #cbd5e1;border-radius:6px;padding:6px 10px;width:100%;min-height:34px;cursor:pointer;text-align:left;white-space:nowrap}' +
      '.cta-row .bs-date-btn{width:auto;min-width:200px;min-height:50px;font-size:.92rem;padding:0 16px;color:var(--ink,#1d1d1f);border-color:var(--line,#e6e6ea);border-radius:var(--radius,4px)}' +
      '.bs-date-btn:hover,.bs-date-btn:focus{border-color:#0f4c81;outline:none}' +
      '.bs-pop{position:fixed;z-index:9999;background:#fff;border:1px solid #cbd5e1;border-radius:12px;box-shadow:0 24px 60px rgba(15,23,42,.26);padding:12px;width:290px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#0f172a;display:none}' +
      '.bs-pop.open{display:block}' +
      '.bs-pop-head{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:8px}' +
      '.bs-pop-head select{padding:4px 6px;font-size:12.5px;font-weight:600;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#0f172a;width:auto}' +
      '.bs-pop-nav{width:28px;height:28px;border-radius:6px;border:1px solid #cbd5e1;background:#f8fafc;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;font-size:14px;padding:0;color:#0f172a}' +
      '.bs-pop-nav:hover{background:#0f172a;color:#fff}' +
      '.bs-pop-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;text-align:center}' +
      '.bs-pop-grid span{font-size:10.5px;font-weight:700;color:#64748b;padding:3px 0;text-transform:uppercase}' +
      '.bs-pop-grid button{aspect-ratio:1;border:0;border-radius:6px;background:none;font:500 12.5px inherit;color:#0f172a;cursor:pointer;padding:0;display:inline-flex;align-items:center;justify-content:center}' +
      '.bs-pop-grid button:hover{background:#e2e8f0}' +
      '.bs-pop-grid button.past{color:#cbd5e1;pointer-events:none}' +
      '.bs-pop-grid button.off{background:#fdecea;color:#c0392b}' +
      '.bs-pop-grid button.today{box-shadow:inset 0 0 0 1.5px #0f4c81;font-weight:700}' +
      '.bs-pop-grid button.sel{background:#0f4c81;color:#fff;font-weight:700}' +
      '.bs-pop-foot{display:flex;justify-content:space-between;margin-top:8px;padding-top:8px;border-top:1px solid #e2e8f0}' +
      '.bs-pop-foot button{font-size:11.5px;padding:4px 10px;border-radius:6px;border:1px solid #cbd5e1;background:#f8fafc;cursor:pointer;color:#0f172a;font-weight:600}';
    (document.head || document.documentElement).appendChild(style);
  }

  // 3. Shared Popup BS Picker for <input type="date"> (#quickDate, #pat_visit_date, #offDateIn)
  var pop = null, activeInput = null, popYear = 2083, popMonth = 7;

  function ensurePop() {
    if (pop) return pop;
    injectStyles();
    pop = document.createElement('div');
    pop.className = 'bs-pop';
    pop.innerHTML =
      '<div class="bs-pop-head">' +
        '<button type="button" class="bs-pop-nav" data-bs-dir="-1" aria-label="Previous BS month">‹</button>' +
        '<div style="display:flex;gap:4px;">' +
          '<select data-bs-month>' + BS_MONTHS.map(function (m, i) { return '<option value="' + (i + 1) + '">' + m + '</option>'; }).join('') + '</select>' +
          '<select data-bs-year>' + Object.keys(BS_MAP).map(function (y) { return '<option value="' + y + '">' + y + '</option>'; }).join('') + '</select>' +
        '</div>' +
        '<button type="button" class="bs-pop-nav" data-bs-dir="1" aria-label="Next BS month">›</button>' +
      '</div>' +
      '<div class="bs-pop-grid" data-bs-grid></div>' +
      '<div class="bs-pop-foot">' +
        '<button type="button" data-bs-today>Today (BS)</button>' +
        '<button type="button" data-bs-close>Close</button>' +
      '</div>';
    document.body.appendChild(pop);

    pop.addEventListener('click', function (e) {
      e.stopPropagation();
      var nav = e.target.closest('[data-bs-dir]');
      if (nav) {
        var dir = +nav.getAttribute('data-bs-dir');
        popMonth += dir;
        if (popMonth < 1) { popMonth = 12; popYear--; }
        if (popMonth > 12) { popMonth = 1; popYear++; }
        renderPopGrid();
        return;
      }
      var dayBtn = e.target.closest('[data-bs-ymd]');
      if (dayBtn && activeInput) {
        var pickedYmd = dayBtn.getAttribute('data-bs-ymd');
        var targetInp = activeInput;
        closePop();
        setInputValueAndNotify(targetInp, pickedYmd);
        return;
      }
      if (e.target.closest('[data-bs-today]') && activeInput) {
        var targetInp2 = activeInput;
        closePop();
        setInputValueAndNotify(targetInp2, todayAdYmd());
        return;
      }
      if (e.target.closest('[data-bs-close]')) {
        closePop();
      }
    });

    pop.querySelector('[data-bs-month]').addEventListener('change', function () {
      popMonth = +this.value;
      renderPopGrid();
    });
    pop.querySelector('[data-bs-year]').addEventListener('change', function () {
      popYear = +this.value;
      renderPopGrid();
    });

    document.addEventListener('click', function (e) {
      if (pop && pop.classList.contains('open') && !pop.contains(e.target) && (!activeInput || e.target !== activeInput._bsBtn)) {
        closePop();
      }
    });
    return pop;
  }

  function renderPopGrid() {
    ensurePop();
    pop.querySelector('[data-bs-month]').value = String(popMonth);
    pop.querySelector('[data-bs-year]').value = String(popYear);
    var daysInM = (BS_MAP[popYear] || [31,31,32,31,31,31,30,29,30,29,30,30])[popMonth - 1];
    var firstAd = bsToAd(popYear, popMonth, 1);
    var startDow = firstAd.date.getDay();
    var todayYmd = todayAdYmd();
    var curVal = activeInput ? activeInput.value : '';
    var minVal = activeInput ? (activeInput.min || '') : '';
    var isQuickBooking = activeInput && activeInput.id === 'quickDate';
    var bk = isQuickBooking ? getPortalBookingConfig() : { offDays: [], offDates: [] };
    var offDays = Array.isArray(bk.offDays) ? bk.offDays : [];
    var offDates = Array.isArray(bk.offDates) ? bk.offDates : [];

    var html = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(function (w) { return '<span>' + w + '</span>'; }).join('');
    for (var i = 0; i < startDow; i++) html += '<i></i>';
    for (var d = 1; d <= daysInM; d++) {
      var ad = bsToAd(popYear, popMonth, d);
      var k = ad.ymd;
      var dow = ad.date.getDay();
      var cls = [];
      if (minVal && k < minVal) cls.push('past');
      else if (isQuickBooking && (offDays.indexOf(dow) >= 0 || offDates.indexOf(k) >= 0)) cls.push('off');
      if (k === todayYmd) cls.push('today');
      if (k === curVal) cls.push('sel');
      html += '<button type="button" data-bs-ymd="' + k + '" class="' + cls.join(' ') + '">' + d + '</button>';
    }
    pop.querySelector('[data-bs-grid]').innerHTML = html;
  }

  function openPopFor(inp) {
    ensurePop();
    activeInput = inp;
    var b = adToBs(inp.value) || adToBs(new Date());
    popYear = b.year;
    popMonth = b.month;
    renderPopGrid();
    pop.classList.add('open');
    var rect = inp._bsBtn.getBoundingClientRect();
    var top = rect.bottom + 6;
    var left = rect.left;
    if (top + 320 > window.innerHeight) top = Math.max(8, rect.top - 320);
    if (left + 300 > window.innerWidth) left = Math.max(8, window.innerWidth - 300);
    pop.style.top = top + 'px';
    pop.style.left = left + 'px';
  }

  function closePop() {
    if (pop) pop.classList.remove('open');
    activeInput = null;
  }

  var valDesc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

  function syncBtnLabel(inp) {
    if (!inp || !inp._bsBtn) return;
    var v = valDesc.get.call(inp);
    var b = adToBs(v);
    var placeholder = inp.id === 'quickDate' ? 'Preferred date (BS)' : 'Choose BS date';
    inp._bsBtn.innerHTML = '<span>' + (b ? b.formatted : placeholder) + '</span><span style="opacity:.65;font-size:12px;">📅</span>';
  }

  function setInputValueAndNotify(inp, ymdStr) {
    valDesc.set.call(inp, ymdStr);
    syncBtnLabel(inp);
    if (inp.id === 'quickDate') {
      selectedBookingYmd = ymdStr;
      var sb = adToBs(ymdStr);
      if (sb) bookingBsMonth = { year: sb.year, month: sb.month };
    }
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function upgradeDateInput(inp) {
    if (!inp || inp._bsUpgraded) return;
    inp._bsUpgraded = true;
    inp.setAttribute('data-bs-upgraded', '1');
    injectStyles();
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bs-date-btn';
    inp._bsBtn = btn;
    inp.style.setProperty('display', 'none', 'important');
    inp.parentNode.insertBefore(btn, inp.nextSibling);

    Object.defineProperty(inp, 'value', {
      get: function () { return valDesc.get.call(this); },
      set: function (v) { valDesc.set.call(this, v); syncBtnLabel(this); }
    });

    syncBtnLabel(inp);
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      openPopFor(inp);
    });
  }

  function upgradeAllDateInputs() {
    var list = document.querySelectorAll('input[type="date"]:not([data-bs-upgraded])');
    for (var i = 0; i < list.length; i++) upgradeDateInput(list[i]);
  }

  // 4. Upgrade Public Booking Calendar (#cal, #calTitle, #calPrev, #calNext in index.html)
  var bookingBsMonth = null;
  var selectedBookingYmd = null;
  var calObs = null;

  function renderBookingBsCalendar() {
    var calEl = document.getElementById('cal');
    var titleEl = document.getElementById('calTitle');
    if (!calEl || !titleEl) return;

    if (calObs) calObs.disconnect();

    var domSel = calEl.querySelector('button.sel[data-day]');
    if (domSel) {
      selectedBookingYmd = domSel.getAttribute('data-day');
    } else {
      var slotTitle = document.getElementById('slotTitle');
      if (slotTitle && /Choose a date/i.test(slotTitle.textContent || '')) {
        selectedBookingYmd = null;
      }
    }

    var todayYmd = todayAdYmd();
    var todayBs = adToBs(new Date());

    if (!bookingBsMonth) {
      var initBs = selectedBookingYmd ? adToBs(selectedBookingYmd) : todayBs;
      bookingBsMonth = { year: initBs.year, month: initBs.month };
    } else if (selectedBookingYmd && !renderBookingBsCalendar._keepMonth) {
      var sb = adToBs(selectedBookingYmd);
      if (sb) bookingBsMonth = { year: sb.year, month: sb.month };
    }
    renderBookingBsCalendar._keepMonth = false;

    var by = bookingBsMonth.year, bm = bookingBsMonth.month;
    var daysInM = (BS_MAP[by] || [31,31,32,31,31,31,30,29,30,29,30,30])[bm - 1];
    var firstAd = bsToAd(by, bm, 1);
    var startDow = firstAd.date.getDay();
    var bk = getPortalBookingConfig();
    var offDays = Array.isArray(bk.offDays) ? bk.offDays : [6];
    var offDates = Array.isArray(bk.offDates) ? bk.offDates : [];

    titleEl.textContent = BS_MONTHS[bm - 1] + ' ' + by;
    var h = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(function (d) { return '<span>' + d + '</span>'; }).join('');
    for (var i = 0; i < startDow; i++) h += '<i></i>';
    for (var d = 1; d <= daysInM; d++) {
      var ad = bsToAd(by, bm, d);
      var k = ad.ymd;
      var dow = ad.date.getDay();
      var cls = [];
      if (k < todayYmd) cls.push('past');
      else if (offDays.indexOf(dow) >= 0 || offDates.indexOf(k) >= 0) cls.push('off');
      if (k === todayYmd) cls.push('today');
      if (k === selectedBookingYmd) cls.push('sel');
      h += '<button type="button" data-day="' + k + '" class="' + cls.join(' ') + '"' +
           (cls.indexOf('off') >= 0 ? ' aria-label="' + d + ', not available"' : '') + '>' + d + '</button>';
    }
    calEl.innerHTML = h;
    var prevBtn = document.getElementById('calPrev');
    if (prevBtn && todayBs) {
      prevBtn.disabled = (by === todayBs.year && bm === todayBs.month);
    }

    if (calObs) {
      calObs.takeRecords();
      calObs.observe(calEl, { childList: true });
    }
  }

  function setupBookingCalendarHooks() {
    var calEl = document.getElementById('cal');
    if (!calEl || calEl._bsHooked) return;
    calEl._bsHooked = true;

    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      if (t.closest('#calPrev')) {
        e.stopImmediatePropagation();
        e.preventDefault();
        if (!bookingBsMonth) bookingBsMonth = adToBs(new Date());
        bookingBsMonth.month--;
        if (bookingBsMonth.month < 1) { bookingBsMonth.month = 12; bookingBsMonth.year--; }
        renderBookingBsCalendar._keepMonth = true;
        renderBookingBsCalendar();
        return;
      }
      if (t.closest('#calNext')) {
        e.stopImmediatePropagation();
        e.preventDefault();
        if (!bookingBsMonth) bookingBsMonth = adToBs(new Date());
        bookingBsMonth.month++;
        if (bookingBsMonth.month > 12) { bookingBsMonth.month = 1; bookingBsMonth.year++; }
        renderBookingBsCalendar._keepMonth = true;
        renderBookingBsCalendar();
        return;
      }
      var dayBtn = t.closest('#cal [data-day]');
      if (dayBtn && !dayBtn.classList.contains('past') && !dayBtn.classList.contains('off')) {
        var ymd = dayBtn.getAttribute('data-day');
        selectedBookingYmd = ymd;
        var b = adToBs(ymd);
        if (b) bookingBsMonth = { year: b.year, month: b.month };
      }
    }, true);

    calObs = new MutationObserver(function () {
      renderBookingBsCalendar();
    });
    renderBookingBsCalendar();
  }

  function initBsEverywhere() {
    injectStyles();
    window.fmtYmd = formatBsYmd;
    window.fmtWhen = formatBsWhen;
    upgradeAllDateInputs();
    setupBookingCalendarHooks();
    if (typeof window.renderSidebarList === 'function') try { window.renderSidebarList(); } catch (e) {}
    if (typeof window.renderBookings === 'function') try { window.renderBookings(); } catch (e) {}
    var bodyObs = new MutationObserver(function () {
      if (document.querySelector('input[type="date"]:not([data-bs-upgraded])')) {
        upgradeAllDateInputs();
      }
    });
    if (document.body) bodyObs.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBsEverywhere);
  } else {
    initBsEverywhere();
  }
})();
