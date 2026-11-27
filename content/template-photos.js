/*
 * Template (stock) photos used until the hospital uploads its own.
 *
 * Every photo is a free-to-use stock photo from Pexels (pexels.com/license).
 * They are NOT pictures of NIKO Hospital — replace each one from the Admin
 * panel with a real photo (see docs/PHOTO-GUIDE.md).
 *
 * The website refers to them as "stock/<key>.jpg". The server fetches each
 * photo once, keeps a copy on disk, and serves it from our own address
 * (see lib/stock.js).
 */

// key: [Pexels photo id, what the photo shows]
const PHOTOS = {
  reception: [7108329, 'Patients at a hospital reception desk'],
  emergency: [5049242, 'Hospital room with two beds and monitoring equipment'],
  ward: [7563452, 'Hospital ward with beds and privacy curtains'],
  hdu: [6291261, 'Hospital monitor showing vital signs'],
  ot: [7583384, 'Two surgeons preparing in an operating room'],
  surgery: [4769129, 'Surgeons operating in an operating room'],
  surgery2: [8089556, 'Two surgeons working in a bright operating room'],
  lab: [6627690, 'Blood sample being prepared for the centrifuge'],
  lab2: [8600447, 'Technician holding blood samples in test tubes'],
  pharmacy: [13119976, 'Pharmacist arranging medicines on pharmacy shelves'],
  ecg: [415779, 'ECG tracing on graph paper'],
  ecg2: [1093161, 'ECG printout showing heart rhythm'],
  echo: [16388113, 'Doctor performing an ultrasound scan'],
  ultrasound: [7089339, 'Doctor using an ultrasound scanner'],
  scan: [7108421, 'Ultrasound scan in a medical facility'],
  xray: [4225925, 'Doctor examining a chest X-ray'],
  chestxray: [4225880, 'Chest X-ray being examined'],
  lungs: [4226257, 'Medical professional examining a chest X-ray'],
  radiology: [4989192, 'Radiologist examining an X-ray'],
  ortho: [4989189, 'Doctor analysing a spine X-ray'],
  mri: [4226219, 'Doctor reviewing MRI brain scans'],
  ent: [5206946, 'Ear examination with an otoscope'],
  consult: [8460093, 'Doctor measuring a patient’s blood pressure'],
  stethoscope: [5214992, 'Doctor examining a patient with a stethoscope'],
  checkup: [7108348, 'Doctor checking a patient’s blood pressure'],
  team: [6129507, 'Team of doctors and nurses'],
  discussion: [5452193, 'Healthcare professionals in discussion'],
  glucometer: [8670516, 'Blood sugar test with a glucometer'],
  pregnancy: [7089387, 'Pregnant woman consulting a doctor'],
  skin: [5701545, 'Skin examination with a magnifier'],
  counselling: [7579312, 'Counselling session'],
  child: [5998446, 'Doctor listening to a child’s heartbeat'],
  anaesthesia: [6291290, 'Anaesthesia mask in an operating room'],
  cabin: [8410647, 'Hospital bed in a sunlit private room'],
};

const path = (key) => `stock/${key}.jpg`;
const cdnUrl = (key, width = 1400) => {
  const p = PHOTOS[key];
  return p ? `https://images.pexels.com/photos/${p[0]}/pexels-photo-${p[0]}.jpeg?auto=compress&cs=tinysrgb&w=${width}` : '';
};

// Numbered placeholders (docs/PHOTO-GUIDE.md) → template photo.
const BY_PHOTO_NO = {
  P02: 'reception', P03: 'emergency', P04: 'ward', P05: 'hdu', P06: 'ot', P07: 'lab', P08: 'pharmacy',
  P09: 'ecg', P10: 'echo', P11: 'ultrasound', P12: 'xray', P13: 'ent', P14: 'lungs', P15: 'consult',
  P16: 'team', P18: 'checkup', P19: 'cabin', P20: 'discussion',
};

const BY_DEPARTMENT = {
  emergency: 'emergency', 'internal-medicine': 'stethoscope', cardiology: 'ecg2', endocrinology: 'glucometer',
  pulmonology: 'chestxray', orthopaedics: 'ortho', neurosurgery: 'mri', gynaecology: 'pregnancy', ent: 'ent',
  dermatology: 'skin', psychiatry: 'counselling', paediatrics: 'child', 'general-surgery': 'surgery',
  urology: 'scan', radiology: 'radiology', anaesthesiology: 'anaesthesia',
};

// For items added later in the Admin panel: pick a photo from words in the name.
const BY_WORD = [
  [/emergen|casualty|आकस्मिक/i, 'emergency'], [/cabin|private room|deluxe|क्याबिन/i, 'cabin'], [/hdu|icu|critical|intensive/i, 'hdu'],
  [/ward|inpatient|bed|वार्ड/i, 'ward'], [/endoscop|colonoscop|gastroscop/i, 'surgery2'], [/operat|theatre|\bot\b|surg|शल्य/i, 'ot'],
  [/pharma|medicine shop|फार्मेसी/i, 'pharmacy'], [/lab|blood|patholog|ल्याब/i, 'lab'], [/ecg|ईसीजी/i, 'ecg'], [/echo|इको/i, 'echo'],
  [/ultra|usg|sonograph/i, 'ultrasound'], [/x-?ray|radiolog|imaging|एक्सरे/i, 'xray'], [/npl|ent|ear|nose|throat/i, 'ent'],
  [/pft|pulmon|lung|chest|spiro/i, 'lungs'], [/cardio|heart|मुटु/i, 'ecg2'], [/diabet|endocrin|thyroid|sugar/i, 'glucometer'],
  [/ortho|bone|joint|fractur/i, 'ortho'], [/neuro|brain|spine/i, 'mri'], [/gyna|obstet|pregnan|matern|women/i, 'pregnancy'],
  [/derma|skin/i, 'skin'], [/psych|mental|counsel/i, 'counselling'], [/paedi|pedi|child|baby/i, 'child'], [/anaesth|anesth/i, 'anaesthesia'],
  [/urolog|kidney/i, 'scan'], [/reception|help desk|front desk/i, 'reception'], [/camp|check-?up|screening|health day/i, 'checkup'],
  [/specialist|clinic|consult|opd/i, 'consult'], [/team|staff|doctors/i, 'team'],
];
const GENERIC = ['discussion', 'reception', 'team', 'consult', 'checkup'];

function pick(text, n = 0) {
  const s = String(text || '');
  const hit = BY_WORD.find(([re]) => re.test(s));
  return hit ? hit[1] : GENERIC[n % GENERIC.length];
}

// Photos shown in the gallery until real ones are uploaded.
const GALLERY = [
  ['reception', 'Reception & registration', 'रिसेप्सन तथा दर्ता'],
  ['ward', 'Inpatient ward', 'वार्ड'],
  ['ot', 'Operation theatre', 'शल्यक्रिया कक्ष'],
  ['lab', 'Laboratory', 'प्रयोगशाला'],
  ['pharmacy', '24-hour pharmacy', '२४ घण्टा फार्मेसी'],
  ['ultrasound', 'Ultrasound', 'अल्ट्रासाउन्ड'],
  ['consult', 'Specialist OPD', 'विशेषज्ञ ओपीडी'],
  ['team', 'Our team', 'हाम्रो टिम'],
];

module.exports = { PHOTOS, path, cdnUrl, BY_PHOTO_NO, BY_DEPARTMENT, pick, GALLERY };
