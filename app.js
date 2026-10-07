/* ═══════════════════════════════════════════════════════
   STUDYVAULT — app.js
═══════════════════════════════════════════════════════ */

'use strict';

import { supabase, getCurrentUser, isAdmin, signOut, ADMIN_EMAIL } from './supabase.js';

/* ─── GLOBALS ────────────────────────────────────────── */
let currentPage = 'home';
let currentUser  = null;
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
    
    await supabase.from('profiles').upsert({ ...(profile || {}), id: currentUser.id, student_id: newId });
    profile = { ...(profile || {}), student_id: newId };
  }
  
  const idFooter = qs('#home-id-number');
  if (idFooter) idFooter.textContent = 'ID: ' + profile.student_id;
  
  const displayName = profile?.display_name || currentUser.email.split('@')[0];
  if (uname) uname.textContent = adminMode ? 'Admin' : displayName;
  if (homeName) homeName.textContent = adminMode ? 'Admin' : displayName;
  
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
      if (el.classList.contains('admin-fab')) {
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
    return `
    <div class="note-card reveal-up ${i % 3 === 1 ? 'delay-1' : ''}" data-cat="${n.type}" style="margin-bottom: 16px;">
      <div class="note-icon-wrap" style="font-size: 1rem; font-weight: bold;">${n.type === 'important' ? '!' : n.type === 'deadlines' ? 'T' : 'i'}</div>
      <div class="note-content">
        <span class="note-subject-tag">${capitalize(n.type)}</span>
        <h3 class="note-title">${escHtml(n.title)}</h3>
        <p class="note-desc">${escHtml(n.body)}</p>
        <div class="note-footer">
          ${links.length ? links.map(lk => `<a href="${escHtml(lk.url)}" target="_blank" class="note-btn">${escHtml(lk.label)}</a>`).join('') : '<div></div>'}
          ${adminMode ? `<button class="note-btn admin-del-btn" onclick="deleteNotice('${n.id}')">Delete</button>` : ''}
        </div>
      </div>
    </div>
  `}).join('');

  initFilters('#notices .filter-tab', '#notices-list .note-card', 'cat');
  initRevealObserver();
}

/* ── FILE VIEWER ─────────────────────────────────────── */
window.openFileViewer = function(url, title) {
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
  const overlay = qs('#exam-overlay');
  const frame = qs('#exam-frame');
  const timerEl = qs('#exam-timer-display');
  
  if (!overlay || !frame) return;
  
  frame.src = url;
  frame.dataset.examId = id;
  frame.dataset.examTitle = title;
  frame.dataset.subject = subject;
  
  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  
  if (activeExamTimer) clearInterval(activeExamTimer);
  
  if (durationMinutes && durationMinutes > 0) {
    let timeLeft = durationMinutes * 60;
    timerEl.parentElement.classList.remove('hidden');
    
    activeExamTimer = setInterval(() => {
      timeLeft--;
      const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
      const s = (timeLeft % 60).toString().padStart(2, '0');
      timerEl.textContent = `${m}:${s}`;
      
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
  
  if (!title || !body) { showToast('Title and body required', 'error'); return; }
  
  const btn = qs('#post-notice-btn');
  btn.disabled = true; btn.textContent = 'Posting...';
  
  const links = linkUrl ? [{ label: 'View Link', url: linkUrl }] : [];
  const { error } = await supabase.from('notices').insert({ title, type, body, links });
  
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
