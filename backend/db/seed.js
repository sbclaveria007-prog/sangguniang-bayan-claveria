'use strict';
const { getDb } = require('./connection');

function seedDatabase() {
  const db = getDb();

  // ── Members ──────────────────────────────────────────────────────────────
  const insertMember = db.prepare(`
    INSERT OR IGNORE INTO members (full_name, position, committee, is_presiding, is_exofficio, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const members = [
    ['Hon. Froilan V. Andueza',  'Vice Mayor & Presiding Officer',    null, 1, 0, 0],
    ['Hon. Dakila Alim-Ante',    '1st Regular Member',  'Committee on Health & Sanitation', 0, 0, 1],
    ['Hon. Adan F. Sandigan',    '2nd Regular Member',  'Committee on Public Works',        0, 0, 2],
    ['Hon. Mark A. Andueza',     '3rd Regular Member',  'Committee on Education',           0, 0, 3],
    ['Hon. Nonelona Lim',        '4th Regular Member',  'Committee on Agriculture',         0, 0, 4],
    ['Hon. Elvin M. Berdin',     '5th Regular Member',  'Committee on Finance & Appropriations', 0, 0, 5],
    ['Hon. Joven P. Arriesgado', '6th Regular Member',  'Committee on Environment',         0, 0, 6],
    ['Hon. Vicente R. Sabaulan', '7th Regular Member',  'Committee on Trade & Commerce',    0, 0, 7],
    ['Hon. Ric C. Rubia',        '8th Regular Member',  'Committee on Public Safety',       0, 0, 8],
    ['Hon. Charlie Albao',       'Ex-Officio Member',   'Liga ng mga Barangay President',   0, 1, 9],
    ['Hon. Joross M. Dela Cruz', 'Ex-Officio Member',   'SKFP President',                   0, 1, 10],
  ];
  members.forEach(m => insertMember.run(...m));

  // ── Documents ─────────────────────────────────────────────────────────────
  const insertDoc = db.prepare(`
    INSERT OR IGNORE INTO documents
      (doc_number, doc_type, title, summary, sector, status, date_approved)
    VALUES (?, ?, ?, ?, ?, 'approved', ?)
  `);
  const docs = [
    ['2025-07','ordinance','An Ordinance Establishing the Claveria Solid Waste Management Program',
     'Mandates segregation of biodegradable, non-biodegradable, and special waste at source. Establishes collection schedules and imposes sanctions for non-compliance.',
     'Environment','2025-02-26'],
    ['2025-06','ordinance','An Ordinance Regulating the Operation of Tricycles for Hire in Claveria',
     'Sets routes, fares, and franchise requirements for tricycles-for-hire. Requires annual renewal.',
     'Transport','2025-02-12'],
    ['2025-18','resolution','Resolution Approving Scholarship Grants for Qualified Claveria Youth',
     'Approves 25 scholarship grants covering tuition and monthly stipends from Municipal Development Fund.',
     'Education','2025-01-29'],
    ['2025-05','ordinance','An Ordinance Protecting Women and Children from Domestic Abuse',
     'Strengthens RA 9262 at local level. Creates Barangay VAW desk and mandates reporting protocols.',
     'Social','2025-01-15'],
    ['2025-04','ordinance','An Ordinance on the Protection of Coastal and Marine Resources',
     'Designates protected fishing zones, limits commercial fishing within 15km of coastline.',
     'Fisheries','2025-01-08'],
    ['2025-15','resolution','Resolution Authorizing MARINA Registration Assistance for Motorboat Operators',
     'Authorizes SB to support motorboat operators MARINA registration through streamlined process.',
     'Fisheries','2025-01-05'],
    ['2024-18','ordinance','Anti-Smoking Ordinance in Public Places',
     'Prohibits smoking in government offices, schools, health centers, markets, and transport terminals.',
     'Health','2024-11-20'],
    ['2024-15','ordinance','Anti-Drugs Awareness Ordinance',
     'Mandates anti-drug education in schools and community youth programs. Partners with PDEA.',
     'Social','2024-08-14'],
    ['2024-12','ordinance','No-Contact Apprehension Traffic Ordinance',
     'Establishes camera-based traffic violation documentation system in Claveria town center.',
     'Transport','2024-07-02'],
    ['2024-06','ordinance','Traffic Management Ordinance',
     'Designates one-way streets and parking zones in the town center to improve traffic flow.',
     'Transport','2024-04-17'],
  ];
  docs.forEach(d => insertDoc.run(...d));

  // ── Proposals ─────────────────────────────────────────────────────────────
  const insertProposal = db.prepare(`
    INSERT OR IGNORE INTO proposals
      (ref_number, submitter_name, submitter_type, contact_number, proposal_type, sector, title, description, status, votes_for, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const proposals = [
    ['CLP-2025-0036','Claveria Youth Environment Network','Sectoral Organization','09171234567',
     'Proposed Ordinance','Environment & Sanitation',
     'An Ordinance Prohibiting Single-Use Plastics in Public Markets and Establishments',
     'Seeks to ban single-use plastic bags, styrofoam containers, and plastic straws in all commercial establishments to reduce marine plastic pollution.',
     'review',47,'2025-03-01 09:00:00'],
    ['CLP-2025-0035','Claveria Municipal Fisherfolk Association','Accredited CSO / NGO','09181234567',
     'Proposed Resolution','Fisheries & Marine',
     'Resolution Requesting BFAR to Conduct Free Fishing Boat Registration Assistance in Claveria',
     'Requests BFAR to conduct outreach assisting fishermen in registering boats and securing licenses at no cost.',
     'endorsed',83,'2025-02-20 09:00:00'],
    ['CLP-2025-0034','Rosario M. Bautista','Individual Citizen','09191234567',
     'Proposed Ordinance','Health & Nutrition',
     'An Ordinance Establishing a Free Community Pharmacy for Senior Citizens and PWDs',
     'Proposes a community pharmacy with generic medicines accessible for free to registered seniors and PWDs.',
     'review',62,'2025-02-14 09:00:00'],
    ['CLP-2025-0033','Barangay Council of Bagong Silang','Barangay Council','09201234567',
     'Proposed Ordinance','Education & Youth',
     'An Ordinance Establishing a Public Internet Learning Hub in Every Barangay of Claveria',
     'Proposes free public internet hubs with computer terminals in all 15 barangays for students and job seekers.',
     'endorsed',95,'2025-02-05 09:00:00'],
    ['CLP-2025-0032','Pedro L. Reyes','Individual Citizen','09211234567',
     'Proposed Resolution','Agriculture & Farming',
     'Resolution Requesting the DA to Provide Subsidized Seeds and Fertilizers to Claveria Farmers',
     'Requests DA to include Claveria farmers in the seed and fertilizer subsidy program for 2025-2026.',
     'pending',29,'2025-01-28 09:00:00'],
    ['CLP-2025-0031','Claveria Business and Traders Association','Business Association','09221234567',
     'Proposed Ordinance','Public Safety',
     'An Ordinance Requiring Installation of Street Lights Along Barangay Roads in Claveria',
     'Mandates solar-powered street lights along barangay roads and pathways to improve nighttime safety.',
     'pending',71,'2025-01-15 09:00:00'],
  ];
  proposals.forEach(p => insertProposal.run(...p));

  // ── Sessions ──────────────────────────────────────────────────────────────
  const insertSession = db.prepare(`
    INSERT OR IGNORE INTO council_sessions (session_type, session_date, start_time, agenda, status)
    VALUES (?, ?, ?, ?, ?)
  `);
  const sessions = [
    ['regular','2025-03-12','09:00','2nd Reading – Solid Waste Ordinance Amendment; Committee Reports on Infrastructure','adjourned'],
    ['special','2025-03-20','14:00','Review of Supplemental Budget No. 1, CY 2025; Public Hearing on Infrastructure Projects','adjourned'],
    ['regular','2025-03-26','09:00','3rd Reading – Youth Scholarship Guidelines; New Business','adjourned'],
    ['regular','2025-04-02','09:00','Regular session – items to be announced','scheduled'],
    ['regular','2025-04-09','09:00','Regular session – items to be announced','scheduled'],
    ['regular','2025-04-16','09:00','Regular session – items to be announced','scheduled'],
    ['regular','2025-04-23','09:00','Regular session – items to be announced','scheduled'],
    ['regular','2025-04-30','09:00','Regular session – items to be announced','scheduled'],
  ];
  sessions.forEach(s => insertSession.run(...s));

  // ── News ──────────────────────────────────────────────────────────────────
  const insertNews = db.prepare(`
    INSERT OR IGNORE INTO news (title, category, excerpt, emoji_icon, is_featured, published, published_at)
    VALUES (?, ?, ?, ?, ?, 1, ?)
  `);
  const newsItems = [
    ['New Office Hours: 7:00 AM – 6:00 PM Starting Today','announcement',
     'In compliance with the Presidential Directive on Compressed Workweek, the SB Office now operates 7:00 AM to 6:00 PM, Monday to Wednesday. Citizens are advised to transact early.',
     '🕖',1,'2025-03-19'],
    ['SB Approves Solid Waste Management Ordinance on 3rd Reading','legislative',
     'The Sangguniang Bayan unanimously approved the new Solid Waste Management Ordinance, mandating source segregation in all 15 barangays.',
     '⚖️',0,'2025-02-28'],
    ['25 Claveria Youth to Receive College Scholarships Under New SB Resolution','education',
     'Resolution No. 2025-18 allocates funds for 25 scholarship grants covering tuition and monthly stipends.',
     '🎓',0,'2025-02-15'],
    ['Tricycle Franchise Renewal Season Opens – Deadline Set for April 30','public_service',
     'The Office of the SB Secretary announces the tricycle franchise renewal period. Deadline: April 30, 2025.',
     '🏍️',0,'2025-02-05'],
  ];
  newsItems.forEach(n => insertNews.run(...n));

  return {
    members: members.length, docs: docs.length,
    proposals: proposals.length, sessions: sessions.length, news: newsItems.length
  };
}

if (require.main === module) {
  const { initDb } = require('./connection');
  initDb().then(() => {
    const counts = seedDatabase();
    console.log('Seeded:', counts);
    process.exit(0);
  }).catch(err => {
    console.error('[seed] Failed:', err.message);
    process.exit(1);
  });
}

module.exports = { seedDatabase };
