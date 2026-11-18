/* Shared by the website and the server: works out which days and times a doctor can be booked. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NikoSchedule = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }

  function hasFixedSchedule(doc) {
    return (doc.days && doc.days.length > 0) || (+doc.monthlyWeek > 0 && doc.monthlyDay);
  }

  function availableOn(doc, dateStr, booking) {
    var d = parse(dateStr);
    if (booking && booking.closedDates && booking.closedDates.indexOf(dateStr) >= 0) return false;
    if (+doc.monthlyWeek > 0 && doc.monthlyDay) {
      var nth = Math.ceil(d.getDate() / 7);
      if (DAYS[d.getDay()] === doc.monthlyDay && nth === +doc.monthlyWeek) return true;
      if (!doc.days || !doc.days.length) return false;
    }
    if (doc.days && doc.days.length) return doc.days.indexOf(DAYS[d.getDay()]) >= 0;
    return true; // schedule not set: accept as a request, hospital confirms by phone
  }

  // "09:00-13:00, 15:00-18:00" → ["09:00","09:15",...]
  function slots(doc, booking) {
    var hours = (doc.hours && /\d/.test(doc.hours) ? doc.hours : (booking && booking.defaultHours) || '09:00-17:00');
    var step = Math.max(5, +((booking && booking.slotMinutes) || 15));
    var out = [];
    String(hours).split(/[,;]/).forEach(function (range) {
      var m = range.match(/(\d{1,2})[:.](\d{2})\s*(am|pm)?\s*[-–to]+\s*(\d{1,2})[:.](\d{2})\s*(am|pm)?/i);
      if (!m) return;
      var h1 = +m[1], h2 = +m[4];
      if (m[3] && /pm/i.test(m[3]) && h1 < 12) h1 += 12;
      if (m[6] && /pm/i.test(m[6]) && h2 < 12) h2 += 12;
      var a = h1 * 60 + +m[2], b = h2 * 60 + +m[5];
      for (var t = a; t + step <= b; t += step) out.push(pad(Math.floor(t / 60)) + ':' + pad(t % 60));
    });
    return out;
  }

  function nextDates(doc, booking, count, from) {
    var out = [];
    var d = from ? parse(from) : new Date();
    d.setHours(0, 0, 0, 0);
    var limit = +((booking && booking.daysAhead) || 30);
    if (+doc.monthlyWeek > 0 && (!doc.days || !doc.days.length)) limit = Math.max(limit, 100);
    for (var i = 0; i <= limit && out.length < (count || 14); i++) {
      var s = ymd(d);
      if (availableOn(doc, s, booking)) out.push(s);
      d.setDate(d.getDate() + 1);
    }
    return out;
  }

  function todayInNepal() {
    var now = new Date(Date.now() + (5 * 60 + 45) * 60000 + new Date().getTimezoneOffset() * 60000);
    return ymd(now);
  }

  return { DAYS: DAYS, ymd: ymd, parse: parse, availableOn: availableOn, slots: slots, nextDates: nextDates, hasFixedSchedule: hasFixedSchedule, todayInNepal: todayInNepal };
}));
