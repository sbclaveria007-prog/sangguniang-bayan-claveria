# Sangguniang Bayan of Claveria, Masbate
### Official Legislative Portal

> **Transparent Legislation. Responsive Governance.**

A fully responsive, single-page legislative portal for the Sangguniang Bayan (Municipal Legislative Council) of Claveria, Masbate, Philippines. Built with vanilla HTML, CSS, and JavaScript — no frameworks or build tools required.

---

## 🏛️ About

This portal serves as the official online presence for the Sangguniang Bayan of Claveria, Masbate. It provides citizens with direct access to:

- Approved ordinances and resolutions
- Citizen services and ARTA-compliant forms
- Legislative document request and tracking
- Council member profiles and contact information
- Upcoming session schedules
- Citizen proposal submission
- Legislative performance scoreboard
- News and announcements

---

## 📁 Repository Structure

```
sangguniang-bayan-claveria/
│
├── index.html                  # Main HTML entry point
│
├── css/
│   └── styles.css              # All styles — layout, components, responsive
│
├── js/
│   └── main.js                 # All JavaScript — data, interactions, UI logic
│
├── assets/
│   └── images/
│       └── legislative-hall.jpeg   # Hero background — Legislative Hall rendering
│
├── .gitignore
├── LICENSE
└── README.md
```

---

## 🚀 Getting Started

No build tools or dependencies are needed. Simply open `index.html` in any modern web browser.

### Option 1 — Open directly
```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/sangguniang-bayan-claveria.git

# Navigate into the folder
cd sangguniang-bayan-claveria

# Open in browser
open index.html           # macOS
start index.html          # Windows
xdg-open index.html       # Linux
```

### Option 2 — Serve locally (recommended for development)
```bash
# Using Python (built-in)
python3 -m http.server 8000

# Then visit:
# http://localhost:8000
```

### Option 3 — GitHub Pages
1. Push to GitHub
2. Go to **Settings → Pages**
3. Set source to `main` branch, `/ (root)`
4. Visit `https://YOUR_USERNAME.github.io/sangguniang-bayan-claveria/`

---

## 🎨 Tech Stack

| Technology | Purpose |
|---|---|
| HTML5 | Semantic structure and content |
| CSS3 | Custom properties, Grid, Flexbox, animations |
| Vanilla JavaScript (ES6+) | UI interactions, data rendering, form handling |
| [Font Awesome 6.4](https://fontawesome.com) | Icons (CDN) |
| [Google Fonts](https://fonts.google.com) | Playfair Display + DM Sans (CDN) |

No npm. No bundler. No framework. Just files.

---

## ✨ Features

- **Digital Bulletin Board** — Latest ordinances and resolutions with uniform card design
- **Smart Search** — Keyword search across all legislative documents
- **Citizen Services Portal** — ARTA-compliant service cards with modal forms (CSO Accreditation, MARINA Resolutions, Tricycle Franchises, Document Requests)
- **Document Request & Tracker** — Submit requests and track status with a step-by-step progress indicator
- **Know Your Laws** — Plain-language ordinance summaries with sector filtering
- **Council Profiles** — Vice Mayor, SB members, and Secretariat staff
- **Sessions Calendar** — Upcoming regular and special session schedule
- **Legislative Dashboard** — Statistics with animated counters, bar charts, and pie charts
- **Citizen Legislative Dashboard** — Personalized tabs for Fishers, Youth, Farmers, Business, and Transport sectors
- **Citizen Proposals** — Submit proposed ordinances and resolutions with reference number generation
- **Legislative Scoreboard** — Member performance data sortable by year and metric
- **News & Announcements** — Latest updates from the SB
- **Transparency Corner** — Open government documents and records
- **Responsive Design** — Mobile, tablet, and desktop layouts
- **Announcement Ticker** — Scrolling latest news bar

---

## 🖼️ Hero Image

The hero section uses a rendering of the Claveria Legislative Hall (`assets/images/legislative-hall.jpeg`) blended into the navy gradient using CSS `mix-blend-mode: screen` at 65% opacity.

To replace the image:
1. Place your new image in `assets/images/`
2. Update the `background-image` path in `css/styles.css`:
   ```css
   .hero-bg-img {
     background-image: url('../assets/images/your-new-image.jpg');
   }
   ```

---

## 🎨 Color Scheme

| Variable | Value | Use |
|---|---|---|
| `--navy` | `#0a1f44` | Primary dark |
| `--navy-light` | `#1a3a6e` | Hover states |
| `--blue` | `#1e4d8c` | Accents |
| `--blue-mid` | `#2563ab` | Gradients |
| `--gold` | `#c9a227` | Brand accent |
| `--gold-light` | `#e8be4b` | Light gold |
| `--gold-pale` | `#fdf3d0` | Backgrounds |

---

## 🔧 Customization

### Updating Legislative Data
All data is stored in `js/main.js` as plain JavaScript arrays and objects. Look for clearly labeled sections:
- `// ---- CITIZEN DASHBOARD DATA ----` — sector-specific laws, proposals, hearings
- `// ---- PROPOSALS ----` — citizen proposal records
- `// ---- SB SCOREBOARD ----` — member performance data for 2024 and 2025

### Updating Contact Information
Search `index.html` for `sbclaveria@ymail.com` and replace with the current email address. The office address and hours are in the Secretary section and footer.

### Announcement Ticker
Update the `.ticker-text` content in `index.html` under the `<!-- TICKER -->` comment.

---

## 📋 ARTA Compliance

This portal is designed in alignment with the Anti-Red Tape Act of 2007 (RA 9485) and RA 11032, displaying:
- Service processing timeframes
- Document requirements per service
- Complaint escalation notice to ARTA

---

## 📄 License

This project is released under the [MIT License](LICENSE).

---

## 👥 Office Contact

**Office of the SB Secretary**
Legislative Hall, Municipal Government Compound
Poblacion District 1, Claveria, Masbate 5419

📧 sbclaveria@ymail.com
🕒 Monday – Friday, 7:00 AM – 6:00 PM

---

*Developed for the Sangguniang Bayan of Claveria, Masbate · Republic of the Philippines*
