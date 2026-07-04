/* ==========================================================================
   Smart Planner — Shared App Core (js/app.js)
   Data layer (localStorage) · Logo renderer · User personalization · Toast
   WDT ITS63904 — Assignment 3
   ========================================================================== */

(function (window, document) {
  'use strict';

  /* ────────────────────────────────────────────────
     1. STORAGE KEYS & HELPERS
  ──────────────────────────────────────────────── */
  const KEYS = {
    USERS: 'sp-users',
    SESSION: 'sp-session',
    MEMBERS: 'sp-group-members',
    THEME: 'sp-theme',
    ACCENT: 'sp-accent'
  };

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* quota */ }
  }

  /* ────────────────────────────────────────────────
     2. SEED DATA (first run)
  ──────────────────────────────────────────────── */
  const DEFAULT_USER = {
    first: 'Shenzhi',
    last: 'Xie',
    nickname: 'Xie Shenzhi',
    username: 'shenzhixie',
    email: 'shenzhixie2@gmail.com',
    password: 'planner123',
    program: 'Computer Science',
    university: "Taylor's University",
    year: '2',
    bio: '',
    avatar: ''            /* dataURL when a photo is uploaded */
  };

  const DEFAULT_MEMBERS = [
    { name: 'Mora Premana', email: 'mora@taylors.edu.my', role: 'Backend Developer', color: 'linear-gradient(135deg,#1B3A6B,#3B6ED4)', online: true },
    { name: 'Xie Shenzhi', email: 'shenzhixie2@gmail.com', role: 'Frontend Developer', color: 'linear-gradient(135deg,#3A7A77,#4E9E9A)', online: true, you: true },
    { name: 'Ke Qian', email: 'keqian@taylors.edu.my', role: 'UI/UX Designer', color: 'linear-gradient(135deg,#6B21A8,#A855F7)', online: false },
    { name: 'Daniel', email: 'daniel@taylors.edu.my', role: 'Tester', color: 'linear-gradient(135deg,#92400e,#D97706)', online: false },
    { name: 'Zhao Yu', email: 'zhaoyu@taylors.edu.my', role: 'Documentation', color: 'linear-gradient(135deg,#166534,#22C55E)', online: false }
  ];

  function ensureSeed() {
    if (!read(KEYS.USERS, null)) write(KEYS.USERS, [DEFAULT_USER]);
    if (!read(KEYS.MEMBERS, null)) write(KEYS.MEMBERS, DEFAULT_MEMBERS);
  }
  ensureSeed();

  /* ────────────────────────────────────────────────
     3. USER / AUTH API
  ──────────────────────────────────────────────── */
  const SP = {

    users() { return read(KEYS.USERS, []); },

    findUser(email) {
      return this.users().find(u => u.email.toLowerCase() === String(email).toLowerCase()) || null;
    },

    register(data) {
      const users = this.users();
      if (this.findUser(data.email)) {
        return { ok: false, error: 'An account with this email already exists' };
      }
      const user = Object.assign({}, DEFAULT_USER, data, {
        nickname: data.nickname || (data.first + ' ' + data.last),
        username: data.username || (data.first + data.last).toLowerCase().replace(/\s+/g, ''),
        program: data.program || 'Computer Science',
        bio: '', avatar: ''
      });
      users.push(user);
      write(KEYS.USERS, users);
      this.setSession(user.email);
      return { ok: true, user };
    },

    login(email, password) {
      const user = this.findUser(email);
      if (!user) return { ok: false, error: 'No account found with this email' };
      if (user.password !== password) return { ok: false, error: 'Incorrect password' };
      this.setSession(user.email);
      return { ok: true, user };
    },

    socialLogin(provider) {
      /* demo: sign in as the seeded account */
      this.setSession(DEFAULT_USER.email);
      return { ok: true, provider };
    },

    setSession(email) { write(KEYS.SESSION, { email, at: Date.now() }); },

    logout() { localStorage.removeItem(KEYS.SESSION); },

    currentUser() {
      const s = read(KEYS.SESSION, null);
      return (s && this.findUser(s.email)) || this.findUser(DEFAULT_USER.email) || DEFAULT_USER;
    },

    isLoggedIn() { return !!read(KEYS.SESSION, null); },

    /* merge fields into the current user and persist */
    updateUser(fields) {
      const cur = this.currentUser();
      const users = this.users().map(u =>
        u.email.toLowerCase() === cur.email.toLowerCase() ? Object.assign({}, u, fields) : u);
      write(KEYS.USERS, users);
      this.applyUserToPage();
      return this.currentUser();
    },

    displayName(u) {
      u = u || this.currentUser();
      return u.nickname || ((u.first || '') + ' ' + (u.last || '')).trim() || u.username || 'Student';
    },

    initials(name) {
      return String(name || '').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'SP';
    },

    /* ────────────────────────────────────────────
       4. GROUP MEMBERS API
    ──────────────────────────────────────────── */
    members() { return read(KEYS.MEMBERS, []); },

    addMember(m) {
      const members = this.members();
      if (members.some(x => x.email.toLowerCase() === String(m.email).toLowerCase())) {
        return { ok: false, error: 'This member is already in the group' };
      }
      const palette = [
        'linear-gradient(135deg,#0E7490,#22D3EE)',
        'linear-gradient(135deg,#BE185D,#EC4899)',
        'linear-gradient(135deg,#4338CA,#818CF8)',
        'linear-gradient(135deg,#B45309,#F59E0B)',
        'linear-gradient(135deg,#15803D,#4ADE80)'
      ];
      m.color = palette[members.length % palette.length];
      m.online = true;
      members.push(m);
      write(KEYS.MEMBERS, members);
      return { ok: true, member: m };
    },

    removeMember(email) {
      write(KEYS.MEMBERS, this.members().filter(m => m.email !== email));
    },

    /* ────────────────────────────────────────────
       5. LOGO — "Rising trajectory · star"
       Three gradient arcs sweeping upward toward a
       four-point star: growth, planning, achievement.
    ──────────────────────────────────────────── */
    _logoN: 0,

    logoSVG(size) {
      size = size || 34;
      const id = 'splg' + (++this._logoN);
      return '' +
        '<svg class="sp-logo-mark" width="' + size + '" height="' + size + '" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Smart Planner logo">' +
        '<defs>' +
        '<linearGradient id="' + id + 'b" x1="0" y1="48" x2="48" y2="0" gradientUnits="userSpaceOnUse">' +
        '<stop offset="0" stop-color="#0F2449"/><stop offset=".62" stop-color="#1B3A6B"/><stop offset="1" stop-color="#3563C0"/></linearGradient>' +
        '<linearGradient id="' + id + 'a" x1="12" y1="37" x2="36" y2="14" gradientUnits="userSpaceOnUse">' +
        '<stop offset="0" stop-color="#4E9E9A"/><stop offset="1" stop-color="#8FD6D2"/></linearGradient>' +
        '<radialGradient id="' + id + 'g" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(36 10) rotate(115) scale(30)">' +
        '<stop offset="0" stop-color="#4E9E9A" stop-opacity=".38"/><stop offset="1" stop-color="#4E9E9A" stop-opacity="0"/></radialGradient>' +
        '</defs>' +
        '<rect width="48" height="48" rx="13" fill="url(#' + id + 'b)"/>' +
        '<rect width="48" height="48" rx="13" fill="url(#' + id + 'g)"/>' +
        '<path class="sp-arc sp-arc-3" d="M12 37c9.5-.6 17-6.5 21-17.5" stroke="url(#' + id + 'a)" stroke-width="3.4" stroke-linecap="round"/>' +
        '<path class="sp-arc sp-arc-2" d="M12 30.5c7.2-.5 12.6-4.6 15.6-11.8" stroke="#fff" opacity=".5" stroke-width="2.9" stroke-linecap="round"/>' +
        '<path class="sp-arc sp-arc-1" d="M12 24.2c4.8-.4 8.2-3 10.2-7.4" stroke="#fff" opacity=".24" stroke-width="2.5" stroke-linecap="round"/>' +
        '<path class="sp-star" d="M36.6 7.6l1.55 3.55 3.55 1.55-3.55 1.55-1.55 3.55-1.55-3.55-3.55-1.55 3.55-1.55z" fill="#7FD1CC"/>' +
        '<circle class="sp-dot" cx="29.6" cy="26.4" r="1.5" fill="#fff" opacity=".85"/>' +
        '</svg>';
    },

    renderLogos() {
      /* placeholder slots */
      document.querySelectorAll('.sp-logo').forEach(el => {
        const size = parseInt(el.dataset.size || '34', 10);
        el.innerHTML = this.logoSVG(size);
      });
      /* upgrade legacy inline logos (old 36x36 checkmark mark) in-place */
      document.querySelectorAll('svg[viewBox="0 0 36 36"]').forEach(svg => {
        if (!svg.querySelector('circle[fill="#4E9E9A"]')) return;
        const size = parseInt(svg.getAttribute('width') || '34', 10);
        const tmp = document.createElement('span');
        tmp.innerHTML = this.logoSVG(size);
        const fresh = tmp.firstElementChild;
        const style = svg.getAttribute('style');
        if (style) fresh.setAttribute('style', style);
        svg.replaceWith(fresh);
      });
    },

    /* ────────────────────────────────────────────
       6. PAGE PERSONALIZATION
       Reflect the stored user everywhere:
       sidebar name / role / avatar, [data-user-*] slots
    ──────────────────────────────────────────── */
    applyUserToPage() {
      const u = this.currentUser();
      const name = this.displayName(u);

      document.querySelectorAll('.sidebar-user-name, [data-user-name]').forEach(el => { el.textContent = name; });
      document.querySelectorAll('.sidebar-user-role, [data-user-role]').forEach(el => { el.textContent = u.program || 'Student'; });
      document.querySelectorAll('.sidebar-user .avatar, [data-user-avatar]').forEach(el => {
        if (u.avatar) {
          el.style.backgroundImage = 'url(' + u.avatar + ')';
          el.style.backgroundSize = 'cover';
          el.style.backgroundPosition = 'center';
          el.textContent = '';
        } else {
          el.style.backgroundImage = '';
          el.textContent = this.initials(name);
        }
      });
    },

    /* ────────────────────────────────────────────
       7. TOAST (shared, auto-created)
    ──────────────────────────────────────────── */
    toast(msg, ok) {
      let t = document.getElementById('spToast');
      if (!t) {
        t = document.createElement('div');
        t.id = 'spToast';
        t.className = 'sp-toast';
        t.innerHTML = '<span class="sp-toast-icon"></span><span class="sp-toast-msg"></span>';
        document.body.appendChild(t);
      }
      t.querySelector('.sp-toast-icon').innerHTML = ok === false
        ? '<svg width="16" height="16" fill="none" stroke="#EF4444" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>'
        : '<svg width="16" height="16" fill="none" stroke="#22C55E" stroke-width="2.5" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>';
      t.querySelector('.sp-toast-msg').textContent = msg;
      clearTimeout(this._toastTimer);
      t.classList.add('show');
      this._toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
    }
  };

  /* ────────────────────────────────────────────────
     8. GLOBAL BOOT
  ──────────────────────────────────────────────── */
  function boot() {
    SP.renderLogos();
    SP.applyUserToPage();

    /* saved theme & accent (all pages, not just settings) */
    const theme = read(KEYS.THEME, null);
    if (theme && document.documentElement.hasAttribute('data-theme')) {
      const applied = theme === 'system'
        ? (window.matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light')
        : theme;
      document.documentElement.setAttribute('data-theme', applied);
    }
    const accent = read(KEYS.ACCENT, null);
    if (accent) document.documentElement.style.setProperty('--navy', accent);

    /* page enter animation */
    document.body.classList.add('sp-page-enter');

    /* logout links */
    document.querySelectorAll('[data-logout]').forEach(el =>
      el.addEventListener('click', () => SP.logout()));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.SP = SP;
})(window, document);
