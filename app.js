/* ═══════════════════════════════════════════════════════
   STUDYVAULT — app.js
═══════════════════════════════════════════════════════ */

'use strict';

import { supabase, getCurrentUser, isAdmin, signOut, ADMIN_EMAIL } from './supabase.js';

/* ─── GLOBALS ────────────────────────────────────────── */
let currentPage = 'home';
let currentUser  = null;
let userProfile = null;
let adminMode    = false;
let activeExamTimer = null;

const SUBJECTS = {
  dsa: 'DSA', cn: 'Comp Networks', coa: 'COA', vm: 'Vedic Math', os: 'Operating Sys', se: 'Software Engg',
  ap: 'Applied Physics', m1: 'Math 1', m2: 'Math 2', evs: 'EVS', other: 'Other'
};

/* ─── UTILITIES ──────────────────────────────────────── */
const qs  = (sel, ctx = document) => ctx.querySelector(sel);
const qsa = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
const fmt = d => new Date(d).toLocaleDateString('en-IN', { year:'numeric', month:'short', day:'numeric' });
const escHtml = str => str ? str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : '';
const capitalize = s => s ? s[0].toUpperCase() + s.slice(1) : s;

/* ═══════════════════════════════════════════════════════
   AUTH
═══════════════════════════════════════════════════════ */
async function initAuth() {
  currentUser = await getCurrentUser();
  if (!currentUser) { window.location.href = 'login.html'; return; }
  adminMode = currentUser.email === ADMIN_EMAIL;
  
  if (adminMode) {
    checkAdminNotifications();
    setInterval(checkAdminNotifications, 15000); // Poll every 15 seconds
  }

  const uname = qs('#user-name-text');
  const uav   = qs('#user-avatar-char');
  const homeName = qs('#home-id-name');
  const homeAv = qs('#home-id-avatar');
  const homeSig = qs('#home-id-signature');
  const homeSigPh = qs('#home-id-signature-ph');
  
  // Load profile from Supabase
  let { data: profile } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
  
  // Generate & Save Unique Student ID if missing
  if (!profile || !profile.student_id) {
    const year = new Date().getFullYear().toString().slice(-2);
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const letters = chars[Math.floor(Math.random()*26)] + chars[Math.floor(Math.random()*26)] + chars[Math.floor(Math.random()*26)];
    const nums = Math.floor(1000 + Math.random() * 9000);
    const newId = `${year}${letters}${nums}`; // e.g. 26KPB2431
    
    await supabase.from('profiles').upsert({ ...(profile || {}), id: currentUser.id, student_id: newId, subscription_tier: 'free' });
    profile = { ...(profile || {}), student_id: newId, subscription_tier: 'free' };
  }
  
  userProfile = profile;
  
  const idFooter = qs('#home-id-number');
  if (idFooter) idFooter.textContent = 'ID: ' + profile.student_id;
  
  const tierDisplay = qs('#home-detail-tier');
  if (tierDisplay) {
    let tierText = "Free Access";
    if (userProfile.subscription_tier === 'lite') tierText = "Lite Version";
    if (userProfile.subscription_tier === 'pro') tierText = "VIP Pro Version";
    tierDisplay.textContent = tierText;
  }
  
  // Premium Page Buttons Logic
  const btnLite = qs('#sub-btn-lite');
  const btnPro = qs('#sub-btn-pro');
  if (btnLite && btnPro) {
    if (userProfile.subscription_tier === 'pro') {
      btnLite.textContent = "Current Plan";
      btnLite.disabled = true;
      btnLite.style.opacity = '0.5';
      btnLite.style.cursor = 'not-allowed';
      
      btnPro.textContent = "Current Plan";
      btnPro.disabled = true;
      btnPro.style.opacity = '0.5';
      btnPro.style.cursor = 'not-allowed';
    } else if (userProfile.subscription_tier === 'lite') {
      btnLite.textContent = "Current Plan";
      btnLite.disabled = true;
      btnLite.style.opacity = '0.5';
      btnLite.style.cursor = 'not-allowed';
      
      btnPro.textContent = "Upgrade to Pro (Rs 119)";
    }
  }
  
  // Settings Membership Logic
  const setPlan = qs('#settings-current-plan');
  const setExpiry = qs('#settings-plan-expiry');
  const cancelBox = qs('#cancel-sub-box');
  const refAmt = qs('#refund-amount');
  const refStatusBox = qs('#refund-status-box');
  const refUtrDisplay = qs('#refund-utr-display');
  
  if (setPlan) {
    if (userProfile.subscription_tier === 'pro') {
      setPlan.textContent = "VIP Pro Version";
      setExpiry.textContent = `Valid until ${fmt(userProfile.subscription_expiry)}`;
      cancelBox.classList.remove('hidden');
      refAmt.textContent = "Rs 179";
    } else if (userProfile.subscription_tier === 'lite') {
      setPlan.textContent = "Lite Version";
      setExpiry.textContent = `Valid until ${fmt(userProfile.subscription_expiry)}`;
      cancelBox.classList.remove('hidden');
      refAmt.textContent = "Rs 89";
    } else {
      setPlan.textContent = "Free Access";
      setExpiry.textContent = "Never expires";
      cancelBox.classList.add('hidden');
    }

    // Check for processed refunds
    const { data: refunds } = await supabase.from('pending_payments')
      .select('admin_utr, created_at')
      .eq('user_id', currentUser.id)
      .eq('status', 'approved')
      .like('tier', 'cancel_%')
      .order('created_at', { ascending: false })
      .limit(1);

    if (refunds && refunds.length > 0 && refunds[0].admin_utr) {
      refStatusBox.classList.remove('hidden');
      refUtrDisplay.textContent = refunds[0].admin_utr;
    } else {
      refStatusBox.classList.add('hidden');
    }
  }
  
  const displayName = profile?.display_name || currentUser.email.split('@')[0];
  if (uname) uname.textContent = adminMode ? 'Admin' : displayName;
  if (homeName) homeName.textContent = adminMode ? 'Admin' : displayName;
  
  const heroName = qs('#hero-name');
  if (heroName) heroName.textContent = adminMode ? 'Admin' : displayName;
  
  const detailEmail = qs('#home-detail-email');
  if (detailEmail) detailEmail.textContent = currentUser.email;
  
  const applyAvatar = (el) => {
    if (!el) return;
    if (profile?.avatar_url) {
      el.textContent = '';
      el.style.backgroundImage = `url('${profile.avatar_url}')`;
      el.style.backgroundSize = 'cover';
      el.style.backgroundPosition = 'center';
    } else {
      el.textContent = adminMode ? 'A' : (currentUser.email[0].toUpperCase());
      el.style.backgroundImage = 'none';
    }
  };
  
  applyAvatar(uav);
  applyAvatar(homeAv);
  
  if (homeSig && homeSigPh) {
    if (profile?.signature_url) {
      homeSig.src = profile.signature_url;
      homeSig.classList.remove('hidden');
      homeSigPh.classList.add('hidden');
    } else {
      homeSig.classList.add('hidden');
      homeSigPh.classList.remove('hidden');
    }
  }

  if (adminMode) {
    qsa('.admin-only').forEach(el => {
      if (el.classList.contains('admin-fab') || el.id === 'admin-notif-bell') {
        el.style.display = 'flex';
      } else {
        el.style.display = 'block';
      }
    });
  }

  const soBtn = qs('#sign-out-btn');
  if (soBtn) soBtn.addEventListener('click', async () => { await signOut(); window.location.href = 'login.html'; });
}

/* ═══════════════════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════════════════ */
function navigateTo(pageId) {
  if (pageId === currentPage) return;
  const prev = qs(`#${currentPage}`);
  if (prev) prev.classList.remove('active');
  qsa('.nav-link').forEach(l => l.classList.remove('active'));

  const next = qs(`#${pageId}`);
  if (next) { next.classList.add('active'); window.scrollTo({ top:0, behavior:'smooth' }); }

  const link = qs(`[data-page="${pageId}"].nav-link`);
  if (link) {
    link.classList.add('active');
    updateLiquidNav(link);
  }
  currentPage = pageId;

  setTimeout(() => {
    initRevealObserver();
    if (pageId === 'home') loadHomeDashboard();
    if (pageId === 'notes') loadNotes();
    if (pageId === 'exams') loadExams();
    if (pageId === 'notices') loadNotices();
    if (pageId === 'settings') loadSettings();
  }, 50);
}
window.navigateTo = navigateTo; 

function updateLiquidNav(linkEl) {
  const bg = qs('#nav-liquid-bg');
  if (!bg || !linkEl) return;
  bg.style.opacity = '1';
  bg.style.width = linkEl.offsetWidth + 'px';
  bg.style.left = linkEl.offsetLeft + 'px';
}

function initNavLinks() {
  const container = qs('#nav-links-container');
  qsa('.nav-link').forEach(link => {
    link.addEventListener('click', e => { e.preventDefault(); const p = link.dataset.page; if (p) navigateTo(p); });
    link.addEventListener('mouseenter', e => { updateLiquidNav(link); });
  });
  
  if (container) {
    container.addEventListener('mouseleave', () => {
      const active = qs('.nav-link.active');
      if (active) updateLiquidNav(active);
    });
  }

  const logo = qs('#nav-logo-link');
  if (logo) logo.addEventListener('click', e => { e.preventDefault(); navigateTo('home'); });
  
  setTimeout(() => {
    const active = qs('.nav-link.active');
    if (active) updateLiquidNav(active);
  }, 150);
}

/* ═══════════════════════════════════════════════════════
   SCROLL REVEAL
═══════════════════════════════════════════════════════ */
function initRevealObserver() {
  const items = qsa('.reveal-up:not(.visible)');
  if (!items.length) return;
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
  }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });
  items.forEach(el => obs.observe(el));
}
function triggerReveal(containerSel) {
  qsa(`${containerSel} .reveal-up`).forEach((el, i) => setTimeout(() => el.classList.add('visible'), i * 80 + 80));
}

/* ═══════════════════════════════════════════════════════
   HOME DASHBOARD
═══════════════════════════════════════════════════════ */
async function loadHomeDashboard() {
  loadHomeAlerts();
  
  // Latest Exam
  const { data: exams } = await supabase.from('exams').select('*').gt('exam_date', new Date().toISOString()).order('exam_date', { ascending: true }).limit(1);
  const examEl = qs('#dash-exam-content');
  if (examEl) {
    examEl.innerHTML = `<div class="shimmer" style="height: 18px; width: 70%; margin-bottom: 8px;"></div>
                        <div class="shimmer" style="height: 14px; width: 40%;"></div>`;
    if (exams && exams.length > 0) {
      const ex = exams[0];
      const d = new Date(ex.exam_date);
      examEl.innerHTML = `<div style="font-weight:800; font-size:1.1rem; color:var(--text-1); margin-bottom:4px;">${escHtml(ex.title)}</div>
                          <div style="color:var(--text-2); margin-bottom:8px;">${d.toLocaleDateString()} at ${d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                          <div class="dash-item-link" onclick="navigateTo('exams')">Go to Exams →</div>`;
    } else {
      examEl.innerHTML = 'No upcoming exams scheduled.';
    }
  }
  
  // Latest Notice
  const { data: notices } = await supabase.from('notices').select('*').order('created_at', { ascending: false }).limit(1);
  const noticeEl = qs('#dash-notice-content');
  if (noticeEl) {
    noticeEl.innerHTML = `<div class="shimmer" style="height: 18px; width: 80%; margin-bottom: 8px;"></div>
                          <div class="shimmer" style="height: 14px; width: 90%;"></div>`;
    if (notices && notices.length > 0) {
      const nt = notices[0];
      noticeEl.innerHTML = `<div style="font-weight:800; font-size:1.1rem; color:var(--text-1); margin-bottom:4px;">${escHtml(nt.title)}</div>
                            <div style="color:var(--text-2); margin-bottom:8px;">${escHtml(nt.body).substring(0,60)}...</div>
                            <div class="dash-item-link" onclick="navigateTo('notices')">Read Notice →</div>`;
    } else {
      noticeEl.innerHTML = 'No recent notices.';
    }
  }
}

/* ═══════════════════════════════════════════════════════
   HOME ALERTS (5-day warning)
═══════════════════════════════════════════════════════ */
async function loadHomeAlerts() {
  const c = qs('#home-alerts');
  if (!c) return;
  
  const now = new Date();
  const next5Days = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
  
  const { data, error } = await supabase
    .from('exams')
    .select('id, title, exam_date')
    .gte('exam_date', now.toISOString())
    .lte('exam_date', next5Days.toISOString())
    .order('exam_date', { ascending: true });

  if (error || !data?.length) { c.innerHTML = ''; return; }

  c.innerHTML = data.map(ex => `
    <div class="exam-alert-box reveal-up delay-1">
      <div class="exam-alert-icon">!</div>
      <div>
        <div class="exam-alert-title">Upcoming Exam: ${escHtml(ex.title)}</div>
        <div class="exam-alert-time">${new Date(ex.exam_date).toLocaleString()}</div>
      </div>
    </div>
  `).join('');
  initRevealObserver();
}

/* ═══════════════════════════════════════════════════════
   NOTES
═══════════════════════════════════════════════════════ */
async function loadNotes() {
  const grid = qs('#notes-grid');
  if (!grid) return;
  
  grid.innerHTML = Array(3).fill(`<div class="note-card shimmer" style="height: 120px;"></div>`).join('');

  const { data, error } = await supabase.from('notes').select('*').order('created_at', { ascending: false });

  if (error) { grid.innerHTML = `<div class="error-state">Error: ${error.message}</div>`; return; }
  if (!data?.length) { grid.innerHTML = '<div class="empty-state">No notes found.</div>'; return; }

  grid.innerHTML = data.map((note, i) => `
    <div class="note-card reveal-up ${i % 3 === 1 ? 'delay-1' : i % 3 === 2 ? 'delay-2' : ''}" data-subject="${note.subject}">
      <div class="note-icon-wrap">PDF</div>
      <div class="note-content">
        <span class="note-subject-tag">${SUBJECTS[note.subject] || 'Other'}</span>
        <h3 class="note-title">${escHtml(note.title)}</h3>
        <p class="note-desc">${escHtml(note.description)}</p>
        <div class="note-footer">
          ${note.file_url ? `<button class="note-btn" onclick="openFileViewer('${note.file_url}', '${escHtml(note.title).replace(/'/g, "\\'")}')">View PDF</button>` : ''}
          ${adminMode ? `<button class="note-btn admin-del-btn" onclick="deleteNote('${note.id}')">Delete</button>` : ''}
        </div>
      </div>
    </div>
  `).join('');

  initFilters('.filter-tab', '.note-card', 'subject');
  initRevealObserver();
}

/* ═══════════════════════════════════════════════════════
   EXAMS & TIMERS
═══════════════════════════════════════════════════════ */
async function loadExams() {
  const grid = qs('#exam-grid');
  if (!grid) return;
  
  grid.innerHTML = Array(3).fill(`<div class="exam-card shimmer" style="height: 200px;"></div>`).join('');

  const { data, error } = await supabase.from('exams').select('*').order('created_at', { ascending: false });

  if (error) { grid.innerHTML = `<div class="error-state">Error: ${error.message}</div>`; return; }
  if (!data?.length) { grid.innerHTML = '<div class="empty-state">No exams found.</div>'; return; }

  grid.innerHTML = data.map((ex, i) => {
    let statusText = '';
    let isAvailable = true;
    
    if (ex.exam_date) {
      const ed = new Date(ex.exam_date);
      if (ed > new Date()) { statusText = `Scheduled: ${ed.toLocaleString()}`; isAvailable = false; }
    }

    return `
    <div class="exam-card reveal-up" data-cat="${ex.category}">
      <div class="exam-card-header">
        <span class="exam-badge">${ex.category}</span>
        <span class="exam-difficulty">${SUBJECTS[ex.subject] || 'Other'}</span>
      </div>
      <h3 class="exam-title">${escHtml(ex.title)}</h3>
      <p class="exam-desc">${escHtml(ex.description)}</p>
      <div class="exam-info-row">
        ${ex.duration_minutes ? `<span class="exam-info-item">⏱ ${ex.duration_minutes} min</span>` : ''}
        ${statusText ? `<span class="exam-info-item">📅 ${statusText}</span>` : ''}
      </div>
      <div class="exam-actions">
        ${isAvailable && ex.file_url 
          ? `<button class="btn-exam-start" onclick="startExam('${ex.id}', '${ex.file_url}', ${ex.duration_minutes}, '${ex.title.replace(/'/g, "\\'")}', '${ex.subject}')">Start Exam</button>`
          : `<button class="btn-exam-start disabled" disabled>${isAvailable ? 'No File' : 'Locked'}</button>`
        }
        ${ex.file_url ? `<button class="btn-exam-start" style="background:var(--text-2);" onclick="openFileViewer('${ex.file_url}', '${escHtml(ex.title).replace(/'/g, "\\'")}')">Preview</button>` : ''}
        ${adminMode ? `<button class="btn-exam-start admin-del-btn" onclick="deleteExam('${ex.id}')">Delete</button>` : ''}
      </div>
    </div>
  `}).join('');

  initFilters('.exam-cat-btn', '.exam-card', 'cat');
  initRevealObserver();
}

/* ── NOTICES ─────────────────────────────────────────── */
async function loadNotices() {
  const list = qs('#notices-list');
  if (!list) return;
  list.innerHTML = Array(3).fill(`<div class="note-card shimmer" style="height: 120px; margin-bottom: 16px;"></div>`).join('');

  const { data, error } = await supabase.from('notices').select('*').order('created_at', { ascending: false });

  if (error) { list.innerHTML = `<div class="error-state">Failed to load notices: ${error.message}</div>`; return; }
  if (!data?.length) { list.innerHTML = '<div class="empty-state">No notices yet.</div>'; return; }

  list.innerHTML = data.map((n, i) => {
    const links = Array.isArray(n.links) ? n.links : [];
    
    let fileHtml = '';
    if (n.file_url) {
      fileHtml = `<button class="note-btn" style="background: var(--accent); color: white; border: none; margin-right: 8px;" onclick="openFileViewer('${n.file_url}', '${escHtml(n.title)}', 'free')">📄 Open Attachment</button>`;
    }
    
    return `
    <div class="note-card reveal-up ${i % 3 === 1 ? 'delay-1' : ''}" data-cat="${n.type}" style="margin-bottom: 16px;">
      <div class="note-icon-wrap" style="font-size: 1rem; font-weight: bold;">${n.type === 'important' ? '!' : n.type === 'deadlines' ? 'T' : 'i'}</div>
      <div class="note-content">
        <span class="note-subject-tag">${capitalize(n.type)}</span>
        <h3 class="note-title">${escHtml(n.title)}</h3>
        <p class="note-desc">${escHtml(n.body)}</p>
        <div class="note-footer">
          <div style="display:flex; align-items:center;">
            ${fileHtml}
            ${links.length ? links.map(lk => `<a href="${escHtml(lk.url)}" target="_blank" class="note-btn" style="margin-right: 8px;">${escHtml(lk.label)}</a>`).join('') : ''}
          </div>
          ${adminMode ? `<button class="note-btn admin-del-btn" onclick="deleteNotice('${n.id}')">Delete</button>` : ''}
        </div>
      </div>
    </div>
  `}).join('');

  initFilters('#notices .filter-tab', '#notices-list .note-card', 'cat');
  initRevealObserver();
}

/* ── FILE VIEWER ─────────────────────────────────────── */
window.openFileViewer = function(url, title, requiredTier = 'lite') {
  if (!checkPremiumAccess(requiredTier)) return;
  
  const overlay = qs('#file-viewer-overlay');
  const frame = qs('#file-viewer-frame');
  const titleEl = qs('#file-viewer-title');
  if (!overlay || !frame) return;
  
  titleEl.textContent = title || 'Document Preview';
  frame.src = url;
  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
};

window.closeFileViewer = function() {
  const overlay = qs('#file-viewer-overlay');
  if (overlay) overlay.classList.add('hidden');
  document.body.style.overflow = '';
  qs('#file-viewer-frame').src = '';
};

/* ── SETTINGS PAGE ───────────────────────────────────── */
window.switchSettingsTab = function(tab) {
  qsa('.settings-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  qsa('.settings-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === tab));
};

window.toggleTheme = function() {
  const isDark = qs('#theme-toggle').checked;
  if (isDark) {
    document.documentElement.style.setProperty('--bg', '#111');
    document.documentElement.style.setProperty('--bg-2', '#1a1a1a');
    document.documentElement.style.setProperty('--text-1', '#fff');
    document.documentElement.style.setProperty('--text-2', '#aaa');
    document.documentElement.style.setProperty('--border', '#333');
  } else {
    document.documentElement.style.setProperty('--bg', '#FAFAFA');
    document.documentElement.style.setProperty('--bg-2', '#FFFFFF');
    document.documentElement.style.setProperty('--text-1', '#0A0A0A');
    document.documentElement.style.setProperty('--text-2', '#555555');
    document.documentElement.style.setProperty('--border', 'rgba(0,0,0,0.08)');
  }
};

let pendingAvatarFile = null;
let pendingAvatarUrl = null;
let pendingSigFile = null;
let pendingSigUrl = null;

window.updateProfilePic = function(event) {
  const file = event.target.files[0];
  if (file) {
    pendingAvatarFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      pendingAvatarUrl = e.target.result;
      const avatar = qs('#settings-avatar-preview');
      avatar.textContent = '';
      avatar.style.backgroundImage = `url('${pendingAvatarUrl}')`;
      avatar.style.backgroundSize = 'cover';
      avatar.style.backgroundPosition = 'center';
      showToast('Profile picture ready to save.', 'info');
    };
    reader.readAsDataURL(file);
  }
};

window.updateSignaturePic = function(event) {
  const file = event.target.files[0];
  if (file) {
    pendingSigFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      pendingSigUrl = e.target.result;
      const sig = qs('#settings-sig-preview');
      sig.textContent = '';
      sig.style.backgroundImage = `url('${pendingSigUrl}')`;
      showToast('Signature ready to save.', 'info');
    };
    reader.readAsDataURL(file);
  }
};

window.saveProfile = async function() {
  const name = qs('#profile-name').value;
  const navAvatar = qs('#user-avatar-char');
  const homeName = qs('#home-id-name');
  const homeAv = qs('#home-id-avatar');
  const homeSig = qs('#home-id-signature');
  const homeSigPh = qs('#home-id-signature-ph');
  
  const btn = event.target;
  btn.disabled = true; btn.textContent = 'Saving...';
  
  let finalAvatarUrl = null;
  let finalSigUrl = null;
  
  if (pendingAvatarFile) {
    const path = `avatars/${currentUser.id}_${Date.now()}`;
    const { error: uploadError } = await supabase.storage.from('studyvault').upload(path, pendingAvatarFile);
    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage.from('studyvault').getPublicUrl(path);
      finalAvatarUrl = publicUrl;
    }
  }
  
  if (pendingSigFile) {
    const path = `signatures/${currentUser.id}_${Date.now()}`;
    const { error: sigError } = await supabase.storage.from('studyvault').upload(path, pendingSigFile);
    if (!sigError) {
      const { data: { publicUrl } } = supabase.storage.from('studyvault').getPublicUrl(path);
      finalSigUrl = publicUrl;
    }
  }
  
  const profileData = { id: currentUser.id };
  if (name) profileData.display_name = name;
  if (finalAvatarUrl) profileData.avatar_url = finalAvatarUrl;
  if (finalSigUrl) profileData.signature_url = finalSigUrl;
  
  const { error } = await supabase.from('profiles').upsert(profileData);
  
  if (error) {
    showToast('Failed to save profile: ' + error.message, 'error');
  } else {
    if (name) {
      qs('#user-name-text').textContent = name;
      if (homeName) homeName.textContent = name;
    }
    
    if (finalAvatarUrl) {
      navAvatar.textContent = '';
      navAvatar.style.backgroundImage = `url('${finalAvatarUrl}')`;
      if (homeAv) { homeAv.textContent = ''; homeAv.style.backgroundImage = `url('${finalAvatarUrl}')`; }
    }
    
    if (finalSigUrl && homeSig && homeSigPh) {
      homeSig.src = finalSigUrl;
      homeSig.classList.remove('hidden');
      homeSigPh.classList.add('hidden');
    }
    
    showToast('Profile saved perfectly!', 'success');
  }
  
  btn.disabled = false; btn.textContent = 'Save Changes';
};

window.changePassword = async function() {
  const newPassword = prompt('Enter your new password (must be at least 6 characters):');
  if (!newPassword) return;
  if (newPassword.length < 6) {
    showToast('Password must be at least 6 characters!', 'error');
    return;
  }
  
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    showToast('Failed to change password: ' + error.message, 'error');
  } else {
    showToast('Password updated successfully! You can use it next time you log in.', 'success');
  }
};

async function loadSettings() {
  if (currentUser) {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
    
    qs('#profile-name').value = profile?.display_name || currentUser.email.split('@')[0];
    
    const preview = qs('#settings-avatar-preview');
    if (profile?.avatar_url) {
      preview.textContent = '';
      preview.style.backgroundImage = `url('${profile.avatar_url}')`;
      preview.style.backgroundSize = 'cover';
      preview.style.backgroundPosition = 'center';
    } else {
      preview.textContent = currentUser.email[0].toUpperCase();
      preview.style.backgroundImage = 'none';
    }
    
    const sigPreview = qs('#settings-sig-preview');
    if (profile?.signature_url && sigPreview) {
      sigPreview.textContent = '';
      sigPreview.style.backgroundImage = `url('${profile.signature_url}')`;
    }
  }
}

/* ── EXAM ENGINE ─────────────────────────────────────── */
window.startExam = function(id, url, durationMinutes, title, subject) {
  if (!checkPremiumAccess('lite')) return;
  
  const overlay = qs('#exam-overlay');
  const frame = qs('#exam-frame');
  const timerEl = qs('#exam-timer-display');
  
  if (!overlay || !frame) return;

  // Absolute Timer Enforcement
  let timeLeft = 0;
  if (durationMinutes && durationMinutes > 0) {
    const attemptKey = `exam_start_${id}_${currentUser?.id || 'guest'}`;
    let startTime = localStorage.getItem(attemptKey);
    if (!startTime) {
      startTime = Date.now();
      localStorage.setItem(attemptKey, startTime);
    }
    
    const durationMs = durationMinutes * 60 * 1000;
    const elapsed = Date.now() - parseInt(startTime);
    timeLeft = Math.floor((durationMs - elapsed) / 1000);

    if (timeLeft <= 0) {
      frame.dataset.examId = id;
      frame.dataset.examTitle = title;
      frame.dataset.subject = subject;
      submitExam();
      showToast('The time limit for this exam has already expired!', 'error');
      return;
    }
  }
  
  frame.src = url;
  frame.dataset.examId = id;
  frame.dataset.examTitle = title;
  frame.dataset.subject = subject;
  
  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  
  if (activeExamTimer) clearInterval(activeExamTimer);
  
  if (durationMinutes && durationMinutes > 0) {
    timerEl.parentElement.classList.remove('hidden');
    
    // Initial paint
    const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
    const s = (timeLeft % 60).toString().padStart(2, '0');
    timerEl.textContent = `${m}:${s}`;
    
    activeExamTimer = setInterval(() => {
      timeLeft--;
      const mm = Math.floor(Math.max(0, timeLeft) / 60).toString().padStart(2, '0');
      const ss = (Math.max(0, timeLeft) % 60).toString().padStart(2, '0');
      timerEl.textContent = `${mm}:${ss}`;
      
      if (timeLeft <= 0) {
        clearInterval(activeExamTimer);
        submitExam();
        showToast('Time is up! Exam automatically submitted.', 'error');
      }
    }, 1000);
  } else {
    timerEl.parentElement.classList.add('hidden');
  }
};

window.submitExam = async function() {
  const overlay = qs('#exam-overlay');
  if (overlay) overlay.classList.add('hidden');
  document.body.style.overflow = '';
  if (activeExamTimer) clearInterval(activeExamTimer);
  
  const frame = qs('#exam-frame');
  const examId = frame.dataset.examId;
  const examTitle = frame.dataset.examTitle;
  const subject = frame.dataset.subject;
  
  frame.src = '';
  
  if (examId && currentUser) {
    // Save a placeholder "submitted" response. 
    // Since grading a PDF is manual, we just record that they submitted it.
    await supabase.from('exam_scores').insert({
      user_id: currentUser.id,
      exam_id: examId,
      exam_title: examTitle,
      subject: subject,
      score: null,
      max_score: 100
    });
  }
  
  showToast('Exam submitted successfully!', 'success');
};

/* ═══════════════════════════════════════════════════════
   FILTERS
═══════════════════════════════════════════════════════ */
function initFilters(btnSel, cardSel, dataAttr) {
  const btns = qsa(btnSel);
  const cards = qsa(cardSel);
  btns.forEach(b => {
    b.addEventListener('click', () => {
      btns.forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      const val = b.dataset.filter || b.dataset.cat;
      cards.forEach(c => c.classList.toggle('hidden', val !== 'all' && c.dataset[dataAttr] !== val));
    });
  });
}

/* ═══════════════════════════════════════════════════════
   ADMIN PANEL
═══════════════════════════════════════════════════════ */
window.openAdminPanel = function(tab = 'notes') {
  qs('#admin-modal')?.classList.add('open');
  switchAdminTab(tab);
  document.body.style.overflow = 'hidden';
};
window.closeAdminPanel = function() {
  qs('#admin-modal')?.classList.remove('open');
  document.body.style.overflow = '';
};
window.switchAdminTab = function(tab) {
  qsa('.admin-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  qsa('.admin-tab-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === tab));
  if (tab === 'responses') loadExamResponses();
  if (tab === 'approvals') loadPendingPayments();
};

window.loadExamResponses = async function() {
  if (!adminMode) return;
  const list = qs('#admin-responses-list');
  if (!list) return;
  list.innerHTML = 'Loading...';
  
  const { data, error } = await supabase
    .from('exam_scores')
    .select('id, exam_title, subject, attempted_at, user:user_id(email)')
    .order('attempted_at', { ascending: false });
    
  if (error) { list.innerHTML = 'Error loading responses.'; return; }
  if (!data?.length) { list.innerHTML = 'No submissions yet.'; return; }
  
  list.innerHTML = data.map(r => `
    <div style="padding: 12px; border: 1px solid var(--border); border-radius: 8px;">
      <div style="font-weight: 700;">${escHtml(r.exam_title)} (${SUBJECTS[r.subject] || 'Other'})</div>
      <div style="font-size: 0.8rem; color: var(--text-2);">Submitted by: ${escHtml(r.user?.email || 'Unknown')}</div>
      <div style="font-size: 0.8rem; color: var(--text-3);">${new Date(r.attempted_at).toLocaleString()}</div>
    </div>
  `).join('');
};

window.uploadNote = async function() {
  if (!adminMode) return;
  const title = qs('#an-title')?.value;
  const subject = qs('#an-subject')?.value;
  const file = qs('#an-file')?.files[0];
  if (!title || !subject || !file) { showToast('Title, subject, and file required', 'error'); return; }
  
  const btn = qs('#upload-note-btn');
  btn.disabled = true; btn.textContent = 'Uploading...';
  
  const path = `notes/${Date.now()}_${file.name}`;
  const { error: uploadError } = await supabase.storage.from('studyvault').upload(path, file);
  
  if (uploadError) { 
    showToast('Storage upload failed: ' + uploadError.message, 'error'); 
    btn.disabled = false; btn.textContent = 'Upload Note'; 
    return; 
  }
  
  const { data: { publicUrl } } = supabase.storage.from('studyvault').getPublicUrl(path);
  const { error } = await supabase.from('notes').insert({ title, subject, file_url: publicUrl, file_path: path });
  
  btn.disabled = false; btn.textContent = 'Upload Note';
  
  if (error) {
    showToast('Database insert failed: ' + error.message, 'error');
  } else {
    closeAdminPanel(); loadNotes(); showToast('Note added!', 'success');
  }
};

window.uploadExam = async function() {
  if (!adminMode) return;
  const title = qs('#ae-title')?.value;
  const cat = qs('#ae-cat')?.value;
  const subject = qs('#ae-subject')?.value;
  const duration = parseInt(qs('#ae-duration')?.value) || 0;
  const examDate = qs('#ae-date')?.value || null;
  const file = qs('#ae-file')?.files[0];
  if (!title || !file) { showToast('Title and file required', 'error'); return; }
  
  const btn = qs('#upload-exam-btn');
  btn.disabled = true; btn.textContent = 'Uploading...';
  
  const path = `exams/${Date.now()}_${file.name}`;
  const { error: uploadError } = await supabase.storage.from('studyvault').upload(path, file);
  if (uploadError) { showToast('Upload failed: ' + uploadError.message, 'error'); btn.disabled = false; btn.textContent = 'Upload Exam'; return; }
  
  const { data: { publicUrl } } = supabase.storage.from('studyvault').getPublicUrl(path);
  
  const { error } = await supabase.from('exams').insert({ title, category: cat, subject, duration_minutes: duration, exam_date: examDate, file_url: publicUrl, file_path: path });
  
  btn.disabled = false; btn.textContent = 'Upload Exam';
  
  if (error) {
    showToast('Failed to insert: ' + error.message, 'error');
  } else {
    closeAdminPanel(); loadExams(); loadHomeAlerts(); showToast('Exam added!', 'success');
  }
};

window.uploadNotice = async function() {
  if (!adminMode) return;
  const title = qs('#anot-title')?.value;
  const type = qs('#anot-type')?.value;
  const body = qs('#anot-body')?.value;
  const linkUrl = qs('#anot-link')?.value;
  const file = qs('#anot-file')?.files[0];
  
  if (!title || !body) { showToast('Title and body required', 'error'); return; }
  
  const btn = qs('#post-notice-btn');
  btn.disabled = true; btn.textContent = 'Posting...';
  
  let publicUrl = null;
  let fileName = null;

  if (file) {
    const path = `notices/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from('studyvault').upload(path, file);
    if (uploadError) { 
      showToast('Upload failed: ' + uploadError.message, 'error'); 
      btn.disabled = false; btn.textContent = 'Post Notice'; 
      return; 
    }
    publicUrl = supabase.storage.from('studyvault').getPublicUrl(path).data.publicUrl;
    fileName = file.name;
  }
  
  const links = linkUrl ? [{ label: 'View Link', url: linkUrl }] : [];
  const { error } = await supabase.from('notices').insert({ 
    title, type, body, links, file_url: publicUrl, file_name: fileName 
  });
  
  btn.disabled = false; btn.textContent = 'Post Notice';
  
  if (error) {
    showToast('Failed to post: ' + error.message, 'error');
  } else {
    closeAdminPanel(); loadNotices(); showToast('Notice posted!', 'success');
  }
};

window.deleteNote = async (id) => { if (confirm('Delete?')) { await supabase.from('notes').delete().eq('id',id); loadNotes(); } };
window.deleteExam = async (id) => { if (confirm('Delete?')) { await supabase.from('exams').delete().eq('id',id); loadExams(); } };
window.deleteNotice = async (id) => { if (confirm('Delete?')) { await supabase.from('notices').delete().eq('id',id); loadNotices(); } };

window.showToast = function(msg, type='info') {
  const t = document.createElement('div');
  t.className = `sv-toast sv-toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3000);
};

/* ═══════════════════════════════════════════════════════
   PREMIUM AI CHATBOT (DEMO MODE)
═══════════════════════════════════════════════════════ */
window.toggleChat = function() {
  if (!checkPremiumAccess('lite')) return;
  
  const cw = document.getElementById('chat-window');
  if (cw.classList.contains('hidden')) {
    cw.classList.remove('hidden');
    document.getElementById('chat-input').focus();
  } else {
    cw.classList.add('hidden');
  }
};

window.sendChatMessage = async function() {
  const input = document.getElementById('chat-input');
  const msgs = document.getElementById('chat-messages');
  const txt = input.value.trim();
  if (!txt) return;

  // Add User message
  const userMsg = document.createElement('div');
  userMsg.className = 'chat-msg user';
  userMsg.textContent = txt;
  msgs.appendChild(userMsg);
  
  input.value = '';
  msgs.scrollTop = msgs.scrollHeight;

  // Add a temporary "typing..." indicator
  const aiMsg = document.createElement('div');
  aiMsg.className = 'chat-msg ai';
  aiMsg.textContent = "Thinking...";
  msgs.appendChild(aiMsg);
  msgs.scrollTop = msgs.scrollHeight;

  try {
    if (!supabase) throw new Error("Supabase is not connected.");

    // Call the secure Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('chat', {
      body: { query: txt }
    });

    if (error) {
      throw new Error(error.message || "Failed to reach the AI server.");
    }
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    // Display the answer from the Edge Function
    const answer = data.answer || "I'm sorry, I couldn't process that.";
    aiMsg.innerHTML = answer.replace(/\n/g, '<br>');

  } catch (err) {
    console.error("AI Error:", err);
    aiMsg.textContent = "Error: " + err.message;
  }
  
  msgs.scrollTop = msgs.scrollHeight;
};

/* ═══════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  await initAuth();
  initNavLinks();
  
  setTimeout(() => {
    triggerReveal('#home');
    initRevealObserver();
    loadHomeDashboard();
  }, 100);
});

// ─── PREMIUM SUBSCRIPTION & LOCKS ──────────────────────────────
window.checkPremiumAccess = function(requiredTier = 'lite') {
  if (adminMode) return true;
  if (!userProfile) return false;
  
  const tier = userProfile.subscription_tier || 'free';
  if (tier === 'pro') return true; // Pro has access to everything
  if (tier === 'lite' && requiredTier === 'lite') return true;
  
  showToast('🔒 This content requires a ' + requiredTier.toUpperCase() + ' or PRO subscription.', 'error');
  setTimeout(() => navigateTo('premium'), 1500);
  return false;
};

let selectedTier = 'lite';

window.startSubscription = async function(tier) {
  if (adminMode) {
    showToast('Admin accounts automatically have God-Mode. No payment required.', 'success');
    return;
  }
  
  // Check if they already have a pending request
  const { count } = await supabase.from('pending_payments').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id).eq('status', 'pending');
  if (count > 0) {
    showToast('You already have a pending request! Please wait for Admin approval.', 'error');
    return;
  }

  selectedTier = tier;
  const overlay = qs('#payment-overlay');
  
  const upiVPA = '8159813896-4@ybl'; // Replace with real merchant UPI ID
  let amountStr = '99.00';
  
  if (tier === 'pro') {
    amountStr = userProfile?.subscription_tier === 'lite' ? '119.00' : '199.00';
    qs('#payment-amount').textContent = 'Rs ' + Math.floor(parseFloat(amountStr));
    qs('#payment-subtitle').textContent = userProfile?.subscription_tier === 'lite' ? 'Pro Upgrade (from Lite)' : 'VIP Pro Version';
  } else {
    amountStr = '99.00';
    qs('#payment-amount').textContent = 'Rs 99';
    qs('#payment-subtitle').textContent = 'Lite Version';
  }
  
  // Generate real UPI Intent QR Code
  const upiString = `upi://pay?pa=${upiVPA}&pn=StudyVault&am=${amountStr}&cu=INR`;
  qs('#payment-qr').src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiString)}`;
  
  qs('#payment-utr').value = ''; // Clear previous UTR
  overlay.classList.remove('hidden');
};

window.closePaymentModal = function() {
  qs('#payment-overlay').classList.add('hidden');
};

window.processPayment = async function() {
  const utrInput = qs('#payment-utr').value.trim();
  if (!utrInput || utrInput.length < 6) {
    showToast('Please enter a valid UTR / Reference No. from your UPI app.', 'error');
    return;
  }

  const btn = qs('#pay-now-btn');
  btn.textContent = "Verifying Payment...";
  btn.style.opacity = '0.7';
  btn.style.pointerEvents = 'none';
  
  // Simulate network delay for realism
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Submit to Admin Approval
  const { error } = await supabase.from('pending_payments').insert({
    user_id: currentUser.id,
    user_email: currentUser.email,
    tier: selectedTier,
    utr: utrInput,
    status: 'pending'
  });
  
  btn.textContent = "Verify Payment";
  btn.style.opacity = '1';
  btn.style.pointerEvents = 'auto';
  
  if (error) {
    showToast('Error submitting payment: ' + error.message, 'error');
  } else {
    showToast('Payment submitted! Admin will verify your UTR shortly.', 'success');
    closePaymentModal();
  }
};

window.requestCancellation = async function() {
  if (userProfile?.subscription_expiry) {
    const expiry = new Date(userProfile.subscription_expiry).getTime();
    // Start date is approx 30 days before expiry
    const startDate = expiry - (30 * 24 * 60 * 60 * 1000);
    const daysSinceStart = (Date.now() - startDate) / (1000 * 60 * 60 * 24);
    
    if (daysSinceStart > 7) {
      showToast('Cancellations and refunds are only allowed within the first 7 days of subscription.', 'error');
      return;
    }
  }

  const upiId = qs('#refund-upi-id').value.trim();
  if (!upiId || !upiId.includes('@')) {
    showToast('Please enter a valid UPI ID for the refund.', 'error');
    return;
  }

  if (!confirm('Are you sure you want to request a cancellation and refund?')) return;
  
  // Check for existing pending requests
  const { count } = await supabase.from('pending_payments').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id).eq('status', 'pending');
  if (count > 0) {
    showToast('You already have a pending request with the Admin.', 'error');
    return;
  }
  
  const refundAmount = userProfile.subscription_tier === 'pro' ? '179' : '89';
  const { error } = await supabase.from('pending_payments').insert({
    user_id: currentUser.id,
    user_email: currentUser.email,
    tier: 'cancel_' + userProfile.subscription_tier,
    utr: `Refund|${refundAmount}|${upiId}`,
    status: 'pending'
  });
  
  if (error) {
    showToast('Error requesting cancellation: ' + error.message, 'error');
  } else {
    showToast('Cancellation request sent to Admin. You will be refunded shortly.', 'success');
  }
};

window.loadPendingPayments = async function() {
  const list = qs('#admin-approvals-list');
  if (!list) return;
  
  const { data, error } = await supabase.from('pending_payments').select('*').eq('status', 'pending').order('created_at', { ascending: false });
  if (error) {
    list.innerHTML = `<div class="error-state">Error: ${error.message}</div>`;
    return;
  }
  
  if (!data || data.length === 0) {
    list.innerHTML = `<div class="empty-state">No pending payments.</div>`;
    return;
  }
  
  list.innerHTML = data.map(p => {
    let extraHtml = '';
    let displayUtr = p.utr;
    
    if (p.tier.startsWith('cancel_') && p.utr.includes('|')) {
      const parts = p.utr.split('|');
      const amount = parts[1] || '0';
      const upi = parts[2] || '';
      displayUtr = `Refund Rs ${amount} to ${upi}`;
      
      const upiLink = `upi://pay?pa=${upi}&pn=StudyVault+Refund&am=${amount}`;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(upiLink)}`;
      
      extraHtml = `
        <div style="background: #fff; padding: 12px; border-radius: 8px; display: inline-block; margin-bottom: 12px; text-align: center;">
          <img src="${qrUrl}" style="width: 120px; height: 120px;" alt="Refund QR" />
          <div style="font-size: 0.75rem; color: #000; margin-top: 8px; font-weight: bold;">Scan to Refund Rs ${amount}</div>
        </div>
      `;
    }
    
    return `
      <div style="background: var(--bg-2); padding: 16px; border-radius: 8px; border: 1px solid var(--border);">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="font-weight: bold; color: var(--text-1);">${escHtml(p.user_email)}</span>
          <span style="background: var(--accent); color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem;">${p.tier.toUpperCase()}</span>
        </div>
        <div style="font-size: 0.9rem; color: var(--text-2); margin-bottom: 12px;">
          Details: <strong style="color: var(--text-1);">${escHtml(displayUtr)}</strong> <br/>
          Date: ${fmt(p.created_at)}
        </div>
        ${extraHtml}
        <div style="display: flex; gap: 8px;">
          <button class="admin-submit-btn" style="flex: 1; padding: 8px;" onclick="handlePaymentApproval('${p.id}', '${p.user_id}', '${p.tier}', 'approved')">Approve</button>
          <button class="btn-secondary" style="flex: 1; padding: 8px; border-color: red; color: red;" onclick="handlePaymentApproval('${p.id}', '${p.user_id}', '${p.tier}', 'rejected')">Reject</button>
        </div>
      </div>
    `;
  }).join('');
};

window.handlePaymentApproval = async function(paymentId, userId, tier, action) {
  if (!confirm(`Are you sure you want to ${action} this payment?`)) return;
  
  let adminUtr = null;
  if (action === 'approved' && tier.startsWith('cancel_')) {
    adminUtr = prompt("Please enter the UTR / Transaction ID for the refund you just made to the user's UPI ID:");
    if (!adminUtr) {
      showToast('Cancellation approval cancelled. UTR is required.', 'error');
      return;
    }
  }

  // Update status in pending_payments
  const updateData = { status: action };
  if (adminUtr) updateData.admin_utr = adminUtr;
  
  const { error: pErr } = await supabase.from('pending_payments').update(updateData).eq('id', paymentId);
  if (pErr) return showToast('Error updating payment: ' + pErr.message, 'error');
  
  if (action === 'approved') {
    if (tier.startsWith('cancel_')) {
      // Process Cancellation
      const { error: uErr } = await supabase.from('profiles').update({ 
        subscription_tier: 'free',
        subscription_expiry: null
      }).eq('id', userId);
      
      if (uErr) return showToast('Error downgrading user: ' + uErr.message, 'error');
      showToast('Cancellation Approved! Refund initiated and user downgraded.', 'success');
    } else {
      // Calculate expiry (1 month from now)
      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + 1);
      
      // Grant the tier
      const { error: uErr } = await supabase.from('profiles').update({ 
        subscription_tier: tier,
        subscription_expiry: expiryDate.toISOString()
      }).eq('id', userId);
      
      if (uErr) return showToast('Error upgrading user: ' + uErr.message, 'error');
      showToast(`Payment Approved! User upgraded to ${tier}.`, 'success');
    }
  } else {
    showToast('Payment Rejected.', 'success');
  }
  
  loadPendingPayments();
  checkAdminNotifications(); // Update badge
};

window.checkAdminNotifications = async function() {
  if (!adminMode) return;
  const badge = qs('#admin-notif-badge');
  if (!badge) return;
  
  const { count, error } = await supabase.from('pending_payments').select('*', { count: 'exact', head: true }).eq('status', 'pending');
  if (error || count === 0) {
    badge.classList.add('hidden');
  } else {
    badge.textContent = count;
    badge.classList.remove('hidden');
  }
};

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('ServiceWorker registration successful with scope: ', registration.scope);
    }, err => {
      console.log('ServiceWorker registration failed: ', err);
    });
  });
}
