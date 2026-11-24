/*!
 * OPD Form Customizations (public/opd-updates.js)
 * Strictly handles OPD form enhancements in opd.html:
 * - Upgrades the Occupation input (#pat_occupation) into a preset dropdown
 *   (Farmer, Housewife, Army, Police, Doctor, Retired Officer, Teacher, Office Worker)
 *   plus a "Type my own..." custom input option.
 */
(function () {
  'use strict';

  var OCC_LIST = [
    'Farmer', 'Housewife', 'Army', 'Police', 'Doctor',
    'Retired Officer', 'Teacher', 'Office Worker'
  ];

  var valDesc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

  function upgradeOpdOccupation() {
    var inp = document.getElementById('pat_occupation');
    if (!inp || inp._occUpgraded) return;
    inp._occUpgraded = true;

    var sel = document.createElement('select');
    sel.id = 'pat_occ_select';
    sel.innerHTML =
      '<option value="">— Select occupation —</option>' +
      OCC_LIST.map(function (o) { return '<option value="' + o + '">' + o + '</option>'; }).join('') +
      '<option value="__custom__">Type my own...</option>';

    inp.parentNode.insertBefore(sel, inp);
    inp.placeholder = 'Type occupation...';
    inp.style.marginTop = '5px';

    function syncOccUI(val) {
      var v = String(val == null ? '' : val).trim();
      if (!v) {
        sel.value = '';
        inp.style.display = 'none';
      } else if (OCC_LIST.indexOf(v) >= 0) {
        sel.value = v;
        inp.style.display = 'none';
      } else {
        sel.value = '__custom__';
        inp.style.display = '';
      }
    }

    Object.defineProperty(inp, 'value', {
      get: function () { return valDesc.get.call(this); },
      set: function (v) {
        valDesc.set.call(this, v);
        syncOccUI(v);
      }
    });

    syncOccUI(valDesc.get.call(inp));

    sel.addEventListener('change', function () {
      if (sel.value === '__custom__') {
        var cur = valDesc.get.call(inp);
        if (OCC_LIST.indexOf(cur) >= 0) valDesc.set.call(inp, '');
        inp.style.display = '';
        setTimeout(function () { try { inp.focus(); } catch (e) {} }, 30);
      } else {
        valDesc.set.call(inp, sel.value);
        inp.style.display = 'none';
      }
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  function initOpdUpdates() {
    upgradeOpdOccupation();
    var obs = new MutationObserver(upgradeOpdOccupation);
    if (document.body) obs.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOpdUpdates);
  } else {
    initOpdUpdates();
  }
})();
