# NIKO Hospital Pvt. Ltd. — Website

This folder holds the hospital's public website, online appointment booking and admin panel.

* **Website:** `/` (English and नेपाली, works well on phones)
* **Admin panel:** `/admin.html`. The footer of every page also has a **Staff login** link.

---

## 1. What is included (Phase 1)

| Your requirement | Where it is |
|---|---|
| Hospital details, services, departments, doctors and timings | Home, About, Departments, Find a doctor, Facilities |
| Online booking in 3 steps (doctor → date & time → details) | `#/book`. Taken time slots are blocked, and a slot can't be double-booked. Patients get a booking code and can change or cancel at `#/my-booking`. |
| Booking alerts by SMS, WhatsApp and email | Sent automatically once you add the keys in `.env` (section 5). Without them, patients still get a one-tap “Send to hospital on WhatsApp” button. |
| Emergency bar | Red bar that stays at the top of every page: 24-hour number (tap to call), ambulance number (shown only once you add one) and GPS **Directions**. Phones also get a bottom bar with Call, Book, Doctors and Directions. |
| Find a Doctor directory | Filter by department, condition, day/availability, language and gender. Each profile shows the photo, degrees, NMC number, clinical focus, OPD hours and a Book button. |
| Smart search | Understands symptoms (“chest pain”, “sugar”, “knee”), Nepali words (घुँडा, सुगर), doctor names and small spelling mistakes. Press `/` on a computer to open it. |
| Condition pages | 56 conditions, each answering: What is it? Symptoms? How to prepare? Treatment? Recovery? Plus “when to come to Emergency” where it matters. |
| Facilities | Ward, HDU, OT, Lab, 24-hour Pharmacy, ECG, 2D Echo, Ultrasound, X-ray, NPL, PFT and Emergency. Add more in Admin. |
| Patient stories, reviews and accreditations | Stories and testimonials are added in Admin. Feedback can be published as a testimonial with one click. Shows the Government of Nepal registration and PAN. |
| Mobile-first and fast | No heavy frameworks: the site loads about 60 KB of code, images load only when needed, and buttons are thumb-sized. |
| Accessibility (WCAG 2.1 AA) | High-contrast colours, A−/A+ text size, high-contrast mode, keyboard navigation, screen-reader labels, plain language, English/नेपाली switch |
| Security | HTTPS redirect and HSTS, strict security headers, hashed passwords, login rate-limit, HttpOnly session cookies, request-forgery protection, spam traps on forms, upload type and size checks |
| Google Form for doctors | `google-form/create-doctor-form.gs`. New answers appear on the website within about a minute (section 4). |
| Admin panel with live preview | Edit **every** text, photo, colour, size, section and list item. The website preview on the right third of the screen updates as you type. Press **Save** to publish. |
| Slideshow | Admin → Slideshow (add event and visiting-specialist photos) |
| Feedback, Google reviews, Q&A | `#/feedback`, `#/qa`. Questions are answered in Admin and published. |
| Notices and vacancies | Notice board, scrolling notice bar, and a popup for notices marked “Important”. Notices can have an expiry date and a PDF attachment. |
| Facebook and TikTok | Admin → Social media. The Facebook page feed and TikTok profile are embedded. |
| Staff email | Admin → Staff email: turn it on and paste the webmail address once you buy the domain (section 6). |
| Google Map | Your map embed is used on the home and contact pages, plus a GPS Directions link. |

**Planned for Phase 2:** patient portal (lab reports, prescriptions, bill payment through eSewa/Khalti/Fonepay). The portal page already exists and says “coming soon”.

---

## 2. Run it on a computer (to try it)

You need **Node.js 18 or newer** (https://nodejs.org).

```bash
cd niko-hospital
cp .env.example .env        # then open .env and set ADMIN_PASSWORD
npm install
npm start
```

Open http://localhost:3000 for the website and http://localhost:3000/admin.html for the admin panel.

---

## 3. Put it online (when you have the domain)

1. Buy the domain (for example `nikohospital.com.np`) and rent a small Linux server (VPS) with 1 GB RAM. Any provider in Nepal or abroad works.
2. Install Node.js 18+ and copy this folder to the server. Create `.env` from `.env.example` with `NODE_ENV=production`.
3. Run it permanently with `npx pm2 start server.js --name niko` and `npx pm2 save`.
4. Put **Caddy** in front of it for free automatic HTTPS. Create a `Caddyfile` containing:
   ```
   nikohospital.com.np, www.nikohospital.com.np {
       reverse_proxy localhost:3000
   }
   ```
5. Point the domain's DNS “A record” to the server's IP address.


### Option B — GitHub + Railway (no server to manage)

1. **GitHub:** create a **private** repository and upload the *contents* of this folder (so `package.json` is at the top level). Do not upload `.env`, `node_modules`, `data/*.json` or `uploads/` — `.gitignore` already excludes them.
2. **Railway:** New Project → *Deploy from GitHub repo* → choose the repository. Railway runs `npm install` and `npm start` automatically and sets `PORT`.
3. **Volume (important):** right-click the project canvas → *Volume* → attach it to the service with mount path **`/data`**. Without a volume, every redeploy erases bookings, edits and uploaded photos.
4. **Variables** (service → Variables):
   ```
   NODE_ENV=production
   DATA_DIR=/data/db
   UPLOAD_DIR=/data/uploads
   ADMIN_USER=admin
   ADMIN_PASSWORD=<a long password>
   ```
   plus any email / WhatsApp / SMS keys from `.env.example`.
5. **Domain:** service → Settings → Networking → *Generate Domain* gives a free `…up.railway.app` address with HTTPS. For your own domain click *Custom Domain*, then add the **CNAME** and **TXT** records Railway shows at your DNS provider. For the bare domain (without www) use Cloudflare DNS, which supports this.
6. Every push to GitHub redeploys automatically; content edited in Admin stays on the volume.

**Backups:** copy the `data/` and `uploads/` folders (on Railway: the `/data` volume) every day. `data/` holds the content, bookings, feedback and logins; `uploads/` holds the photos. Admin → Undo/history also keeps the last 30 saved versions of the website content.

---

## 4. Doctor Google Form → website

1. Go to https://script.google.com → **New project**, paste `google-form/create-doctor-form.gs`, then run **setup**. This creates the form and its response sheet.
2. In the form, add one question yourself: **Photo**, type **File upload**. Google doesn't let scripts create this type of question.
3. In the response sheet, go to **File → Share → Publish to web**, choose the responses sheet and **CSV**, then click **Publish** and copy the link.
4. Paste the link in Admin → **Doctor form & Google** → Save. Click **Check now** to test it.
5. Send the form link to the doctors' group.

Each form answer is matched to the doctor's existing profile by NMC number. Answers that aren't empty replace the website details. To stop the form from changing a doctor's profile, tick “Ignore Google Form answers for this doctor” in Admin. To check each answer before it goes live, untick “Publish form answers immediately” and add a column called **Approved** to the sheet. Only rows with `Yes` in that column will be shown.

---

## 5. Automatic SMS, WhatsApp and email

All of these are optional. Fill in the matching lines in `.env` and restart the server.

* **Email:** any SMTP mailbox, such as Zoho Mail or Google Workspace. New bookings, feedback and questions go to `NOTIFY_EMAIL`, or to the email set in Admin → Booking settings.
* **WhatsApp:** needs the WhatsApp Business **Cloud API** from Meta, a verified business, a number that isn't already used in the normal WhatsApp app, and an approved message template. Until this is set up, patients see a “Send to hospital on WhatsApp” button after booking. It opens WhatsApp with all the details filled in.
* **SMS:** Sparrow SMS account token.

---

## 6. Staff email

Create the mailboxes with your email provider once the domain is bought (for example `dr.name@nikohospital.com.np` on Zoho Mail or Google Workspace). Then go to Admin → Staff email, turn it on, and paste the webmail address (for example `https://mail.zoho.com`). Staff open their mail from the website footer.

A full inbox built into the website is possible later. It needs the mail provider's IMAP settings and is a bigger job.

---

## 7. Photos

Every placeholder picture shows a number, such as **P06** for the operation theatre or **D05** for a doctor. See `docs/PHOTO-GUIDE.md` for the full list. Photograph each item, then upload the photo in Admin at the matching place. Photos are resized automatically.

---

## 8. Files

```
server.js                 backend (API, login, bookings, uploads)
lib/                      data storage, Google Sheet reader, SMS/WhatsApp/email
content/default-content.js  starting content (copied to data/content.json on first run)
public/index.html         website
public/admin.html         admin panel
public/assets/            site & admin code and styles
public/img/               logo, building photo, numbered placeholders
google-form/              script that creates the doctor form
docs/PHOTO-GUIDE.md       numbered photo list for staff
data/                     live content, bookings, feedback (back this up!)
uploads/                  photos and PDFs uploaded in Admin (back this up!)
```

## 9. Please check before launch

* Director's name, photo and message (Admin → Director's message)
* OPD hours for every doctor. The default is 09:00–17:00 (Admin → Booking settings → Default OPD hours).
* Schedules for Dr. Suman Baral and Dr. Sujan Acharya. The poster shows no days for them, so patients are asked to call.
* Nepali text on the condition pages. Names are in Nepali; the explanations are in English for now.
* The registration number (Admin → Registration numbers)
* The Google review link. Get the official “Ask for reviews” link from your Google Business Profile.
