/**
 * NIKO Hospital — creates the "Doctor profile" Google Form and its response sheet.
 *
 * HOW TO USE (5 minutes, once):
 *  1. Go to https://script.google.com  →  New project.
 *  2. Delete what is there, paste this whole file, click Save.
 *  3. Choose the function "setup" at the top and click Run. Allow the permissions it asks for.
 *  4. Open View → Logs (or Execution log). It shows the form link and the sheet link.
 *  5. Open the form (edit link) → add ONE question yourself:
 *       "Photo (portrait, plain background)"  →  type: File upload  →  allow only Images, max 1 file, 10 MB.
 *     (Google does not allow scripts to add file-upload questions.)
 *  6. Open the response sheet → File → Share → Publish to web → choose "Form responses 1" and "Comma-separated values (.csv)"
 *     → Publish → copy the link → paste it in the website Admin → "Doctor form & Google" → Save.
 *  7. Send the form's "Send" link to the doctors' group.
 *
 * Doctors can submit again later to update their details — the newest answer is used (matched by NMC number).
 * Uploaded photos are automatically made viewable by link so the website can show them.
 */

var DEPARTMENTS = [
  'Emergency & Critical Care', 'Internal Medicine', 'Cardiology', 'Endocrinology & Diabetes', 'Chest & Lung (Pulmonology)',
  'Orthopaedics', 'Neurosurgery (Brain & Spine)', 'Obstetrics & Gynaecology', 'ENT (Ear, Nose & Throat)', 'Dermatology & Venereology',
  'Psychiatry & Mental Health', 'Paediatrics', 'General Surgery', 'Urology', 'Radiology & Imaging', 'Anaesthesiology',
];

function setup() {
  var form = FormApp.create('NIKO Hospital — Doctor profile for website / वेबसाइटका लागि डाक्टर विवरण');
  form.setDescription(
    'Please fill in your details for the NIKO Hospital website. Everything except your mobile number will be shown to patients.\n' +
    'कृपया निको अस्पतालको वेबसाइटका लागि आफ्नो विवरण भर्नुहोस् । मोबाइल नम्बर बाहेक सबै विवरण बिरामीले देख्नेछन् ।'
  );
  form.setProgressBar(false);
  form.setAllowResponseEdits(true);

  form.addTextItem().setTitle('Full name (English)').setHelpText('Example: Dr. Bikesh Shrestha').setRequired(true);
  form.addTextItem().setTitle('Full name (Nepali) / नेपालीमा पूरा नाम').setHelpText('उदाहरण: डा. बिकेश श्रेष्ठ');
  form.addTextItem().setTitle('Title / designation').setHelpText('Example: Senior Cardiologist, Consultant Physician').setRequired(true);
  form.addListItem().setTitle('Department / speciality').setChoiceValues(DEPARTMENTS).setRequired(true);

  var nmc = form.addTextItem().setTitle('NMC registration number').setRequired(true);
  nmc.setValidation(FormApp.createTextValidation().requireNumber().setHelpText('Numbers only').build());

  form.addParagraphTextItem().setTitle('Degrees / qualifications').setHelpText('Example: MBBS, MD Internal Medicine (IOM), DM Cardiology (IOM)');
  form.addTextItem().setTitle('Other hospital / institution (affiliation)').setHelpText('Optional. Example: Shahid Gangalal National Heart Centre');
  form.addParagraphTextItem().setTitle('About you — details patients will see').setHelpText('2–4 short sentences in simple words: your experience and what you help patients with.');
  form.addParagraphTextItem().setTitle('Conditions you treat / clinical focus').setHelpText('Separate with commas. Example: Heart failure, Chest pain, High blood pressure');

  form.addCheckboxItem().setTitle('Languages spoken')
    .setChoiceValues(['Nepali', 'English', 'Hindi', 'Maithili', 'Bhojpuri', 'Newari', 'Tamang']).showOtherOption(true);
  form.addMultipleChoiceItem().setTitle('Gender').setChoiceValues(['Male', 'Female', 'Prefer not to say']);

  form.addCheckboxItem().setTitle('OPD days available at NIKO Hospital')
    .setChoiceValues(['Every day', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'First Saturday of every month'])
    .setRequired(true);
  form.addTextItem().setTitle('OPD hours (time)').setHelpText('24-hour format. Example: 09:00-13:00, 15:00-17:00').setRequired(true);
  form.addTextItem().setTitle('Mobile number (private — NOT shown on website)');

  var ss = SpreadsheetApp.create('NIKO Hospital — Doctor form responses');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  ScriptApp.newTrigger('onDoctorFormSubmit').forForm(form).onFormSubmit().create();

  Logger.log('Form (edit):  ' + form.getEditUrl());
  Logger.log('Form (send to doctors):  ' + form.getPublishedUrl());
  Logger.log('Response sheet:  ' + ss.getUrl());
  Logger.log('NEXT: add the "Photo" file-upload question in the form, then publish the sheet as CSV (see the top of this file).');
}

// Makes uploaded photos viewable by link, so the website can display them.
function onDoctorFormSubmit(e) {
  e.response.getItemResponses().forEach(function (r) {
    if (r.getItem().getType() !== FormApp.ItemType.FILE_UPLOAD) return;
    [].concat(r.getResponse()).forEach(function (id) {
      try { DriveApp.getFileById(id).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (err) { Logger.log(err); }
    });
  });
}
