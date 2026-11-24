/*!
 * clinic-tools.js — shared by the OPD (/opd) and the discharge page (/discharge).
 *   ClinicTools.Lab   test names, usual units, lab table groups, differential count split
 *   ClinicTools.Spell autocorrect while typing (a list of known misspellings, fixed once per word)
 *   ClinicTools.Fonts print font: fonts installed on this computer + a few free web fonts
 * No patient data lives here.
 */
(function () {
  'use strict';

  /* ======================= LAB ======================= */
  // key -> names it is written as (lower case, without spaces, dots, underscores)
  var ALIASES = {
    hb: ['hb', 'haemoglobin', 'hemoglobin', 'hgb'], rbc: ['rbc', 'rbcs', 'rbccount', 'redbloodcells', 'totalrbc'],
    tlc: ['tlc', 'wbc', 'totalleucocytecount', 'totalwbccount', 'totalcount', 'tc', 'totalleukocytecount', 'wbccount'],
    neut: ['neutrophil', 'neutrophils', 'neutro', 'n', 'polymorphs', 'dlc-n', 'p'], lymph: ['lymphocyte', 'lymphocytes', 'lympho', 'l', 'dlc-l'],
    eos: ['eosinophil', 'eosinophils', 'eosino', 'e', 'dlc-e'], mono: ['monocyte', 'monocytes', 'mono', 'm', 'dlc-m'], baso: ['basophil', 'basophils', 'baso', 'b', 'dlc-b'],
    plt: ['platelet', 'platelets', 'plateletcount', 'plt'], hct: ['hct', 'pcv', 'haematocrit', 'hematocrit'],
    mcv: ['mcv'], mch: ['mch'], mchc: ['mchc'], rdw: ['rdw', 'rdw-cv'], retic: ['retic', 'reticcount', 'reticulocyte', 'reticulocytecount', 'reticulocytes'],
    esr: ['esr'], crp: ['crp', 'c-reactiveprotein', 'creactiveprotein', 'c-reactiveprotein(crp)', 'hscrp'], procal: ['procal', 'procalcitonin', 'pct'],
    ferritin: ['ferritin', 'serumferritin', 'sferritin'], ldh: ['ldh', 'serumldh', 'lactatedehydrogenase'],
    urea: ['urea', 'bloodurea', 'serumurea', 'surea', 'bun'], creat: ['creatinine', 'serumcreatinine', 'screatinine', 'cr', 'creat', 'scr', 'screat'],
    na: ['sodium', 'na', 'na+', 'serumsodium', 'ssodium'], k: ['potassium', 'k', 'k+', 'serumpotassium', 'spotassium'], cl: ['chloride', 'cl', 'cl-', 'serumchloride'],
    ca: ['calcium', 'ca', 'ca2+', 'ca++', 'serumcalcium', 'scalcium'], mg: ['magnesium', 'mg', 'serummagnesium', 'mg2+'], po4: ['phosphate', 'phosphorus', 'po4', 'serumphosphate', 'inorganicphosphorus'],
    uric: ['uricacid', 'serumuricacid', 'suricacid'],
    bilt: ['bilirubin(t)', 'bilirubintotal', 'totalbilirubin', 'serumbilirubin(total)', 'bilirubin', 'tbil', 'sbr', 't.bil', 'tbilirubin', 'bilirubin(total)'],
    bild: ['bilirubin(d)', 'directbilirubin', 'bilirubindirect', 'serumbilirubin(direct)', 'serumbilirubinconjugated', 'conjugatedbilirubin', 'dbil', 'dbilirubin', 'bilirubin(direct)'],
    bili: ['bilirubin(i)', 'indirectbilirubin', 'bilirubinindirect', 'ibil', 'unconjugatedbilirubin'],
    alt: ['alt', 'sgpt', 'alt(sgpt)', 'sgpt(alt)'], ast: ['ast', 'sgot', 'ast(sgot)', 'sgot(ast)'], alp: ['alp', 'alkalinephosphatase', 'serumalkalinephosphatase', 'salp'],
    ggt: ['ggt', 'ggtp', 'gammagt'], alb: ['albumin', 'serumalbumin', 'salbumin', 'alb'], tprot: ['tprotein', 'totalprotein', 'serumprotein', 'serumtotalprotein', 'tp'], glob: ['globulin'],
    amy: ['amylase', 'serumamylase', 'samylase'], lip: ['lipase', 'serumlipase', 'slipase'], ck: ['ck', 'cpk', 'creatinekinase', 'ck-total', 'cpk-total'], ckmb: ['ck-mb', 'ckmb', 'cpk-mb'],
    trop: ['tropi', 'troponini', 'troponin', 'trop-i', 'troponin-i', 'hstropi', 'hs-tropi', 'troponint'], bnp: ['bnp', 'ntprobnp', 'nt-probnp'],
    rbs: ['rbs', 'randombloodsugar', 'bloodsugar(r)', 'bloodsugar(random)', 'grbs', 'bloodsugar'], fbs: ['fbs', 'fastingbloodsugar', 'bloodsugar(f)', 'bloodsugar(fasting)'], ppbs: ['ppbs', 'postprandialbloodsugar', 'bloodsugar(pp)', 'pp'],
    hba1c: ['hba1c', 'glycatedhb', 'glycosylatedhb', 'a1c'],
    chol: ['totalcholesterol', 'cholesterol', 'tcholesterol', 'serumcholesterol', 'tc(cholesterol)'], tg: ['triglycerides', 'triglyceride', 'tg', 'tgl'], hdl: ['hdl', 'hdlcholesterol', 'hdl-c'], ldl: ['ldl', 'ldlcholesterol', 'ldl-c'], vldl: ['vldl'],
    tsh: ['tsh'], ft3: ['ft3', 'freet3'], ft4: ['ft4', 'freet4'], t3: ['t3', 'totalt3'], t4: ['t4', 'totalt4'],
    iron: ['serumiron', 'iron', 'siron'], tibc: ['tibc'], tsat: ['transferrinsaturation', 'tsat', 'transferrinsat', 'transferrinsaturation(%)'],
    b12: ['vitaminb12', 'vitb12', 'b12', 'serumb12', 'cobalamin'], vitd: ['vitamind', 'vitd', '25ohvitamind', '25(oh)d', 'vitamind3', 'vitd3', '25-ohvitd'], ipth: ['ipth', 'pth', 'intactpth'],
    uacr: ['urineacr', 'uacr', 'acr', 'urinealbumincreatinineratio'],
    pt: ['pt', 'prothrombintime'], inr: ['inr', 'pt/inr', 'ptinr'], aptt: ['aptt', 'ptt'],
    ph: ['ph'], pco2: ['pco2', 'paco2'], po2: ['po2', 'pao2'], hco3: ['hco3', 'hco3-', 'bicarbonate'], lactate: ['lactate', 'lacticacid'],
    dlc: ['dlc', 'dc', 'differentialcount', 'differentialleucocytecount', 'dlc(n/l/e/m)', 'dc(n/l/e/m)']
  };
  var aliasIndex = {};
  Object.keys(ALIASES).forEach(function (k) { ALIASES[k].forEach(function (a) { aliasIndex[a] = k; }); });
  function testKey(n) {
    var s = String(n || '').toLowerCase().replace(/\s+|\.|_/g, '').replace(/\(%\)$|%$/, '');
    s = s.replace(/\((g\/dl|mg\/dl|mg\/l|u\/l|iu\/l|mmol\/l|\/mm3|\/mm³|fl|pg|sec|mmhg|ng\/ml|pg\/ml|µg\/dl|ug\/dl|µiu\/ml|uiu\/ml|mm\/hr|×10³\/µl|x10³\/µl)\)$/, '');
    return aliasIndex[s] || s;
  }

  var UNITS = {
    hb: 'g/dl', rbc: 'million/mm³', neut: '%', lymph: '%', eos: '%', mono: '%', baso: '%', hct: '%', mcv: 'fL', mch: 'pg', mchc: 'g/dl', rdw: '%', retic: '%',
    esr: 'mm/hr', crp: 'mg/L', procal: 'ng/ml', ferritin: 'ng/ml', ldh: 'U/L',
    urea: 'mg/dl', creat: 'mg/dl', na: 'mmol/L', k: 'mmol/L', cl: 'mmol/L', ca: 'mg/dl', mg: 'mg/dl', po4: 'mg/dl', uric: 'mg/dl',
    bilt: 'mg/dl', bild: 'mg/dl', bili: 'mg/dl', alt: 'U/L', ast: 'U/L', alp: 'U/L', ggt: 'U/L', alb: 'g/dl', tprot: 'g/dl', glob: 'g/dl',
    amy: 'U/L', lip: 'U/L', ck: 'U/L', ckmb: 'U/L', rbs: 'mg/dl', fbs: 'mg/dl', ppbs: 'mg/dl', hba1c: '%',
    chol: 'mg/dl', tg: 'mg/dl', hdl: 'mg/dl', ldl: 'mg/dl', vldl: 'mg/dl',
    tsh: 'µIU/ml', ft3: 'pg/ml', ft4: 'ng/dl', iron: 'µg/dl', tibc: 'µg/dl', tsat: '%', b12: 'pg/ml', vitd: 'ng/ml', ipth: 'pg/ml', uacr: 'mg/g',
    pt: 'sec', aptt: 'sec', pco2: 'mmHg', po2: 'mmHg', hco3: 'mmol/L', lactate: 'mmol/L'
  };
  var extraUnits = {};      // from ⚙️ → Lab panels ("Hb = g/dl")
  function setUnitLines(lines) {
    extraUnits = {};
    (lines || []).forEach(function (l) { var i = String(l).indexOf('='); if (i > 0) { var k = testKey(l.slice(0, i).trim()), u = l.slice(i + 1).trim(); if (k) extraUnits[k] = u; } });
  }
  function unitLines() { return Object.keys(UNITS).map(function (k) { return (ALIASES[k] ? displayName(k) : k) + ' = ' + UNITS[k]; }); }
  var DISPLAY = { hb: 'Hb', rbc: 'RBC', tlc: 'TLC', neut: 'Neutrophils', lymph: 'Lymphocytes', eos: 'Eosinophils', mono: 'Monocytes', baso: 'Basophils', plt: 'Platelet', hct: 'HCT', mcv: 'MCV', mch: 'MCH', mchc: 'MCHC', rdw: 'RDW', retic: 'Retic count', esr: 'ESR', crp: 'CRP', procal: 'Procalcitonin', ferritin: 'Ferritin', ldh: 'LDH', urea: 'Urea', creat: 'Creatinine', na: 'Sodium', k: 'Potassium', cl: 'Chloride', ca: 'Calcium', mg: 'Magnesium', po4: 'Phosphate', uric: 'Uric acid', bilt: 'Bilirubin (T)', bild: 'Bilirubin (D)', bili: 'Bilirubin (I)', alt: 'ALT', ast: 'AST', alp: 'ALP', ggt: 'GGT', alb: 'Albumin', tprot: 'Total protein', glob: 'Globulin', amy: 'Amylase', lip: 'Lipase', ck: 'CK', ckmb: 'CK-MB', rbs: 'RBS', fbs: 'FBS', ppbs: 'PPBS', hba1c: 'HbA1c', chol: 'Total cholesterol', tg: 'Triglycerides', hdl: 'HDL', ldl: 'LDL', vldl: 'VLDL', tsh: 'TSH', ft3: 'FT3', ft4: 'FT4', iron: 'Serum iron', tibc: 'TIBC', tsat: 'Transferrin saturation', b12: 'Vitamin B12', vitd: 'Vitamin D', ipth: 'iPTH', uacr: 'Urine ACR', pt: 'PT', aptt: 'aPTT', pco2: 'pCO2', po2: 'pO2', hco3: 'HCO3', lactate: 'Lactate' };
  function displayName(k) { return DISPLAY[k] || k; }

  var NUM_RX = /^[<>≤≥]?\s*-?(?:\d{1,3}(?:,\d{2,3})+|\d+)(?:\.\d+)?$/;
  function isNum(v) { return NUM_RX.test(String(v == null ? '' : v).trim()); }
  function numOf(v) { var s = String(v == null ? '' : v).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/); return s ? parseFloat(s[0]) : NaN; }
  function countUnit(v) { var s = String(v).trim(), n = numOf(s); return (/,/.test(s) || n >= 1000) ? '/mm³' : '×10³/µL'; }
  function pltUnit(v) { var s = String(v).trim(), n = numOf(s); if (/,/.test(s) || n >= 1000) return '/mm³'; if (n < 10) return 'lakh/mm³'; return '×10³/µL'; }
  // The usual unit for a test, from its values. {unit} prints once beside the name; {each} = a unit per value (mixed styles).
  function unitFor(name, vals) {
    var nm = String(name || '');
    if (/\([^)]*\)\s*$/.test(nm) && !/\((t|d|i|total|direct|indirect|n\/l\/e\/m)\)\s*$/i.test(nm)) return null;   // the name already carries a unit
    var k = testKey(nm);
    var nums = (vals || []).map(function (v) { return String(v == null ? '' : v).trim(); }).filter(Boolean);
    if (!nums.length || !nums.every(isNum)) return null;
    if (extraUnits[k] != null) return extraUnits[k] ? { unit: extraUnits[k] } : null;
    if (k === 'tlc' || k === 'plt') {
      var f = k === 'tlc' ? countUnit : pltUnit, us = nums.map(f), same = us.every(function (u) { return u === us[0]; });
      return same ? { unit: us[0] } : { each: f };
    }
    return UNITS[k] ? { unit: UNITS[k] } : null;
  }

  // ---- lab table groups (printed as separate tables) ----
  var DEFAULT_GROUPS = [
    'CBC: Hb, RBC, TLC, Neutrophils, Lymphocytes, Eosinophils, Monocytes, Basophils, Platelet, HCT, MCV, MCH, MCHC, RDW, Retic count',
    'LFT & RFT: Urea, Creatinine, Sodium, Potassium, Chloride, Calcium, Magnesium, Phosphate, Uric acid, Bilirubin (T), Bilirubin (D), Bilirubin (I), ALT, AST, ALP, GGT, Albumin, Total protein, Globulin, Amylase, Lipase',
    'Serology: Dengue NS1, Dengue IgM, Dengue IgG, Dengue IgM/IgG, Typhidot, Widal, Typhoid, Scrub typhus, Scrub typhus IgM, Malaria, Malaria antigen, Leptospira, Brucella, HIV, HBsAg, Anti-HCV, UPT, RA factor, ANA, ASO',
    'Inflammatory markers: CRP, ESR, Procalcitonin, Ferritin, LDH',
    'Urine R/M: Urine Protein, Urine Sugar, Urine Pus cells, Urine WBC, Urine RBC, Urine Epithelial cells, Urine Ketone, Urine Albumin',
    'Special tests: '
  ];
  var groups = [];
  function setGroupLines(lines) {
    groups = (lines && lines.length ? lines : DEFAULT_GROUPS).map(function (l) {
      var i = String(l).indexOf(':'); if (i < 0) return null;
      var keys = {}; l.slice(i + 1).split(',').map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (t, j) { keys[testKey(t)] = j + 1; });
      return { name: l.slice(0, i).trim(), keys: keys };
    }).filter(function (g) { return g && g.name; });
    if (!groups.some(function (g) { return /special|other/i.test(g.name); })) groups.push({ name: 'Special tests', keys: {} });
  }
  setGroupLines(null);
  var SERO_RX = /dengue|ns1|typh|widal|scrub|malaria|\bmp\b|lepto|brucell|\bhiv\b|rvd|hbsag|hcv|\bupt\b|rheumatoid|\bra\b|\bana\b|\baso\b|igm|igg|vdrl|rpr|kala|rk39|chikung/i;
  var URINE_RM_RX = /^(urine|u\.?r\/?m|urine r\/?m)\s*(protein|sugar|glucose|pus\s*cells?|wbcs?|rbcs?|epith\w*\s*cells?|epithelial|ketones?|albumin|bile|colou?r|appearance|sp\.?\s*gr\w*|specific gravity|ph|crystals?|casts?|r\/?m)?\s*$/i;
  // which table a test goes into: {i: group index, order: position within the group}
  function groupOf(name) {
    var k = testKey(name), nm = String(name || '').trim();
    var urine = URINE_RM_RX.test(nm) || /^urine\s+(pus|rbc|wbc|epith|sugar|protein|ketone|albumin)/i.test(nm);
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i];
      if (/urine/i.test(g.name) && !urine) continue;
      if (g.keys[k]) return { i: i, order: g.keys[k], name: g.name };
    }
    for (var j = 0; j < groups.length; j++) {
      if (urine && /urine/i.test(groups[j].name)) return { i: j, order: 99, name: groups[j].name };
      if (!urine && /serolog/i.test(groups[j].name) && SERO_RX.test(nm)) return { i: j, order: 99, name: groups[j].name };
    }
    var sp = groups.length - 1;
    for (var s = 0; s < groups.length; s++) if (/special|other/i.test(groups[s].name)) sp = s;
    return { i: sp, order: 99, name: groups[sp].name };
  }

  // "85x13x01x1" -> [85, 13, 1] (neutrophils, lymphocytes, eosinophils); null if it does not look like a differential count
  function splitDlc(v) {
    var s = String(v == null ? '' : v).trim();
    if (!s) return null;
    var parts = s.split(/\s*[xX×*]\s*|\s+/).filter(Boolean);
    if (parts.length < 3 || parts.length > 5 || !parts.every(function (p) { return /^\d{1,3}(\.\d)?$/.test(p); })) return null;
    var n = parts.map(parseFloat), sum = n.reduce(function (a, b) { return a + b; }, 0);
    if (sum < 85 || sum > 115) return null;
    return [n[0], n[1], n[2]].map(function (x) { return String(x); });
  }

  /* ======================= AUTOCORRECT ======================= */
  // His own typos from the old summaries first, then common English ones. Medical words are never "corrected" to other words.
  var DEFAULT_SPELL = [
    'transamnitis = transaminitis', 'tranamnitis = transaminitis', 'crepetation = crepitation', 'crepetations = crepitations', 'micturation = micturition', 'myaligia = myalgia', 'alchohol = alcohol', 'alchol = alcohol',
    'hypocondrial = hypochondrial', 'hypocondrium = hypochondrium', 'decerased = decreased', 'inflamatory = inflammatory', 'respiratoty = respiratory', 'symotomatic = symptomatic', 'perseistent = persistent', 'spectrym = spectrum',
    'sequalae = sequelae', 'emperically = empirically', 'antiobiotic = antibiotic', 'antiobiotics = antibiotics', 'agressive = aggressive', 'couse = course', 'vausea = nausea', 'evalution = evaluation', 'aemia = anemia',
    'hoispital = hospital', 'arthalgia = arthralgia', 'priandial = prandial', 'orthopenia = orthopnea', 'perinium = perineum', 'sucrb = scrub', 'tazobactem = tazobactam', 'ionotropic = inotropic', 'couldnot = could not',
    'rifht = right', 'fibrionus = fibrinous', 'diabeted = diabetes', 'trent = trend', 'raided = raised',
    'abdomin = abdomen', 'abdoman = abdomen', 'abdominl = abdominal', 'admited = admitted', 'admision = admission', 'admisson = admission', 'antibiotcs = antibiotics', 'antibiotis = antibiotics', 'apetite = appetite', 'appitite = appetite',
    'breathlesness = breathlessness', 'breathlessnes = breathlessness', 'cheast = chest', 'diabeties = diabetes', 'diabetis = diabetes', 'diarrohea = diarrhoea', 'diarhea = diarrhea', 'diarhoea = diarrhoea', 'dischage = discharge', 'discharg = discharge',
    'dizzyness = dizziness', 'examinaton = examination', 'examintion = examination', 'feaver = fever', 'fevr = fever', 'genralised = generalised', 'genralized = generalized', 'headach = headache', 'hemodynamicaly = hemodynamically',
    'histroy = history', 'hisotry = history', 'hypertention = hypertension', 'hypertensoin = hypertension', 'infecton = infection', 'infectoin = infection', 'investigaton = investigation', 'invesigation = investigation', 'investigatons = investigations',
    'medicaiton = medication', 'medicaton = medication', 'medecine = medicine', 'medicin = medicine', 'mangement = management', 'managment = management', 'managemnt = management', 'nausia = nausea', 'neurolgical = neurological', 'normaly = normally',
    'oxgen = oxygen', 'oxygne = oxygen', 'perscription = prescription', 'prescripton = prescription', 'presure = pressure', 'pulmanory = pulmonary', 'pulmonery = pulmonary', 'respitory = respiratory', 'respiratroy = respiratory',
    'saturaton = saturation', 'satuartion = saturation', 'sympotm = symptom', 'symtomatic = symptomatic', 'symptomtic = symptomatic', 'symtom = symptom', 'symtoms = symptoms', 'sympton = symptom', 'symptons = symptoms',
    'tendernes = tenderness', 'threatment = treatment', 'treatement = treatment', 'tretment = treatment', 'urinery = urinary', 'vomitting = vomiting', 'vomitinig = vomiting', 'weakeness = weakness', 'weaknes = weakness',
    'wieght = weight', 'weigth = weight', 'consiousness = consciousness', 'conciousness = consciousness', 'concious = conscious', 'unconcious = unconscious', 'temperture = temperature', 'temprature = temperature', 'tempreture = temperature',
    'pateint = patient', 'patinet = patient', 'paitent = patient', 'pateints = patients', 'hospitial = hospital', 'hopsital = hospital', 'referal = referral', 'refered = referred', 'proceedure = procedure', 'procedue = procedure',
    'stomache = stomach', 'heigth = height', 'hieght = height', 'excercise = exercise', 'exersice = exercise', 'rythm = rhythm', 'rythym = rhythm', 'condtion = condition', 'conditon = condition', 'assesment = assessment', 'appoitment = appointment', 'appointmnet = appointment',
    'abbout = about', 'abotu = about', 'abscence = absence', 'accomodate = accommodate', 'accomodation = accommodation', 'accross = across', 'acheive = achieve', 'acheived = achieved', 'acknowlege = acknowledge', 'acquaintence = acquaintance',
    'adn = and', 'adress = address', 'adressed = addressed', 'agian = again', 'allready = already', 'alot = a lot', 'alreayd = already', 'alwasy = always', 'alwyas = always', 'amoung = among', 'anual = annual', 'apparant = apparent',
    'appearence = appearance', 'aproximately = approximately', 'arguement = argument', 'attendence = attendance', 'availabe = available', 'avaliable = available', 'basicly = basically', 'becasue = because', 'becuase = because', 'beacuse = because',
    'becomeing = becoming', 'beggining = beginning', 'begining = beginning', 'beleive = believe', 'belive = believe', 'benifit = benefit', 'bettter = better', 'breif = brief', 'buisness = business', 'calender = calendar', 'carefull = careful',
    'catagory = category', 'cheif = chief', 'cieling = ceiling', 'collegue = colleague', 'comming = coming', 'commited = committed', 'comittee = committee', 'compeletely = completely', 'completly = completely', 'consistant = consistent',
    'contineu = continue', 'contiue = continue', 'continous = continuous', 'contiued = continued', 'convienient = convenient', 'copmlaint = complaint', 'coudl = could', 'couldnt = couldn\'t', 'curiousity = curiosity',
    'decison = decision', 'definately = definitely', 'definatly = definitely', 'definitly = definitely', 'desparate = desperate', 'develope = develop', 'developement = development', 'diffrent = different', 'dissapear = disappear',
    'dissapoint = disappoint', 'doesnt = doesn\'t', 'didnt = didn\'t', 'dont = don\'t', 'durring = during', 'eachother = each other', 'embarass = embarrass', 'enviroment = environment', 'equiptment = equipment', 'esle = else',
    'existance = existence', 'experiance = experience', 'familar = familiar', 'finaly = finally', 'foriegn = foreign', 'foward = forward', 'freind = friend', 'futher = further', 'gaurd = guard', 'goverment = government', 'grammer = grammar',
    'gratefull = grateful', 'guage = gauge', 'happend = happened', 'harrass = harass', 'hasnt = hasn\'t', 'havent = haven\'t', 'helpfull = helpful', 'hte = the', 'htis = this', 'ignorence = ignorance', 'imediately = immediately',
    'immediatly = immediately', 'immedietly = immediately', 'incidently = incidentally', 'independant = independent', 'infomation = information', 'informaton = information', 'intrest = interest', 'isnt = isn\'t', 'knowlege = knowledge',
    'lenght = length', 'liason = liaison', 'libary = library', 'maintainance = maintenance', 'maintenence = maintenance', 'millenium = millennium', 'minumum = minimum', 'mischievious = mischievous', 'mispell = misspell',
    'neccessary = necessary', 'necesary = necessary', 'neccesary = necessary', 'negligable = negligible', 'noticable = noticeable', 'occassion = occasion', 'occured = occurred', 'occurence = occurrence', 'occurance = occurrence',
    'ocurred = occurred', 'ofthe = of the', 'oppurtunity = opportunity', 'oportunity = opportunity', 'orginal = original', 'particulary = particularly', 'peice = piece', 'perfer = prefer', 'permanant = permanent', 'persistant = persistent',
    'personel = personnel', 'posession = possession', 'possable = possible', 'potentialy = potentially', 'practicaly = practically', 'prefered = preferred', 'presense = presence', 'previos = previous', 'previouly = previously',
    'probaly = probably', 'probelm = problem', 'profesional = professional', 'promiss = promise', 'pronounciation = pronunciation', 'publically = publicly', 'quater = quarter', 'questionaire = questionnaire', 'realy = really',
    'reccomend = recommend', 'recieve = receive', 'recieved = received', 'recomend = recommend', 'recomended = recommended', 'relevent = relevant', 'religous = religious', 'remeber = remember', 'repitition = repetition',
    'resistence = resistance', 'responsability = responsibility', 'resturant = restaurant', 'saftey = safety', 'scedule = schedule', 'sentance = sentence', 'seperate = separate', 'seperately = separately', 'shoudl = should',
    'shouldnt = shouldn\'t', 'sieze = seize', 'similiar = similar', 'simliar = similar', 'sincerly = sincerely', 'speach = speech', 'strenght = strength', 'succesful = successful', 'successfull = successful', 'sucessful = successful',
    'supercede = supersede', 'suprise = surprise', 'surprize = surprise', 'tendancy = tendency', 'thier = their', 'tomorow = tomorrow', 'tommorow = tomorrow', 'tommorrow = tomorrow', 'tounge = tongue', 'truely = truly', 'tyhe = the',
    'unforseen = unforeseen', 'unfortunatly = unfortunately', 'untill = until', 'usefull = useful', 'useing = using', 'usualy = usually', 'vaccum = vacuum', 'vacume = vacuum', 'visable = visible', 'wasnt = wasn\'t', 'wich = which',
    'whcih = which', 'wierd = weird', 'wihch = which', 'wiht = with', 'withdrawl = withdrawal', 'wouldnt = wouldn\'t', 'writting = writing', 'yeild = yield', 'teh = the', 'taht = that', 'waht = what', 'wehn = when', 'whihc = which',
    'jsut = just', 'konw = know', 'knwo = know', 'liek = like', 'mroe = more', 'onyl = only', 'peopel = people', 'smae = same', 'soem = some', 'tehy = they', 'thsi = this', 'tihs = this', 'tiem = time', 'yuo = you', 'yoru = your',
    'adviced = advised', 'stablity = stability', 'improvment = improvement', 'improvemnt = improvement', 'gradualy = gradually', 'gradully = gradually', 'subsequntly = subsequently', 'initialy = initially', 'intially = initially',
    'admittd = admitted', 'dicharged = discharged', 'dischaged = discharged', 'afebrille = afebrile', 'afebrlie = afebrile', 'stabel = stable', 'stabe = stable', 'vitaly = vitally', 'vitallly = vitally'
  ];
  var spellMap = {};
  function setSpellLines(lines) {
    spellMap = {};
    (lines && lines.length ? lines : DEFAULT_SPELL).forEach(function (l) {
      var i = String(l).indexOf('='); if (i <= 0) return;
      var w = l.slice(0, i).trim().toLowerCase(), r = l.slice(i + 1).trim();
      if (w && r && w !== r.toLowerCase() && /^[a-z']+$/.test(w)) spellMap[w] = r;
    });
  }
  setSpellLines(null);
  var ignored = {}, last = null;
  function matchCase(orig, fix) {
    if (orig === orig.toUpperCase() && orig.length > 1) return fix.toUpperCase();
    if (orig[0] === orig[0].toUpperCase()) return fix[0].toUpperCase() + fix.slice(1);
    return fix;
  }
  function skipEl(el, skip) {
    if (!el || !(el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && /^(text|search|)$/i.test(el.type || '')))) return true;
    if (el.closest('[data-noac]') || el.readOnly) return true;
    return !!(skip && skip(el));
  }
  function replaceRange(el, start, end, text) {
    el.focus();
    el.setSelectionRange(start, end);
    var ok = false;
    try { ok = document.execCommand('insertText', false, text); } catch (e) { ok = false; }
    if (!ok) { el.setRangeText(text, start, end, 'end'); el.dispatchEvent(new Event('input', { bubbles: true })); }
  }
  function attach(root, opts) {
    opts = opts || {};
    if (!root || root._acOn) return; root._acOn = true;
    root.addEventListener('input', function (e) {
      var el = e.target;
      if (e.inputType === 'historyUndo' && last && last.el === el) { ignored[last.orig.toLowerCase()] = true; last = null; return; }
      if (skipEl(el, opts.skip)) return;
      var it = e.inputType || '';
      var boundary = (it === 'insertText' && e.data && e.data.length === 1 && /[\s.,;:!?)\]]/.test(e.data)) || it === 'insertLineBreak' || it === 'insertParagraph';
      if (!boundary) { last = null; return; }
      var caret = el.selectionStart; if (caret == null || caret !== el.selectionEnd) return;
      var end = caret - 1, before = el.value.slice(0, end), m = /(^|[^A-Za-z0-9'])([A-Za-z']{2,})$/.exec(before);
      if (!m) return;
      var word = m[2], start = end - word.length, key = word.toLowerCase().replace(/^'+|'+$/g, '');
      var fix = spellMap[key];
      if (!fix || ignored[key] || key !== word.toLowerCase()) return;
      var fixed = matchCase(word, fix), bchar = el.value.slice(end, caret);
      replaceRange(el, start, end, fixed);
      var newCaret = start + fixed.length + bchar.length;
      el.setSelectionRange(newCaret, newCaret);
      last = { el: el, start: start, fixed: fixed, orig: word, caret: newCaret };
    }, true);
    root.addEventListener('keydown', function (e) {
      if (!last) return;
      var el = e.target;
      if (e.key === 'Backspace' && el === last.el && el.selectionStart === last.caret && el.selectionEnd === last.caret) {
        e.preventDefault();
        var L = last; last = null;
        replaceRange(el, L.start, L.start + L.fixed.length, L.orig);
        var c = L.start + L.orig.length + (L.caret - L.start - L.fixed.length);
        el.setSelectionRange(c, c);
        ignored[L.orig.toLowerCase()] = true;
        return;
      }
      if (!/^(Shift|Control|Alt|Meta|CapsLock)$/.test(e.key) && !((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z')) last = null;
    }, true);
    root.addEventListener('mousedown', function () { last = null; }, true);
    // red underline for other unknown words (the browser's own spell checker)
    root.querySelectorAll('textarea, input[type="text"], input:not([type])').forEach(function (el) { if (!skipEl(el, opts.skip)) el.spellcheck = true; });
  }

  /* ======================= FONTS ======================= */
  var CANDIDATES = ['Times New Roman', 'Times', 'Georgia', 'Cambria', 'Book Antiqua', 'Palatino Linotype', 'Palatino', 'Garamond', 'Baskerville', 'Hoefler Text', 'Charter', 'Iowan Old Style', 'Big Caslon', 'Didot', 'Bodoni 72',
    'Constantia', 'Century Schoolbook', 'Bookman Old Style', 'Sitka Text', 'Liberation Serif', 'DejaVu Serif', 'Noto Serif', 'Calibri', 'Arial', 'Helvetica', 'Helvetica Neue', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Segoe UI',
    'Gill Sans', 'Gill Sans MT', 'Optima', 'Futura', 'Avenir', 'Avenir Next', 'Century Gothic', 'Candara', 'Corbel', 'Lucida Grande', 'Lucida Sans', 'Franklin Gothic Medium', 'Aptos', 'Liberation Sans', 'DejaVu Sans',
    'Noto Sans', 'Roboto', 'Open Sans', 'Arial Narrow', 'Courier New', 'Menlo', 'Consolas'];
  var WEB_FONTS = ['EB Garamond', 'Merriweather', 'Lora', 'PT Serif', 'Source Serif 4', 'Noto Serif', 'Roboto', 'Open Sans', 'Lato', 'Noto Sans'];
  var DEVANAGARI = '"Noto Sans Devanagari", "Kohinoor Devanagari", "Nirmala UI", "Mangal", "Devanagari Sangam MN"';
  function installed() {
    var c = document.createElement('canvas').getContext('2d'), txt = 'mmmmmmmmmmlliWWQ@#1029 Patient';
    var base = ['monospace', 'serif', 'sans-serif'].map(function (b) { c.font = '72px ' + b; return c.measureText(txt).width; });
    return CANDIDATES.filter(function (f) {
      return ['monospace', 'serif', 'sans-serif'].some(function (b, i) { c.font = '72px "' + f + '", ' + b; return c.measureText(txt).width !== base[i]; });
    });
  }
  function isWeb(f) { return WEB_FONTS.indexOf(f) >= 0 && installed().indexOf(f) < 0; }
  function webHref(f) { return 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(f).replace(/%20/g, '+') + ':ital,wght@0,400;0,700;1,400&display=swap'; }
  function linkTag(f) { return f && WEB_FONTS.indexOf(f) >= 0 ? '<link rel="stylesheet" href="' + webHref(f) + '">' : ''; }
  function ensureLoaded(f) {
    if (!f || WEB_FONTS.indexOf(f) < 0 || document.querySelector('link[data-webfont="' + f + '"]')) return;
    var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = webHref(f); l.dataset.webfont = f; document.head.appendChild(l);
  }
  function stack(f) {
    f = f || 'Times New Roman';
    var generic = /sans|arial|helvetica|verdana|tahoma|calibri|segoe|gill|optima|futura|avenir|gothic|candara|corbel|lucida|franklin|aptos|roboto|lato/i.test(f) ? 'sans-serif' : (/courier|menlo|consolas/i.test(f) ? 'monospace' : 'serif');
    return '"' + f.replace(/"/g, '') + '", ' + DEVANAGARI + ', ' + generic;
  }
  // <select> with the fonts on this computer, then free web fonts
  function fillSelect(sel, current) {
    current = current || 'Times New Roman';
    var have = installed(), web = WEB_FONTS.filter(function (f) { return have.indexOf(f) < 0; });
    if (have.indexOf(current) < 0 && web.indexOf(current) < 0) have.unshift(current);
    var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    sel.innerHTML = '<optgroup label="On this computer">' + have.map(function (f) { return '<option value="' + esc(f) + '" style="font-family:' + esc(stack(f)) + '">' + esc(f) + '</option>'; }).join('') + '</optgroup>' +
      (web.length ? '<optgroup label="Free web fonts (need internet)">' + web.map(function (f) { return '<option value="' + esc(f) + '">' + esc(f) + '</option>'; }).join('') + '</optgroup>' : '');
    sel.value = current;
  }

  window.ClinicTools = {
    Lab: { testKey: testKey, unitFor: unitFor, isNum: isNum, numOf: numOf, groupOf: groupOf, setGroupLines: setGroupLines, DEFAULT_GROUPS: DEFAULT_GROUPS, setUnitLines: setUnitLines, unitLines: unitLines, splitDlc: splitDlc, displayName: displayName, UNITS: UNITS },
    Spell: { attach: attach, setLines: setSpellLines, DEFAULT: DEFAULT_SPELL, has: function (w) { return !!spellMap[String(w).toLowerCase()]; } },
    Fonts: { installed: installed, stack: stack, fillSelect: fillSelect, ensureLoaded: ensureLoaded, linkTag: linkTag, isWeb: isWeb, WEB: WEB_FONTS }
  };
})();
