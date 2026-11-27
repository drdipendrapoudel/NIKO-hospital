/* Shared by the website and the server: works out which days and times a doctor can be booked. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NikoSchedule = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }

  // Visiting specialists choose their own visit dates and see patients by token number (no time slots).
  function isVisiting(doc) { return doc.employment === 'visiting' || (!doc.employment && +doc.monthlyWeek > 0 && !(doc.days && doc.days.length)); }
  function isToken(doc) { return isVisiting(doc); }
  function hasFixedSchedule(doc) {
    return isVisiting(doc) || (doc.days && doc.days.length > 0) || (+doc.monthlyWeek > 0 && doc.monthlyDay);
  }
  function inList(list, s) { return !!list && list.indexOf(s) >= 0; }

  // Hours on one date ("07:00-09:00, 16:00-19:00"). Part-time doctors follow the hospital's standard
  // part-time hours (set in booking.partTime) unless they have set their own hours for that weekday.
  function hoursOn(doc, dateStr, booking) {
    var day = DAYS[parse(dateStr).getDay()];
    if (doc.dayHours && doc.dayHours[day] !== undefined && doc.dayHours[day] !== null) return String(doc.dayHours[day] || '');
    var pt = booking && booking.partTime;
    if (doc.employment === 'part' && pt && !(doc.hours && /\d/.test(doc.hours))) {
      if (day === 'Sat' || day === 'Sun') return pt.weekend || '07:00-19:00';
      var eve = pt.switchDate && dateStr >= pt.switchDate ? pt.eveningAfter : pt.evening;
      return [pt.morning, eve].filter(Boolean).join(', ');
    }
    return (doc.hours && /\d/.test(doc.hours) ? doc.hours : (booking && booking.defaultHours) || '09:00-17:00');
  }

  function availableOn(doc, dateStr, booking) {
    var d = parse(dateStr);
    if (booking && booking.closedDates && booking.closedDates.indexOf(dateStr) >= 0) return false;
    if (inList(doc.off, dateStr)) return false;
    if (isVisiting(doc) && doc.visitDates) return inList(doc.visitDates, dateStr);
    if (+doc.monthlyWeek > 0 && doc.monthlyDay) {
      var nth = Math.ceil(d.getDate() / 7);
      if (DAYS[d.getDay()] === doc.monthlyDay && nth === +doc.monthlyWeek) return true;
      if (!doc.days || !doc.days.length) return false;
    }
    if (doc.days && doc.days.length) return doc.days.indexOf(DAYS[d.getDay()]) >= 0 && (!doc.dayHours || /\d/.test(hoursOn(doc, dateStr, booking)));
    return true; // schedule not set: accept as a request, hospital confirms by phone
  }

  function rangeSlots(hours, step) {
    var out = [];
    String(hours || '').split(/[,;]/).forEach(function (range) {
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
  // "09:00-13:00, 15:00-18:00" → ["09:00","09:15",...]; with a date, the hours of that day are used.
  function slots(doc, booking, dateStr) {
    var hours = dateStr ? hoursOn(doc, dateStr, booking) : (doc.hours && /\d/.test(doc.hours) ? doc.hours : (booking && booking.defaultHours) || '09:00-17:00');
    return rangeSlots(hours, Math.max(5, +((booking && booking.slotMinutes) || 15)));
  }

  // Video consultation follows the same schedule as the clinic. Only the hospital admin can add extra
  // video-only hours for a doctor (doc.videoHours = { Mon: "20:00-21:00" }), e.g. to take calls from home.
  function videoExtra(doc, dateStr) { var v = doc.videoHours; return (v && v[DAYS[parse(dateStr).getDay()]]) || ''; }
  function videoAvailableOn(doc, dateStr, booking) {
    if (booking && booking.closedDates && booking.closedDates.indexOf(dateStr) >= 0) return false;
    if (inList(doc.off, dateStr)) return false;
    if (/\d/.test(videoExtra(doc, dateStr))) return true;
    return hasFixedSchedule(doc) && !isVisiting(doc) && availableOn(doc, dateStr, booking);
  }
  function videoSlots(doc, booking, dateStr) {
    var step = Math.max(5, +((booking && booking.slotMinutes) || 15));
    var out = hasFixedSchedule(doc) && !isVisiting(doc) && availableOn(doc, dateStr, booking) ? rangeSlots(hoursOn(doc, dateStr, booking), step) : [];
    rangeSlots(videoExtra(doc, dateStr), step).forEach(function (t) { if (out.indexOf(t) < 0) out.push(t); });
    return out.sort();
  }
  function videoDates(doc, booking, count) {
    var out = [], d = new Date(); d.setHours(0, 0, 0, 0);
    for (var i = 0; i <= +((booking && booking.daysAhead) || 30) && out.length < (count || 14); i++) { var s = ymd(d); if (videoAvailableOn(doc, s, booking)) out.push(s); d.setDate(d.getDate() + 1); }
    return out;
  }
  // Is this minute (Nepal time, "HH:MM") inside the doctor's clinic or video hours today?
  function inHoursNow(doc, booking, dateStr, hhmm) {
    if (!videoAvailableOn(doc, dateStr, booking)) return false;
    var hrs = (hasFixedSchedule(doc) && !isVisiting(doc) && availableOn(doc, dateStr, booking) ? hoursOn(doc, dateStr, booking) : '') + ',' + videoExtra(doc, dateStr);
    var now = +hhmm.slice(0, 2) * 60 + +hhmm.slice(3, 5), ok = false;
    String(hrs).split(/[,;]/).forEach(function (r) { var m = r.match(/(\d{1,2})[:.](\d{2})\s*[-–to]+\s*(\d{1,2})[:.](\d{2})/); if (m && now >= +m[1] * 60 + +m[2] && now < +m[3] * 60 + +m[4]) ok = true; });
    return ok;
  }

  function nextDates(doc, booking, count, from) {
    var out = [];
    var d = from ? parse(from) : new Date();
    d.setHours(0, 0, 0, 0);
    var limit = +((booking && booking.daysAhead) || 30);
    if (isVisiting(doc) || (+doc.monthlyWeek > 0 && (!doc.days || !doc.days.length))) limit = Math.max(limit, 120);
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

  return { DAYS: DAYS, ymd: ymd, parse: parse, availableOn: availableOn, slots: slots, nextDates: nextDates, hasFixedSchedule: hasFixedSchedule, todayInNepal: todayInNepal,
    isVisiting: isVisiting, isToken: isToken, hoursOn: hoursOn, videoAvailableOn: videoAvailableOn, videoSlots: videoSlots, videoDates: videoDates, inHoursNow: inHoursNow };
}));
