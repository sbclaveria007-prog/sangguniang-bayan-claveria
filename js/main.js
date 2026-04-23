/* =================================================================
   Sangguniang Bayan of Claveria, Masbate — Main JavaScript
   ================================================================= */

// ---- CITIZEN DASHBOARD DATA ----
const citizenData = {
  fishers: {
    laws: [
      {title:'Coastal Marine Protection Ord. 2025-04', desc:'Protects fishing zones within 15km of coastline from commercial fishing.', dot:'#22c55e'},
      {title:'MARINA Registration Resolution 2025-15', desc:'SB provides resolution support for boat MARINA registration.', dot:'#3b82f6'},
      {title:'Fisher Safety Ord. 2024-11', desc:'Requires life vests and safety equipment on all motorboats.', dot:'#f59e0b'}
    ],
    pending: [
      {title:'Fish Landing Zone Ord. (Draft 2025)', desc:'Proposed designated fish landing areas for Claveria fishermen.'},
      {title:'Fishing Cooperative Accreditation (pending 3rd reading)', desc:'Would formally recognize fishing cooperatives for SB grants.'}
    ],
    hearings: [
      {title:'Public Hearing: Fishing Zone Boundaries', date:'April 10, 2025', desc:'Open to all fishermen and boat owners.'}
    ]
  },
  youth: {
    laws: [
      {title:'Scholarship Resolution 2025-18', desc:'25 college scholarships with tuition + ₱1,500/month stipend for Claveria youth.', dot:'#7c3aed'},
      {title:'Youth Development Code (Ord. 2023-09)', desc:'Establishes youth programs, SK coordination, and sports facilities policy.', dot:'#22c55e'},
      {title:'Anti-Drugs Awareness Ord. (Ord. 2024-15)', desc:'Mandates anti-drug education in schools and youth programs.', dot:'#f59e0b'}
    ],
    pending: [
      {title:'Tech Skills Training Voucher (in committee)', desc:'Proposed vouchers for TESDA short courses for Claveria youth.'},
      {title:'Youth Employment Preferral Resolution (draft)', desc:'Would give Claveria youth priority in municipal job referrals.'}
    ],
    hearings: [
      {title:'Youth Consultation: Scholarship Program', date:'March 22, 2025', desc:'Youth invited to discuss scholarship criteria and expansion.'}
    ]
  },
  farmers: {
    laws: [
      {title:'Agricultural Support Ordinance (Ord. 2023-07)', desc:'Provides subsidized seeds and fertilizers to registered farmers in Claveria.', dot:'#22c55e'},
      {title:'Farm Road Maintenance Resolution 2024-08', desc:'Directs MPDC to prioritize farm-to-market road maintenance.', dot:'#f59e0b'},
      {title:'Organic Farming Incentives (Ord. 2024-20)', desc:'Tax breaks and certificate for farmers transitioning to organic methods.', dot:'#3b82f6'}
    ],
    pending: [
      {title:'Crop Insurance Assistance (in deliberation)', desc:'Would help coordinate PhilCropInsurance enrollment for farmers.'},
      {title:"Farmers' Market Ordinance (1st reading)", desc:'Establishes a weekly public market specifically for local farmers.'}
    ],
    hearings: [
      {title:"Farmers' Forum on Market Access", date:'April 3, 2025', desc:'Discuss challenges and solutions for market access and pricing.'}
    ]
  },
  business: {
    laws: [
      {title:'Business Permit Streamlining (Ord. 2024-03)', desc:'Reduces business permit requirements and processing time to 3 days.', dot:'#f59e0b'},
      {title:"Public Market Vendors' Rights (Ord. 2023-14)", desc:"Protects vendors' stall rights and regulates market fees.", dot:'#22c55e'},
      {title:'Anti-Colorum Ordinance (Ord. 2024-17)', desc:'Sanctions unregistered businesses operating without permits.', dot:'#dc2626'}
    ],
    pending: [
      {title:'Tourism Enterprise Incentive Ord. (draft)', desc:'Would grant tax incentives to tourism-related businesses in Claveria.'},
      {title:'Hawkers & Ambulant Vendors Regularization (1st reading)', desc:'Proposed designated areas and permits for ambulant vendors.'}
    ],
    hearings: [
      {title:'Business Community Consultation', date:'April 15, 2025', desc:'Open to all registered business owners in Claveria.'}
    ]
  },
  transport: {
    laws: [
      {title:'Tricycle Franchise Ordinance (Ord. 2025-06)', desc:'Governs routes, fares, and franchise requirements for tricycles-for-hire.', dot:'#f59e0b'},
      {title:'Traffic Management Ordinance (Ord. 2024-06)', desc:'Designates one-way streets and parking zones in the town center.', dot:'#3b82f6'},
      {title:'No-Contact Apprehension (Ord. 2024-12)', desc:'Establishes camera-based traffic violation documentation.', dot:'#dc2626'}
    ],
    pending: [
      {title:'E-Trike Incentive Program (in committee)', desc:'Would subsidize acquisition of e-bikes for environmentally-friendly transport.'},
      {title:'Terminal Fee Ordinance Amendment (2nd reading)', desc:'Proposed revision of terminal fees at the municipal transport terminal.'}
    ],
    hearings: [
      {title:'Tricycle Route Expansion Hearing', date:'April 5, 2025', desc:'Open to all tricycle operators and the riding public.'}
    ]
  }
};

function switchTab(sector, btn) {
  document.querySelectorAll('.ctab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderCitizenDash(sector);
}

function renderCitizenDash(sector) {
  const d = citizenData[sector];
  document.getElementById('citizenDash').innerHTML = `
    <div class="cdash-card">
      <div class="cdash-card-header"><h4>⚖️ Laws Affecting You</h4><span class="tag tag-green">${d.laws.length} Active</span></div>
      ${d.laws.map(l => `<div class="cdash-item"><div class="cdash-dot" style="background:${l.dot}"></div><div><div class="cdash-text">${l.title}</div><div class="cdash-date">${l.desc}</div></div></div>`).join('')}
    </div>
    <div class="cdash-card">
      <div class="cdash-card-header"><h4>📋 Pending Proposals</h4><span class="tag tag-orange">${d.pending.length} Pending</span></div>
      ${d.pending.map(p => `<div class="cdash-item"><div class="cdash-dot" style="background:#f59e0b"></div><div><div class="cdash-text">${p.title}</div><div class="cdash-date">${p.desc}</div></div></div>`).join('')}
    </div>
    <div class="cdash-card">
      <div class="cdash-card-header"><h4>🎤 Upcoming Hearings</h4><span class="tag tag-blue">${d.hearings.length} Scheduled</span></div>
      ${d.hearings.map(h => `<div class="cdash-item"><div class="cdash-dot" style="background:#3b82f6"></div><div><div class="cdash-text">${h.title}</div><div class="cdash-date">${h.date} — ${h.desc}</div></div></div>`).join('')}
    </div>
  `;
}
renderCitizenDash('fishers');

// ---- SEARCH ----
const sampleDocs = [
  {num:'Ord. 2025-07', title:'Solid Waste Management Ordinance',      summary:'Mandates household waste segregation in all barangays.',                    sector:'Environment'},
  {num:'Ord. 2025-06', title:'Tricycle Franchise Ordinance',          summary:'Governs tricycle-for-hire franchise requirements and routes.',               sector:'Transport'},
  {num:'Ord. 2025-05', title:'Women & Children Protection Ordinance', summary:'Strengthens RA 9262 implementation at the local level.',                    sector:'Social'},
  {num:'Res. 2025-18', title:'Youth Scholarship Resolution',          summary:'Approves 25 college scholarship grants for Claveria youth.',                 sector:'Education'},
  {num:'Ord. 2025-04', title:'Coastal Marine Resources Protection',   summary:'Protects fishing zones within 15km of Claveria coastline.',                  sector:'Fisheries'},
  {num:'Ord. 2024-18', title:'Anti-Smoking Ordinance',                summary:'Prohibits smoking in public places in Claveria.',                            sector:'Health'},
];

function doSearch() {
  const q = document.getElementById('mainSearch').value.trim().toLowerCase();
  if (!q) return;
  const results = sampleDocs.filter(d =>
    d.title.toLowerCase().includes(q) ||
    d.summary.toLowerCase().includes(q) ||
    d.sector.toLowerCase().includes(q) ||
    d.num.toLowerCase().includes(q)
  );
  showResults(results, q);
}

function quickSearch(term) {
  document.getElementById('mainSearch').value = term;
  doSearch();
}

function showResults(results, q) {
  const el = document.getElementById('searchResults');
  const list = document.getElementById('searchList');
  el.classList.remove('hidden');
  if (!results.length) {
    list.innerHTML = `<p style="color:var(--gray-600);font-size:.88rem;text-align:center;padding:20px;">No results found for "<strong>${q}</strong>". Try different keywords or browse the Digital Bulletin Board.</p>`;
    return;
  }
  list.innerHTML = results.map(r => `
    <div style="background:var(--white);border:1px solid var(--gray-200);border-radius:10px;padding:16px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;">
      <div style="flex:1;">
        <div style="font-size:.75rem;color:var(--gold);font-weight:600;margin-bottom:4px;">${r.num} &nbsp;|&nbsp; ${r.sector}</div>
        <div style="font-weight:700;color:var(--navy);margin-bottom:4px;font-size:.93rem;">${r.title}</div>
        <div style="color:var(--gray-600);font-size:.82rem;">${r.summary}</div>
      </div>
      <div style="display:flex;gap:8px;flex-shrink:0;">
        <button class="btn btn-sm btn-navy" onclick="openModal('docModal')"><i class="fas fa-eye"></i> View</button>
        <button class="btn btn-sm" style="background:var(--gray-100);color:var(--gray-600);border:1px solid var(--gray-200)"><i class="fas fa-download"></i> PDF</button>
      </div>
    </div>
  `).join('');
  el.scrollIntoView({behavior:'smooth', block:'nearest'});
}

document.getElementById('mainSearch').addEventListener('keypress', e => { if (e.key === 'Enter') doSearch(); });

// ---- FILTER LAWS ----
function filterLaws(sector, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.law-card').forEach(card => {
    card.style.display = (sector === 'all' || card.dataset.sector === sector) ? '' : 'none';
  });
}

// ---- MODALS ----
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); });
});

// ---- REQUEST FORMS ----
function submitRequest() {
  const trackNum = 'SB-2025-' + String(Math.floor(Math.random() * 900) + 100).padStart(5, '0');
  alert('✅ Request submitted!\nYour tracking number is: ' + trackNum + '\n\nPlease save this number to track your request status.\nEstimated processing: 2–3 working days.');
}

function submitRequestModal() {
  const num = 'SB-2025-' + String(Math.floor(Math.random() * 900) + 100).padStart(5, '0');
  document.getElementById('generatedTrackNum').textContent = num;
  document.getElementById('reqFormArea').classList.add('hidden');
  document.getElementById('reqSuccessArea').classList.remove('hidden');
}

// ---- TRACK REQUEST ----
function trackRequest() {
  const val = document.getElementById('trackInput').value.trim();
  if (!val) { alert('Please enter a tracking number.'); return; }
  document.getElementById('statusResult').innerHTML = `
    <div class="status-result">
      <div class="status-header">
        <div>
          <div class="status-doc">Certified Copy – Ordinance No. 2025-07</div>
          <div class="status-date">Submitted: March 1, 2025 &nbsp;|&nbsp; Requested by: J. Dela Cruz</div>
        </div>
        <span class="tag tag-green">Active</span>
      </div>
      <div class="status-id">Tracking No.: ${val}</div>
      <div class="status-steps">
        <div class="step"><div class="step-dot done"><i class="fas fa-check"></i></div><div class="step-line"><div class="step-name">Submitted</div><div class="step-desc">Request received – March 1, 2025 at 10:23 AM</div></div></div>
        <div class="step"><div class="step-dot done"><i class="fas fa-check"></i></div><div class="step-line"><div class="step-name">Processing</div><div class="step-desc">Document being prepared by SB Secretary's Office</div></div></div>
        <div class="step"><div class="step-dot active"><i class="fas fa-spinner fa-spin"></i></div><div class="step-line"><div class="step-name" style="color:var(--gold-light)">Ready for Release</div><div class="step-desc">Document ready for pick-up. Bring your valid ID and tracking number.</div></div></div>
        <div class="step"><div class="step-dot pending">4</div><div class="step-line"><div class="step-name" style="color:rgba(255,255,255,.4)">Completed</div><div class="step-desc" style="color:rgba(255,255,255,.3)">Awaiting release</div></div></div>
      </div>
    </div>`;
}

// ---- MOBILE MENU ----
function toggleMenu() {
  document.getElementById('mobileMenu').classList.toggle('open');
}

// ---- BACK TO TOP (FIXED) ----
window.addEventListener('scroll', () => {
  const btn = document.getElementById('backToTop');
  if (window.scrollY > 400) {
    btn.classList.add('show');
  } else {
    btn.classList.remove('show');
  }
});

// ---- COUNTER ANIMATION ----
function animateCounters() {
  document.querySelectorAll('[data-count]').forEach(el => {
    const target = +el.dataset.count;
    let current = 0;
    const step = Math.ceil(target / 60);
    const timer = setInterval(() => {
      current = Math.min(current + step, target);
      el.textContent = current.toLocaleString();
      if (current >= target) clearInterval(timer);
    }, 30);
  });
}
setTimeout(animateCounters, 600);

// ---- PROPOSALS ----
let allProposals = [
  {id:'CLP-2025-0036', type:'Proposed Ordinance',  sector:'Environment & Sanitation', title:'An Ordinance Prohibiting Single-Use Plastics in Public Markets and Establishments', desc:'Seeks to ban single-use plastic bags, styrofoam food containers, and plastic straws in all commercial establishments and public markets in Claveria to reduce marine plastic pollution.', submitter:'Claveria Youth Environment Network', submitterType:'Sectoral Organization', date:'March 1, 2025', status:'review', votes:47},
  {id:'CLP-2025-0035', type:'Proposed Resolution', sector:'Fisheries & Marine',        title:'Resolution Requesting BFAR to Conduct Free Fishing Boat Registration Assistance in Claveria', desc:'Requests the Bureau of Fisheries and Aquatic Resources to conduct an outreach program in Claveria assisting local fishermen in registering their boats and securing fishing licenses at no cost.', submitter:'Claveria Municipal Fisherfolk Association', submitterType:'Accredited CSO / NGO', date:'February 20, 2025', status:'endorsed', votes:83},
  {id:'CLP-2025-0034', type:'Proposed Ordinance',  sector:'Health & Nutrition',        title:'An Ordinance Establishing a Free Community Pharmacy for Senior Citizens and PWDs in Claveria', desc:'Proposes the creation of a community pharmacy stocked with generic medicines accessible for free to senior citizens and persons with disabilities registered in Claveria.', submitter:'Rosario M. Bautista', submitterType:'Individual Citizen', date:'February 14, 2025', status:'review', votes:62},
  {id:'CLP-2025-0033', type:'Proposed Ordinance',  sector:'Education & Youth',         title:'An Ordinance Establishing a Public Internet Learning Hub in Every Barangay of Claveria', desc:'Proposes the establishment of free public internet access hubs with computer terminals in all 15 barangays of Claveria to support students, job seekers, and the general public.', submitter:'Barangay Council of Bagong Silang', submitterType:'Barangay Council', date:'February 5, 2025', status:'endorsed', votes:95},
  {id:'CLP-2025-0032', type:'Proposed Resolution', sector:'Agriculture & Farming',     title:'Resolution Requesting the DA to Provide Subsidized Seeds and Fertilizers to Claveria Farmers', desc:'Requests the Department of Agriculture to include Claveria farmers in the seed and fertilizer subsidy program for 2025-2026, with priority for farmers affected by recent typhoon damage.', submitter:'Pedro L. Reyes', submitterType:'Individual Citizen', date:'January 28, 2025', status:'pending', votes:29},
  {id:'CLP-2025-0031', type:'Proposed Ordinance',  sector:'Public Safety',             title:'An Ordinance Requiring Installation of Street Lights Along Barangay Roads in Claveria', desc:'Mandates the installation of solar-powered street lights along all barangay roads and pathways in Claveria to improve nighttime safety for pedestrians and motorists.', submitter:'Claveria Business and Traders Association', submitterType:'Business Association', date:'January 15, 2025', status:'pending', votes:71},
];
let currentFilter = 'all';

function renderProposals(filter) {
  currentFilter = filter;
  const list = document.getElementById('proposalsList');
  const filtered = filter === 'all' ? allProposals : allProposals.filter(p => p.status === filter);
  if (!filtered.length) {
    list.innerHTML = '<div class="proposals-empty"><i class="fas fa-inbox"></i><p>No proposals in this category yet.</p></div>';
    return;
  }
  const statusLabel = {pending:'Pending Review', review:'Under Review', endorsed:'Endorsed by Committee', declined:'Declined'};
  const statusEmoji = {pending:'⏳', review:'🔍', endorsed:'✅', declined:'❌'};
  list.innerHTML = filtered.map(p => `
    <div class="proposal-card status-${p.status}">
      <div class="pc-header">
        <div class="pc-meta"><span class="pc-type">${p.type}</span><span class="pc-sector">${p.sector}</span></div>
        <span class="pc-status ${p.status}">${statusEmoji[p.status]} ${statusLabel[p.status]}</span>
      </div>
      <div class="pc-title">${p.title}</div>
      <div class="pc-summary">${p.desc}</div>
      <div class="pc-footer">
        <div>
          <div class="pc-submitter"><i class="fas fa-user"></i> ${p.submitter} &nbsp;|&nbsp; ${p.submitterType}</div>
          <div class="pc-date"><i class="fas fa-calendar" style="margin-right:4px;color:var(--gold)"></i>${p.date} &nbsp;|&nbsp; Ref: ${p.id}</div>
        </div>
        <div class="pc-votes">
          <button class="vote-btn" onclick="castVote('${p.id}',1)" title="Support this proposal"><i class="fas fa-thumbs-up"></i> ${p.votes}</button>
          <button class="vote-btn down" onclick="castVote('${p.id}',-1)" title="Oppose this proposal"><i class="fas fa-thumbs-down"></i></button>
        </div>
      </div>
    </div>
  `).join('');
}

function filterProposals(filter, btn) {
  document.querySelectorAll('.ptab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderProposals(filter);
}

function castVote(id, dir) {
  const p = allProposals.find(x => x.id === id);
  if (!p) return;
  p.votes = Math.max(0, p.votes + dir);
  renderProposals(currentFilter);
}

function updateCharCount(el) {
  document.getElementById('charCount').textContent = el.value.length;
}

function submitProposal() {
  const name    = document.getElementById('pf-name').value.trim();
  const stype   = document.getElementById('pf-submitter-type').value;
  const contact = document.getElementById('pf-contact').value.trim();
  const ptype   = document.getElementById('pf-type').value;
  const sector  = document.getElementById('pf-sector').value;
  const title   = document.getElementById('pf-title').value.trim();
  const desc    = document.getElementById('pf-desc').value.trim();
  if (!name || !stype || !contact || !ptype || !sector || !title || !desc) {
    alert('Please fill in all required fields before submitting.');
    return;
  }
  const refNum = 'CLP-2025-' + String(Math.floor(Math.random() * 900) + 37).padStart(4, '0');
  document.getElementById('proposalRefNum').textContent = refNum;
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const now = new Date();
  const dateStr = months[now.getMonth()] + ' ' + now.getDate() + ', ' + now.getFullYear();
  allProposals.unshift({id:refNum, type:ptype, sector, title, desc, submitter:name, submitterType:stype, date:dateStr, status:'pending', votes:0});
  document.getElementById('totalCount').textContent   = allProposals.length;
  document.getElementById('pendingCount').textContent = allProposals.filter(p => p.status === 'pending').length;
  renderProposals(currentFilter);
  document.getElementById('proposalFormBody').classList.add('hidden');
  document.getElementById('proposalSuccessBody').classList.remove('hidden');
}

function resetProposalForm() {
  document.getElementById('proposalFormBody').classList.remove('hidden');
  document.getElementById('proposalSuccessBody').classList.add('hidden');
  ['pf-name','pf-contact','pf-title','pf-desc','pf-docs'].forEach(id => { document.getElementById(id).value = ''; });
  ['pf-submitter-type','pf-type','pf-sector'].forEach(id => { document.getElementById(id).selectedIndex = 0; });
  document.getElementById('charCount').textContent = '0';
}

renderProposals('all');

// ---- SB SCOREBOARD ----
const sbData = {
  2025: [
    {name:'Hon. Dakila Alim-Ante',    initials:'DA', role:'1st Regular Member',                      exofficio:false, authored:7, sponsored:9,  cosponsored:12, spark:[1,2,3,4,5,4,6,5,7,6,8,7]},
    {name:'Hon. Adan F. Sandigan',    initials:'AS', role:'2nd Regular Member',                      exofficio:false, authored:6, sponsored:8,  cosponsored:10, spark:[2,1,3,2,4,5,3,6,5,4,6,8]},
    {name:'Hon. Mark A. Andueza',     initials:'MA', role:'3rd Regular Member',                      exofficio:false, authored:5, sponsored:7,  cosponsored:13, spark:[1,2,2,3,4,3,5,4,6,5,4,7]},
    {name:'Hon. Nonelona Lim',        initials:'NL', role:'4th Regular Member',                      exofficio:false, authored:5, sponsored:6,  cosponsored:9,  spark:[2,2,3,4,3,4,5,3,6,4,5,6]},
    {name:'Hon. Elvin M. Berdin',     initials:'EB', role:'5th Regular Member',                      exofficio:false, authored:4, sponsored:8,  cosponsored:8,  spark:[1,2,3,2,3,4,4,5,3,4,5,6]},
    {name:'Hon. Joven P. Arriesgado', initials:'JA', role:'6th Regular Member',                      exofficio:false, authored:4, sponsored:5,  cosponsored:11, spark:[1,1,2,3,2,4,3,4,5,3,4,5]},
    {name:'Hon. Vicente R. Sabaulan', initials:'VS', role:'7th Regular Member',                      exofficio:false, authored:3, sponsored:6,  cosponsored:7,  spark:[1,2,1,3,2,3,4,3,5,3,4,4]},
    {name:'Hon. Ric C. Rubia',        initials:'RR', role:'8th Regular Member',                      exofficio:false, authored:3, sponsored:5,  cosponsored:8,  spark:[1,1,2,2,3,2,4,3,4,3,3,4]},
    {name:'Hon. Charlie Albao',       initials:'CA', role:'Ex-Officio — Liga ng mga Barangay Pres.', exofficio:true,  authored:2, sponsored:4,  cosponsored:6,  spark:[1,1,1,2,2,3,2,3,4,2,3,3]},
    {name:'Hon. Joross M. Dela Cruz', initials:'JD', role:'Ex-Officio — SKFP President',             exofficio:true,  authored:1, sponsored:3,  cosponsored:5,  spark:[0,1,1,1,2,2,2,3,3,2,2,3]},
  ],
  2024: [
    {name:'Hon. Dakila Alim-Ante',    initials:'DA', role:'1st Regular Member',                      exofficio:false, authored:9,  sponsored:11, cosponsored:15, spark:[2,3,4,5,6,5,7,6,8,7,9,8]},
    {name:'Hon. Adan F. Sandigan',    initials:'AS', role:'2nd Regular Member',                      exofficio:false, authored:7,  sponsored:10, cosponsored:12, spark:[3,2,4,3,5,6,4,7,6,5,7,9]},
    {name:'Hon. Mark A. Andueza',     initials:'MA', role:'3rd Regular Member',                      exofficio:false, authored:6,  sponsored:9,  cosponsored:16, spark:[2,3,3,4,5,4,6,5,7,6,5,8]},
    {name:'Hon. Nonelona Lim',        initials:'NL', role:'4th Regular Member',                      exofficio:false, authored:6,  sponsored:8,  cosponsored:11, spark:[3,3,4,5,4,5,6,4,7,5,6,7]},
    {name:'Hon. Elvin M. Berdin',     initials:'EB', role:'5th Regular Member',                      exofficio:false, authored:5,  sponsored:9,  cosponsored:10, spark:[2,3,4,3,4,5,5,6,4,5,6,7]},
    {name:'Hon. Joven P. Arriesgado', initials:'JA', role:'6th Regular Member',                      exofficio:false, authored:5,  sponsored:7,  cosponsored:14, spark:[2,2,3,4,3,5,4,5,6,4,5,6]},
    {name:'Hon. Vicente R. Sabaulan', initials:'VS', role:'7th Regular Member',                      exofficio:false, authored:4,  sponsored:8,  cosponsored:9,  spark:[2,3,2,4,3,4,5,4,6,4,5,5]},
    {name:'Hon. Ric C. Rubia',        initials:'RR', role:'8th Regular Member',                      exofficio:false, authored:4,  sponsored:6,  cosponsored:10, spark:[2,2,3,3,4,3,5,4,5,4,4,5]},
    {name:'Hon. Charlie Albao',       initials:'CA', role:'Ex-Officio — Liga ng mga Barangay Pres.', exofficio:true,  authored:3,  sponsored:5,  cosponsored:8,  spark:[1,2,2,3,3,4,3,4,5,3,4,4]},
    {name:'Hon. Joross M. Dela Cruz', initials:'JD', role:'Ex-Officio — SKFP President',             exofficio:true,  authored:2,  sponsored:4,  cosponsored:6,  spark:[1,1,2,2,3,3,3,4,4,3,3,4]},
  ]
};

// Build "all years" by summing
sbData['all'] = sbData[2025].map((m, i) => {
  const m24 = sbData[2024][i];
  return {...m, authored: m.authored + m24.authored, sponsored: m.sponsored + m24.sponsored, cosponsored: m.cosponsored + m24.cosponsored};
});

let currentSbYear = '2025';
let currentSbSort = 'total';

function renderScoreboard(year, sort, btn) {
  currentSbYear = String(year);
  currentSbSort = sort || currentSbSort;

  if (btn) {
    document.querySelectorAll('.sb-sort-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }

  const allData = (sbData[currentSbYear] || sbData['2025']).map(m => ({
    ...m, total: m.authored + m.sponsored + m.cosponsored
  }));

  const regular   = allData.filter(m => !m.exofficio);
  const exofficio = allData.filter(m =>  m.exofficio);

  const sortFn = currentSbSort === 'authored'  ? (a, b) => b.authored  - a.authored
               : currentSbSort === 'sponsored' ? (a, b) => b.sponsored - a.sponsored
               :                                 (a, b) => b.total     - a.total;

  regular.sort(sortFn);
  exofficio.sort(sortFn);

  // Trophy row (regular members only)
  const topTotal    = [...regular].sort((a, b) => b.total    - a.total)[0];
  const topAuthored = [...regular].sort((a, b) => b.authored - a.authored)[0];
  const topSponsored= [...regular].sort((a, b) => b.sponsored- a.sponsored)[0];

  document.getElementById('sbTrophyRow').innerHTML = `
    <div class="sb-trophy-card">
      <div class="sb-trophy-icon" style="background:linear-gradient(135deg,var(--gold),var(--gold-light));"><i class="fas fa-crown" style="color:var(--navy);"></i></div>
      <div><div class="sb-trophy-label">Most Productive</div><div class="sb-trophy-name">${topTotal.name}</div><div class="sb-trophy-count">${topTotal.total} total measures</div></div>
    </div>
    <div class="sb-trophy-card">
      <div class="sb-trophy-icon" style="background:linear-gradient(135deg,var(--navy),var(--blue-mid));"><i class="fas fa-pen-nib" style="color:white;"></i></div>
      <div><div class="sb-trophy-label">Top Author</div><div class="sb-trophy-name">${topAuthored.name}</div><div class="sb-trophy-count">${topAuthored.authored} measures authored</div></div>
    </div>
    <div class="sb-trophy-card">
      <div class="sb-trophy-icon" style="background:linear-gradient(135deg,var(--teal),#14b8a6);"><i class="fas fa-handshake" style="color:white;"></i></div>
      <div><div class="sb-trophy-label">Top Sponsor</div><div class="sb-trophy-name">${topSponsored.name}</div><div class="sb-trophy-count">${topSponsored.sponsored} measures sponsored</div></div>
    </div>
  `;

  function buildRows(dataset) {
    const maxA = Math.max(...dataset.map(d => d.authored),    1);
    const maxS = Math.max(...dataset.map(d => d.sponsored),   1);
    const maxC = Math.max(...dataset.map(d => d.cosponsored), 1);
    return dataset.map((m, i) => {
      const pA = Math.round((m.authored    / maxA) * 100);
      const pS = Math.round((m.sponsored   / maxS) * 100);
      const pC = Math.round((m.cosponsored / maxC) * 100);
      const sparkMax  = Math.max(...(m.spark || [1]));
      const sparkBars = (m.spark || []).map(v =>
        `<div class="sb-spark-bar${v === sparkMax ? ' peak' : ''}" style="height:${Math.max(3, Math.round((v / sparkMax) * 24))}px;"></div>`
      ).join('');
      const rankClass   = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : '';
      const badgeClass  = i === 0 ? 'rank-gold' : i === 1 ? 'rank-silver' : i === 2 ? 'rank-bronze' : 'rank-plain';
      const badgeContent = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
      return `
        <tr class="sb-row ${rankClass}">
          <td class="sb-rank"><span class="rank-badge ${badgeClass}">${badgeContent}</span></td>
          <td>
            <div class="sb-member-cell">
              <div class="sb-avatar">${m.initials}</div>
              <div class="sb-member-info">
                <div class="sb-member-name">${m.name}</div>
                <div class="sb-member-role">${m.role}</div>
              </div>
            </div>
          </td>
          <td class="sb-cell">
            <div class="sb-num authored">${m.authored}</div>
            <div class="sb-sparkline" style="margin-top:4px;">${sparkBars}</div>
          </td>
          <td class="sb-cell"><span class="sb-num sponsored">${m.sponsored}</span></td>
          <td class="sb-cell hide-mobile"><span class="sb-num cosponsored">${m.cosponsored}</span></td>
          <td class="sb-bar-cell hide-mobile">
            <div class="sb-mini-bars">
              <div class="sb-mini-bar-row">
                <div class="sb-mini-bar-label" style="color:var(--navy);font-weight:700;">A</div>
                <div class="sb-mini-bar-track"><div class="sb-mini-bar-fill" style="width:${pA}%;background:var(--navy);"></div></div>
              </div>
              <div class="sb-mini-bar-row">
                <div class="sb-mini-bar-label" style="color:var(--blue-mid);font-weight:700;">S</div>
                <div class="sb-mini-bar-track"><div class="sb-mini-bar-fill" style="width:${pS}%;backg                <div class="sb-mini-bar-track"><div class="sb-mini-bar-fill" style="width:${pS}%;background:var(--blue-mid);"></div></div>
              </div>
              <div class="sb-mini-bar-row">
                <div class="sb-mini-bar-label" style="color:var(--teal);font-weight:700;">C</div>
                <div class="sb-mini-bar-track"><div class="sb-mini-bar-fill" style="width:${pC}%;background:var(--teal);"></div></div>
              </div>
            </div>
          </td>
          <td class="sb-total-cell"><span class="sb-num total">${m.total}</span></td>
        </tr>`;
    }).join('');
  }

  document.getElementById('sbTableBody').innerHTML      = buildRows(regular);
  document.getElementById('sbExOffTableBody').innerHTML = buildRows(exofficio);
}

renderScoreboard('2025', 'total');

// ---- HERO BUILDING IMAGE FADE-IN ----
// The hero background image is declared in css/styles.css.
// This block handles the smooth fade-in on page load.
(function() {
  const heroEl = document.getElementById('heroBgImg');
  if (!heroEl) return;
  heroEl.style.opacity = '0';
  heroEl.style.transition = 'opacity 1.6s ease';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    heroEl.style.opacity = '0.65';
  }));
})();