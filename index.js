// ── JSON Helper ──
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function generateToken() {
  return crypto.randomUUID();
}

function normalizeWA(number) {
  if (!number) return '';
  var n = String(number).replace(/[\s\-\(\)]/g, '');
  if (n.startsWith('+')) n = n.slice(1);
  if (n.startsWith('08')) n = '62' + n.slice(1);
  if (n.startsWith('8') && !n.startsWith('62')) n = '62' + n;
  return n;
}

// ── Session Helper ──

async function getSession(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/(?:^|;\s*)admin_session=([^\s;]+)/);
  if (!match) return null;

  const token = match[1];
  const session = await env.DB.prepare(
    "SELECT * FROM user_sessions WHERE token = ? AND expires_at > datetime('now')"
  ).bind(token).first();
  if (!session) return null;

  const user = await env.DB.prepare(
    "SELECT id, name, wa_number, role FROM users WHERE id = ? AND role IN ('admin', 'super_admin')"
  ).bind(session.user_id).first();
  return user || null;
}

// ── Cookie Helpers ──

function sessionCookie(token) {
  const maxAge = 7 * 24 * 60 * 60; // 7 days
  return `admin_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

function clearCookie() {
  return 'admin_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0';
}

// ── Masjid Fuzzy Match ──

async function matchMasjid(name, city, env) {
  const stopWords = ['masjid','agung','besar','jami','raya','al','an','ar','as','at'];
  const words = name.split(/[\s\-]+/).filter(w => !stopWords.includes(w.toLowerCase()) && w.length > 1);
  if (words.length === 0) return null;

  const conditions = words.map(() => "name LIKE ?");
  const baseParams = words.map(w => '%' + w + '%');

  const baseSql = "SELECT id, name, city FROM masjid WHERE status = 'approved' AND (" + conditions.join(' OR ') + ")";

  // Try with city filter first if city is provided
  if (city) {
    const cityParams = [...baseParams, '%' + city + '%'];
    const { results: cityResults } = await env.DB.prepare(baseSql + " AND city LIKE ? LIMIT 5").bind(...cityParams).all();
    if (cityResults.length > 0) return cityResults[0];
  }

  // Fallback: search without city filter
  const { results } = await env.DB.prepare(baseSql + " LIMIT 5").bind(...baseParams).all();
  return results.length > 0 ? results[0] : null;
}

// ── Embedded HTML ──

const HTML = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Admin - MasjidReview</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --green: #1B7A4A;
      --green-light: rgba(27,122,74,0.08);
      --dark-green: #2D5016;
      --text: #18181B;
      --text-2: #6b7280;
      --text-3: #9ca3af;
      --bg: #F9FAFB;
      --white: #FFFFFF;
      --border: #e5e7eb;
      --border-2: #f3f4f6;
      --red: #e11d48;
      --radius: 12px;
      --radius-sm: 8px;
    }

    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }

    /* ── LOGO ── */
    .logo { display: inline-flex; align-items: center; gap: 0; }
    .logo-light {
      font-family: 'Space Grotesk', sans-serif;
      font-weight: 400;
      color: #616161;
    }
    .logo-bold {
      font-family: 'Space Grotesk', sans-serif;
      font-weight: 700;
      color: var(--dark-green);
    }
    .admin-badge {
      display: inline-block;
      background: var(--green);
      color: white;
      font-size: 10px;
      font-weight: 600;
      padding: 2px 7px;
      border-radius: 5px;
      margin-left: 8px;
      vertical-align: middle;
      letter-spacing: 0.3px;
    }

    /* ── LOGIN VIEW ── */
    .login-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .login-card {
      background: var(--white);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 40px 32px;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }
    .login-logo {
      text-align: center;
      margin-bottom: 32px;
      font-size: 24px;
    }
    .form-group { margin-bottom: 16px; }
    .form-group label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 6px;
      color: var(--text);
    }
    .form-group input {
      width: 100%;
      height: 44px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 0 12px;
      font-size: 14px;
      font-family: inherit;
      outline: none;
      color: var(--text);
      background: var(--white);
    }
    .form-group input:focus { border-color: var(--green); }
    .error-msg {
      color: var(--red);
      font-size: 13px;
      margin-bottom: 12px;
      text-align: center;
    }
    .btn-primary {
      width: 100%;
      height: 44px;
      background: var(--green);
      color: white;
      border: none;
      border-radius: var(--radius-sm);
      font-size: 15px;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      transition: opacity 0.12s;
    }
    .btn-primary:hover { opacity: 0.9; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

    /* ── TOPBAR ── */
    .topbar {
      height: 56px;
      background: var(--white);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .topbar-left { display: flex; align-items: center; font-size: 18px; }
    .topbar-right { display: flex; align-items: center; gap: 16px; }
    .topbar-admin-name {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-2);
    }
    .btn-logout {
      background: none;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 6px 14px;
      font-size: 13px;
      font-weight: 500;
      font-family: inherit;
      cursor: pointer;
      color: var(--text);
      transition: background 0.12s;
    }
    .btn-logout:hover { background: var(--bg); }

    /* ── LAYOUT ── */
    .dashboard-layout {
      display: flex;
      min-height: calc(100vh - 56px);
    }

    /* ── SIDEBAR ── */
    .sidebar {
      width: 220px;
      background: var(--white);
      border-right: 1px solid var(--border);
      padding: 16px 12px;
      flex-shrink: 0;
    }
    .nav-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      border-radius: var(--radius-sm);
      font-size: 14px;
      font-weight: 500;
      color: var(--text);
      text-decoration: none;
      margin-bottom: 4px;
      cursor: pointer;
      transition: background 0.1s;
    }
    .nav-item:hover { background: var(--bg); }
    .nav-item.active {
      background: var(--green-light);
      color: var(--green);
    }
    .nav-item.active:hover { background: var(--green-light); }
    .nav-item.disabled {
      color: var(--text-3);
      cursor: default;
    }
    .nav-item.disabled:hover { background: transparent; }
    .coming-soon {
      font-size: 10px;
      background: var(--border-2);
      color: var(--text-3);
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 400;
    }

    /* ── MAIN CONTENT ── */
    .main-content {
      flex: 1;
      padding: 28px 32px;
      min-width: 0;
    }
    .page-title {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 22px;
      font-weight: 700;
      margin-bottom: 24px;
      color: var(--text);
    }

    /* ── STATS GRID ── */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 16px;
    }
    .stat-card {
      background: var(--white);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 20px;
      transition: box-shadow 0.12s;
    }
    .stat-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
    .stat-label {
      font-size: 13px;
      color: var(--text-2);
      margin-bottom: 8px;
      font-weight: 500;
    }
    .stat-value {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 28px;
      font-weight: 700;
      color: var(--text);
      line-height: 1;
    }
    .stat-badge {
      display: inline-block;
      background: #FEF2F2;
      color: var(--red);
      font-size: 11px;
      font-weight: 600;
      padding: 2px 7px;
      border-radius: 6px;
      margin-left: 8px;
      vertical-align: middle;
    }

    /* ── LOADING ── */
    .loading-text {
      color: var(--text-3);
      font-size: 14px;
      padding: 20px 0;
    }

    /* ── PAGE HEADER ── */
    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
    }
    .page-header .page-title { margin-bottom: 0; }

    /* ── SMALL BUTTONS ── */
    .btn-sm {
      height: 36px;
      padding: 0 16px;
      border-radius: var(--radius-sm);
      font-size: 13px;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      border: none;
      transition: opacity 0.12s;
      white-space: nowrap;
    }
    .btn-sm:hover { opacity: 0.85; }
    .btn-green { background: var(--green); color: white; }
    .btn-outline { background: var(--white); color: var(--text); border: 1px solid var(--border); }
    .btn-outline:hover { background: var(--bg); opacity: 1; }
    .btn-red { background: var(--red); color: white; }
    .btn-yellow { background: #D97706; color: white; }

    /* ── FILTER TABS ── */
    .filter-tabs {
      display: flex;
      gap: 6px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    .filter-tab {
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      border: 1px solid var(--border);
      background: var(--white);
      color: var(--text-2);
      font-family: inherit;
      transition: all 0.12s;
    }
    .filter-tab:hover { border-color: var(--green); color: var(--green); }
    .filter-tab.active {
      background: var(--green);
      color: white;
      border-color: var(--green);
    }
    .tab-badge {
      display: inline-block;
      background: rgba(255,255,255,0.25);
      font-size: 11px;
      padding: 1px 6px;
      border-radius: 8px;
      margin-left: 4px;
    }
    .filter-tab:not(.active) .tab-badge {
      background: var(--border-2);
    }

    /* ── DATA TABLE ── */
    .data-table {
      width: 100%;
      border-collapse: collapse;
      background: var(--white);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
    }
    .data-table th {
      text-align: left;
      padding: 12px 16px;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-2);
      text-transform: uppercase;
      letter-spacing: 0.3px;
      background: var(--bg);
      border-bottom: 1px solid var(--border);
    }
    .data-table td {
      padding: 12px 16px;
      font-size: 14px;
      border-bottom: 1px solid var(--border-2);
      vertical-align: middle;
    }
    .data-table tr:last-child td { border-bottom: none; }
    .data-table tr:hover td { background: var(--bg); }
    .td-actions { display: flex; gap: 6px; }

    /* ── STATUS BADGES ── */
    .badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }
    .badge-approved { background: #D1FAE5; color: #065F46; }
    .badge-pending { background: #FEF3C7; color: #92400E; }
    .badge-rejected { background: #F3F4F6; color: #6B7280; }
    .badge-super-admin { background: #D1FAE5; color: #065F46; }
    .badge-admin { background: #F3F4F6; color: #6B7280; }

    /* ── BULK BAR ── */
    .bulk-bar {
      display: none; align-items: center; gap: 12px;
      padding: 12px 16px; background: #F0FDF4;
      border: 1px solid #BBF7D0; border-radius: 8px; margin-bottom: 16px;
    }
    .bulk-bar.visible { display: flex; }
    .bulk-bar-count { font-size: 14px; font-weight: 600; color: #065F46; flex: 1; }
    .row-checkbox { width: 18px; height: 18px; accent-color: #1B7A4A; cursor: pointer; }
    th.col-check, td.col-check { width: 40px; text-align: center; }

    /* ── ADMIN FORM ── */
    .form-card {
      background: var(--white);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 24px;
      margin-bottom: 20px;
    }
    .form-section-title {
      font-size: 15px;
      font-weight: 700;
      margin-bottom: 20px;
      color: var(--text);
      font-family: 'Space Grotesk', sans-serif;
    }
    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .form-group-admin { margin-bottom: 16px; }
    .form-group-admin label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      margin-bottom: 6px;
      color: var(--text-2);
    }
    .form-group-admin input,
    .form-group-admin textarea,
    .form-group-admin select {
      width: 100%;
      height: 40px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 0 12px;
      font-size: 14px;
      font-family: inherit;
      color: var(--text);
      background: var(--white);
      outline: none;
    }
    .form-group-admin textarea {
      height: 72px;
      padding: 10px 12px;
      resize: vertical;
    }
    .form-group-admin input:focus,
    .form-group-admin textarea:focus,
    .form-group-admin select:focus { border-color: var(--green); }
    .form-full { grid-column: 1 / -1; }

    /* ── TOGGLE SWITCH ── */
    .toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid var(--border-2);
    }
    .toggle-row:last-child { border-bottom: none; }
    .toggle-label { font-size: 14px; color: var(--text); }
    .toggle-switch {
      position: relative;
      width: 44px;
      height: 24px;
      flex-shrink: 0;
    }
    .toggle-switch input { opacity: 0; width: 0; height: 0; }
    .toggle-slider {
      position: absolute;
      inset: 0;
      background: var(--border);
      border-radius: 24px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .toggle-slider::before {
      content: '';
      position: absolute;
      left: 2px;
      top: 2px;
      width: 20px;
      height: 20px;
      background: white;
      border-radius: 50%;
      transition: transform 0.2s;
      box-shadow: 0 1px 3px rgba(0,0,0,0.15);
    }
    .toggle-switch input:checked + .toggle-slider { background: var(--green); }
    .toggle-switch input:checked + .toggle-slider::before { transform: translateX(20px); }

    /* ── PHOTO URL ROWS ── */
    .photo-url-row {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
    }
    .photo-url-row input { flex: 1; }
    .btn-remove-photo {
      width: 40px;
      height: 40px;
      border: 1px solid var(--border);
      background: var(--white);
      border-radius: var(--radius-sm);
      cursor: pointer;
      font-size: 18px;
      color: var(--red);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .btn-remove-photo:hover { background: #FEF2F2; }
    .btn-add-photo {
      width: 100%;
      height: 40px;
      border: 1px dashed var(--border);
      background: var(--white);
      border-radius: var(--radius-sm);
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-2);
      font-family: inherit;
    }
    .btn-add-photo:hover { border-color: var(--green); color: var(--green); }
    .photo-upload-row { display: flex; gap: 8px; align-items: center; margin-top: 6px; }
    .btn-upload-photo {
      padding: 6px 14px; border: 1px solid var(--green); background: var(--white);
      border-radius: var(--radius-sm); cursor: pointer; font-size: 12px; font-weight: 500;
      color: var(--green); font-family: inherit; white-space: nowrap;
    }
    .btn-upload-photo:hover { background: var(--green-light); }
    .photo-preview {
      width: 80px; height: 80px; object-fit: cover; border-radius: var(--radius-sm);
      border: 1px solid var(--border); margin-top: 6px; display: none;
    }
    .upload-status { font-size: 12px; color: var(--text-2); margin-top: 4px; }

    /* ── USER MANAGEMENT ── */
    .user-info-card {
      background: var(--white); border: 1px solid var(--border);
      border-radius: var(--radius); padding: 24px; margin-bottom: 20px;
    }
    .user-info-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border-2); }
    .user-info-row:last-child { border-bottom: none; }
    .user-info-label { font-size: 13px; color: var(--text-2); min-width: 100px; }
    .user-info-value { font-size: 14px; font-weight: 500; }

    /* ── SIMILAR ALERT ── */
    .similar-box {
      background: #FFFBEB;
      border: 1px solid #FDE68A;
      border-radius: var(--radius);
      padding: 16px 20px;
      margin-bottom: 20px;
    }
    .similar-box-title {
      font-size: 14px;
      font-weight: 600;
      color: #92400E;
      margin-bottom: 8px;
    }
    .similar-box ul {
      list-style: disc;
      padding-left: 20px;
      font-size: 13px;
      color: #78350F;
    }
    .similar-box li { margin-bottom: 4px; }

    /* ── TOAST ── */
    .toast-container {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .toast {
      padding: 12px 20px;
      border-radius: var(--radius-sm);
      font-size: 14px;
      font-weight: 500;
      color: white;
      animation: toastIn 0.3s ease;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .toast-success { background: var(--green); }
    .toast-error { background: var(--red); }
    @keyframes toastIn {
      from { transform: translateY(16px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    /* ── CONFIRM DIALOG ── */
    .confirm-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.4);
      z-index: 9998;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .confirm-box {
      background: var(--white);
      border-radius: var(--radius);
      padding: 28px;
      max-width: 400px;
      width: 100%;
      text-align: center;
      box-shadow: 0 8px 24px rgba(0,0,0,0.12);
    }
    .confirm-box h3 {
      font-size: 16px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .confirm-box p {
      font-size: 14px;
      color: var(--text-2);
      margin-bottom: 20px;
    }
    .confirm-actions { display: flex; gap: 8px; justify-content: center; }

    /* ── EMPTY STATE ── */
    .empty-state {
      text-align: center;
      padding: 48px 20px;
      color: var(--text-3);
    }
    .empty-state-icon { font-size: 40px; margin-bottom: 12px; }
    .empty-state-text { font-size: 14px; }

    /* ── MOBILE ── */
    @media (max-width: 768px) {
      .dashboard-layout { flex-direction: column; }
      .sidebar {
        width: 100%;
        border-right: none;
        border-bottom: 1px solid var(--border);
        padding: 12px 16px;
        display: flex;
        gap: 4px;
        overflow-x: auto;
      }
      .nav-item { white-space: nowrap; flex-shrink: 0; }
      .main-content { padding: 20px 16px; }
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
      .topbar { padding: 0 16px; }
      .login-card { padding: 32px 24px; }
      .page-header { flex-direction: column; align-items: flex-start; gap: 12px; }
      .form-row { grid-template-columns: 1fr; }
      .filter-tabs { overflow-x: auto; flex-wrap: nowrap; -webkit-overflow-scrolling: touch; }
      .data-table { font-size: 13px; }
      .data-table th, .data-table td { padding: 10px 12px; }
      .td-actions { flex-wrap: wrap; }
    }
    @media (max-width: 400px) {
      .stats-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>

<!-- LOGIN VIEW -->
<div id="view-login" style="display:none">
  <div class="login-container">
    <div class="login-card">
      <div class="login-logo">
        <span class="logo">
          <span class="logo-light">Masjid</span><span class="logo-bold">Review</span>
        </span>
        <span class="admin-badge">Admin</span>
      </div>
      <form id="login-form" onsubmit="requestOTP(event)">
        <div class="form-group">
          <label for="wa-number">Nomor WhatsApp</label>
          <input type="tel" id="wa-number" required placeholder="08xxxxxxxxxx" autocomplete="tel" />
        </div>
        <div id="login-error" class="error-msg" style="display:none"></div>
        <button type="submit" class="btn-primary" id="login-btn">Kirim Kode OTP</button>
      </form>
      <form id="otp-form" style="display:none" onsubmit="verifyOTP(event)">
        <p style="font-size:14px;color:var(--text-3);margin-bottom:16px;text-align:center">
          Kode OTP telah dikirim ke <strong id="otp-target-wa"></strong>
        </p>
        <div class="form-group">
          <label for="otp-code">Kode OTP</label>
          <input type="text" id="otp-code" required placeholder="Masukkan 6 digit kode" maxlength="6" inputmode="numeric" pattern="[0-9]{6}" autocomplete="one-time-code" />
        </div>
        <div id="otp-error" class="error-msg" style="display:none"></div>
        <button type="submit" class="btn-primary" id="otp-btn">Verifikasi</button>
        <button type="button" onclick="backToWaStep()" style="display:block;margin:12px auto 0;background:none;border:none;color:var(--green);cursor:pointer;font-size:13px;font-family:inherit">Ubah nomor WhatsApp</button>
      </form>
    </div>
  </div>
</div>

<!-- DASHBOARD VIEW -->
<div id="view-dashboard" style="display:none">
  <div class="topbar">
    <div class="topbar-left">
      <span class="logo">
        <span class="logo-light">Masjid</span><span class="logo-bold">Review</span>
      </span>
      <span class="admin-badge">Admin</span>
    </div>
    <div class="topbar-right">
      <span class="topbar-admin-name" id="admin-name"></span>
      <button onclick="handleLogout()" class="btn-logout">Keluar</button>
    </div>
  </div>

  <div class="dashboard-layout">
    <nav class="sidebar" id="sidebar">
      <div class="nav-item active" id="nav-dashboard" onclick="navigateTo('dashboard')">Dashboard</div>
      <div class="nav-item" id="nav-masjid" onclick="navigateTo('masjid-list')">Masjid</div>
      <div class="nav-item" id="nav-reviews" onclick="navigateTo('review-list')">Reviews</div>
      <div class="nav-item" id="nav-users" onclick="navigateTo('user-list')">Users</div>
      <div class="nav-item" id="nav-admin" style="display:none" onclick="navigateTo('admin-list')">Admin</div>
    </nav>

    <main class="main-content" id="main-content">
      <div id="page-dashboard">
        <h1 class="page-title">Dashboard</h1>
        <div class="stats-grid" id="stats-grid">
          <div class="stat-card"><div class="loading-text">Memuat statistik...</div></div>
        </div>
      </div>

      <div id="page-masjid-list" style="display:none">
        <div class="page-header">
          <h1 class="page-title">Kelola Masjid</h1>
          <button class="btn-sm btn-green" onclick="navigateTo('masjid-form')">+ Tambah Masjid</button>
        </div>
        <div id="masjid-filter-tabs"></div>
        <div class="bulk-bar" id="masjid-bulk-bar">
          <span class="bulk-bar-count" id="masjid-bulk-count">0 dipilih</span>
          <button class="btn-sm btn-green" onclick="bulkMasjidAction('approved')">Approve</button>
          <button class="btn-sm btn-outline" onclick="bulkMasjidAction('rejected')">Reject</button>
        </div>
        <div id="masjid-table-container"></div>
      </div>

      <div id="page-masjid-form" style="display:none">
        <div class="page-header">
          <h1 class="page-title" id="form-title">Tambah Masjid</h1>
          <div style="display:flex;gap:8px">
            <button class="btn-sm btn-outline" onclick="navigateTo('masjid-list')">Batal</button>
            <button class="btn-sm btn-green" onclick="saveMasjid()" id="form-save-btn">Simpan</button>
          </div>
        </div>
        <div id="similar-alert-container"></div>
        <form id="masjid-form" onsubmit="return false">

          <div class="form-card">
            <div class="form-section-title">Informasi Dasar</div>
            <div class="form-row">
              <div class="form-group-admin">
                <label>Nama Masjid *</label>
                <input type="text" id="f-name" required placeholder="Masjid Al-..." />
              </div>
              <div class="form-group-admin">
                <label>Kota *</label>
                <input type="text" id="f-city" required placeholder="Jakarta Selatan" />
              </div>
            </div>
            <div class="form-group-admin">
              <label>Alamat</label>
              <textarea id="f-address" placeholder="Jl. ..."></textarea>
            </div>
            <div class="form-row">
              <div class="form-group-admin">
                <label>Foto Utama</label>
                <input type="url" id="f-photo_url" placeholder="Paste URL atau upload di bawah" />
                <div class="photo-upload-row">
                  <button type="button" class="btn-upload-photo" onclick="triggerPhotoUpload()">📷 Upload Foto</button>
                  <input type="file" id="photo-upload-input" accept="image/*" style="display:none" onchange="handlePhotoUpload(this)" />
                  <span class="upload-status" id="photo-upload-status"></span>
                </div>
                <img class="photo-preview" id="photo-preview" />
              </div>
              <div class="form-group-admin">
                <label>Google Maps URL</label>
                <input type="url" id="f-google_maps_url" placeholder="https://maps.google.com/..." />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group-admin">
                <label>Latitude</label>
                <input type="text" id="f-latitude" placeholder="-6.xxx" />
              </div>
              <div class="form-group-admin">
                <label>Longitude</label>
                <input type="text" id="f-longitude" placeholder="106.xxx" />
              </div>
            </div>
            <div class="form-group-admin">
              <label>Instagram Post URL</label>
              <input type="url" id="f-ig_post_url" placeholder="https://instagram.com/p/..." />
            </div>
          </div>

          <div class="form-card">
            <div class="form-section-title">Informasi Umum</div>
            <div class="form-group-admin">
              <label>Label Info</label>
              <input type="text" id="f-info_label" placeholder="Jadwal, fasilitas, dsb." />
            </div>
            <div class="form-group-admin">
              <label>Foto Info (maks. 5 URL)</label>
              <div id="info-photos-container"></div>
              <button type="button" class="btn-add-photo" onclick="addInfoPhotoRow()">+ Tambah Foto Info</button>
            </div>
          </div>

          <div class="form-card">
            <div class="form-section-title">Fasilitas Ramadhan</div>
            <div class="toggle-row">
              <span class="toggle-label">Takjil</span>
              <label class="toggle-switch"><input type="checkbox" id="f-ramadan_takjil" /><span class="toggle-slider"></span></label>
            </div>
            <div class="toggle-row">
              <span class="toggle-label">Makanan Berat</span>
              <label class="toggle-switch"><input type="checkbox" id="f-ramadan_makanan_berat" /><span class="toggle-slider"></span></label>
            </div>
            <div class="toggle-row">
              <span class="toggle-label">Ceramah/Kultum</span>
              <label class="toggle-switch"><input type="checkbox" id="f-ramadan_ceramah_tarawih" /><span class="toggle-slider"></span></label>
            </div>
            <div class="toggle-row">
              <span class="toggle-label">Mushaf Al-Quran</span>
              <label class="toggle-switch"><input type="checkbox" id="f-ramadan_mushaf_alquran" /><span class="toggle-slider"></span></label>
            </div>
            <div class="toggle-row">
              <span class="toggle-label">Itikaf</span>
              <label class="toggle-switch"><input type="checkbox" id="f-ramadan_itikaf" /><span class="toggle-slider"></span></label>
            </div>
            <div class="toggle-row">
              <span class="toggle-label">Parkir Luas</span>
              <label class="toggle-switch"><input type="checkbox" id="f-ramadan_parkir" /><span class="toggle-slider"></span></label>
            </div>
            <div class="form-row" style="margin-top:16px">
              <div class="form-group-admin">
                <label>Jumlah Rakaat</label>
                <select id="f-ramadan_rakaat">
                  <option value="">— Pilih —</option>
                  <option value="11">11 Rakaat</option>
                  <option value="23">23 Rakaat</option>
                </select>
              </div>
              <div class="form-group-admin">
                <label>Tempo Sholat</label>
                <select id="f-ramadan_tempo">
                  <option value="">— Pilih —</option>
                  <option value="khusyuk">Khusyuk</option>
                  <option value="sedang">Sedang</option>
                  <option value="cepat">Cepat</option>
                </select>
              </div>
            </div>
          </div>

          <div class="form-card">
            <div class="form-section-title">Fasilitas Akhwat</div>
            <div class="toggle-row">
              <span class="toggle-label">Tempat Wudhu Terpisah</span>
              <label class="toggle-switch"><input type="checkbox" id="f-akhwat_wudhu_private" /><span class="toggle-slider"></span></label>
            </div>
            <div class="toggle-row">
              <span class="toggle-label">Mukena Tersedia</span>
              <label class="toggle-switch"><input type="checkbox" id="f-akhwat_mukena_available" /><span class="toggle-slider"></span></label>
            </div>
            <div class="toggle-row">
              <span class="toggle-label">AC di Area Akhwat</span>
              <label class="toggle-switch"><input type="checkbox" id="f-akhwat_ac_available" /><span class="toggle-slider"></span></label>
            </div>
            <div class="toggle-row">
              <span class="toggle-label">Pintu Masuk Aman</span>
              <label class="toggle-switch"><input type="checkbox" id="f-akhwat_safe_entrance" /><span class="toggle-slider"></span></label>
            </div>
          </div>

        </form>
      </div>

      <div id="page-review-list" style="display:none">
        <div class="page-header">
          <h1 class="page-title">Kelola Reviews</h1>
        </div>
        <div id="review-filter-tabs"></div>
        <div class="bulk-bar" id="review-bulk-bar">
          <span class="bulk-bar-count" id="review-bulk-count">0 dipilih</span>
          <button class="btn-sm btn-green" onclick="bulkReviewAction('approved')">Approve</button>
          <button class="btn-sm btn-outline" onclick="bulkReviewAction('rejected')">Reject</button>
        </div>
        <div id="review-table-container"></div>
      </div>

      <div id="page-review-form" style="display:none">
        <div class="page-header">
          <h1 class="page-title" id="review-form-title">Edit Review</h1>
          <div style="display:flex;gap:8px">
            <button class="btn-sm btn-outline" onclick="navigateTo('review-list')">Batal</button>
            <button class="btn-sm btn-green" onclick="saveReview()" id="review-save-btn">Simpan</button>
          </div>
        </div>
        <form id="review-form" onsubmit="return false">
          <div class="form-card">
            <div class="form-section-title">Detail Review</div>
            <div class="form-row">
              <div class="form-group-admin">
                <label>Nama Reviewer</label>
                <input type="text" id="rf-reviewer_name" placeholder="Anonim" />
              </div>
              <div class="form-group-admin">
                <label>Masjid *</label>
                <select id="rf-masjid_id" required></select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group-admin">
                <label>Rating (1-5)</label>
                <input type="number" id="rf-rating" min="1" max="5" step="0.1" placeholder="4.5" />
              </div>
              <div class="form-group-admin">
                <label>Source Platform</label>
                <select id="rf-source_platform">
                  <option value="">— Pilih —</option>
                  <option value="ig">Instagram</option>
                  <option value="x">X (Twitter)</option>
                  <option value="threads">Threads</option>
                  <option value="form">Form</option>
                  <option value="wa_bot">WhatsApp Bot</option>
                  <option value="web">Web</option>
                </select>
              </div>
            </div>
            <div class="form-group-admin">
              <label>Testimoni</label>
              <textarea id="rf-short_description" placeholder="Tulis testimoni..." style="height:100px"></textarea>
            </div>
            <div class="form-group-admin">
              <label>Source URL</label>
              <input type="url" id="rf-source_url" placeholder="https://..." />
            </div>
          </div>
        </form>
      </div>

      <div id="page-user-list" style="display:none">
        <div class="page-header">
          <h1 class="page-title">Kelola Users</h1>
        </div>
        <div id="user-table-container"></div>
      </div>

      <div id="page-user-detail" style="display:none">
        <div class="page-header">
          <h1 class="page-title">
            <button class="btn-sm btn-outline" onclick="navigateTo('user-list')">← Kembali</button>
            <span id="user-detail-title">Detail User</span>
          </h1>
          <button class="btn-sm btn-outline" style="color:var(--red);border-color:var(--red)" id="user-force-logout-btn" onclick="forceLogoutFromDetail()">Force Logout</button>
        </div>
        <div id="user-detail-container"></div>
      </div>

      <div id="page-admin-list" style="display:none">
        <div class="page-header">
          <h1 class="page-title">Kelola Admin</h1>
          <button class="btn-sm btn-green" onclick="showPromoteAdmin()">+ Promote User</button>
        </div>
        <div id="admin-table-container"></div>
      </div>

    </main>
  </div>
</div>

<div class="toast-container" id="toast-container"></div>
<div id="confirm-container"></div>

<script>
  var currentAdmin = null;
  var currentPage = 'dashboard';
  var masjidList = [];
  var masjidFilter = 'all';
  var editingMasjidId = null;
  var reviewList = [];
  var reviewFilter = 'all';
  var editingReviewId = null;
  var selectedMasjidIds = new Set();
  var selectedReviewIds = new Set();
  var userList = [];
  var currentUserId = null;
  var adminList = [];

  async function init() {
    try {
      var res = await fetch('/auth/me');
      if (res.ok) {
        currentAdmin = await res.json();
        showDashboard();
      } else {
        showLogin();
      }
    } catch (e) {
      showLogin();
    }
  }

  function showLogin() {
    document.getElementById('view-login').style.display = 'block';
    document.getElementById('view-dashboard').style.display = 'none';
  }

  function showDashboard() {
    document.getElementById('view-login').style.display = 'none';
    document.getElementById('view-dashboard').style.display = 'block';
    document.getElementById('admin-name').textContent = currentAdmin.name;
    // Show Admin nav item only for super_admin
    if (currentAdmin.role === 'super_admin') {
      document.getElementById('nav-admin').style.display = 'flex';
    }
    navigateTo('dashboard');
  }

  var loginWaNumber = '';

  async function requestOTP(e) {
    e.preventDefault();
    var btn = document.getElementById('login-btn');
    var errEl = document.getElementById('login-error');
    errEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Mengirim...';

    try {
      var waNumber = document.getElementById('wa-number').value.trim();
      var res = await fetch('/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wa_number: waNumber }),
      });
      var data = await res.json();
      if (!res.ok) {
        errEl.textContent = data.error || 'Gagal mengirim OTP';
        errEl.style.display = 'block';
        return;
      }
      loginWaNumber = waNumber;
      document.getElementById('login-form').style.display = 'none';
      document.getElementById('otp-form').style.display = 'block';
      document.getElementById('otp-target-wa').textContent = waNumber;
      document.getElementById('otp-code').focus();
    } catch (err) {
      errEl.textContent = 'Terjadi kesalahan jaringan';
      errEl.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Kirim Kode OTP';
    }
  }

  async function verifyOTP(e) {
    e.preventDefault();
    var btn = document.getElementById('otp-btn');
    var errEl = document.getElementById('otp-error');
    errEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Memverifikasi...';

    try {
      var res = await fetch('/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wa_number: loginWaNumber,
          code: document.getElementById('otp-code').value.trim(),
        }),
      });
      var data = await res.json();
      if (!res.ok) {
        errEl.textContent = data.error || 'Verifikasi gagal';
        errEl.style.display = 'block';
        return;
      }
      currentAdmin = data.admin;
      showDashboard();
    } catch (err) {
      errEl.textContent = 'Terjadi kesalahan jaringan';
      errEl.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Verifikasi';
    }
  }

  function backToWaStep() {
    document.getElementById('otp-form').style.display = 'none';
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('otp-error').style.display = 'none';
    document.getElementById('otp-code').value = '';
  }

  async function handleLogout() {
    await fetch('/auth/logout', { method: 'POST' });
    currentAdmin = null;
    loginWaNumber = '';
    showLogin();
    document.getElementById('login-form').reset();
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('otp-form').style.display = 'none';
    document.getElementById('login-error').style.display = 'none';
    document.getElementById('otp-error').style.display = 'none';
  }

  async function loadStats() {
    var grid = document.getElementById('stats-grid');
    grid.innerHTML = '<div class="stat-card"><div class="loading-text">Memuat statistik...</div></div>';

    try {
      var res = await fetch('/api/stats');
      if (!res.ok) throw new Error();
      var s = await res.json();

      grid.innerHTML =
        statCard('Total Masjid', s.total_masjid) +
        statCard('Total Reviews', s.total_reviews) +
        statCard('Review Pending', s.pending_reviews, s.pending_reviews > 0) +
        statCard('Masjid Pending', s.pending_masjid, s.pending_masjid > 0) +
        statCard('Total Users', s.total_users) +
        statCard('Total Admin', s.total_admins);
    } catch (e) {
      grid.innerHTML = '<div class="stat-card"><div class="loading-text">Gagal memuat statistik</div></div>';
    }
  }

  function statCard(label, value, showBadge) {
    var badge = showBadge ? '<span class="stat-badge">' + value + ' pending</span>' : '';
    return '<div class="stat-card">' +
      '<div class="stat-label">' + label + '</div>' +
      '<div class="stat-value">' + (value != null ? value : '-') + badge + '</div>' +
    '</div>';
  }

  // ── Navigation ──

  function navigateTo(page, data) {
    currentPage = page;
    var pages = ['page-dashboard', 'page-masjid-list', 'page-masjid-form', 'page-review-list', 'page-review-form', 'page-user-list', 'page-user-detail', 'page-admin-list'];
    for (var i = 0; i < pages.length; i++) {
      document.getElementById(pages[i]).style.display = 'none';
    }

    // Update sidebar active
    var navIds = ['nav-dashboard', 'nav-masjid', 'nav-reviews', 'nav-users', 'nav-admin'];
    for (var i = 0; i < navIds.length; i++) {
      var el = document.getElementById(navIds[i]);
      if (el) el.classList.remove('active');
    }

    if (page === 'dashboard') {
      document.getElementById('page-dashboard').style.display = 'block';
      document.getElementById('nav-dashboard').classList.add('active');
      loadStats();
    } else if (page === 'masjid-list') {
      document.getElementById('page-masjid-list').style.display = 'block';
      document.getElementById('nav-masjid').classList.add('active');
      loadMasjidList();
    } else if (page === 'masjid-form') {
      document.getElementById('page-masjid-form').style.display = 'block';
      document.getElementById('nav-masjid').classList.add('active');
      initMasjidForm(data || null);
    } else if (page === 'review-list') {
      document.getElementById('page-review-list').style.display = 'block';
      document.getElementById('nav-reviews').classList.add('active');
      loadReviewList();
    } else if (page === 'review-form') {
      document.getElementById('page-review-form').style.display = 'block';
      document.getElementById('nav-reviews').classList.add('active');
      initReviewForm(data || null);
    } else if (page === 'user-list') {
      document.getElementById('page-user-list').style.display = 'block';
      document.getElementById('nav-users').classList.add('active');
      loadUserList();
    } else if (page === 'user-detail') {
      document.getElementById('page-user-detail').style.display = 'block';
      document.getElementById('nav-users').classList.add('active');
      if (data) loadUserDetail(data);
    } else if (page === 'admin-list') {
      document.getElementById('page-admin-list').style.display = 'block';
      document.getElementById('nav-admin').classList.add('active');
      loadAdminList();
    }
  }

  function safeText(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Masjid List ──

  async function loadMasjidList() {
    var container = document.getElementById('masjid-table-container');
    container.innerHTML = '<div class="loading-text">Memuat data masjid...</div>';
    try {
      var res = await fetch('/api/masjids');
      if (!res.ok) throw new Error();
      var data = await res.json();
      masjidList = data.results || data;
      renderMasjidFilters();
      renderMasjidTable();
    } catch(e) {
      container.innerHTML = '<div class="loading-text">Gagal memuat data masjid</div>';
    }
  }

  function renderMasjidFilters() {
    var counts = { all: masjidList.length, approved: 0, pending: 0, rejected: 0 };
    for (var i = 0; i < masjidList.length; i++) {
      var s = masjidList[i].status || 'approved';
      if (counts[s] !== undefined) counts[s]++;
    }
    var tabs = [
      { key: 'all', label: 'Semua' },
      { key: 'approved', label: 'Approved' },
      { key: 'pending', label: 'Pending' },
      { key: 'rejected', label: 'Rejected' }
    ];
    var html = '';
    for (var i = 0; i < tabs.length; i++) {
      var t = tabs[i];
      var active = masjidFilter === t.key ? ' active' : '';
      html += '<button class="filter-tab' + active + '" onclick="setMasjidFilter(\\'' + t.key + '\\')">' +
        t.label + '<span class="tab-badge">' + counts[t.key] + '</span></button>';
    }
    document.getElementById('masjid-filter-tabs').innerHTML = '<div class="filter-tabs">' + html + '</div>';
  }

  function setMasjidFilter(f) {
    masjidFilter = f;
    selectedMasjidIds.clear();
    renderMasjidFilters();
    renderMasjidTable();
  }

  function renderMasjidTable() {
    var filtered = [];
    for (var i = 0; i < masjidList.length; i++) {
      var m = masjidList[i];
      var s = m.status || 'approved';
      if (masjidFilter === 'all' || s === masjidFilter) filtered.push(m);
    }

    if (filtered.length === 0) {
      document.getElementById('masjid-table-container').innerHTML =
        '<div class="empty-state"><div class="empty-state-icon">&#128332;</div>' +
        '<div class="empty-state-text">Tidak ada masjid ' + (masjidFilter !== 'all' ? 'dengan status ' + masjidFilter : '') + '</div></div>';
      return;
    }

    var html = '<table class="data-table"><thead><tr>' +
      '<th class="col-check"><input type="checkbox" class="row-checkbox" onchange="toggleAllMasjid(this)" id="masjid-select-all"></th>' +
      '<th>Nama</th><th>Kota</th><th>Status</th><th>Aksi</th>' +
      '</tr></thead><tbody>';

    for (var i = 0; i < filtered.length; i++) {
      var m = filtered[i];
      var s = m.status || 'approved';
      var badgeClass = 'badge badge-' + s;
      var statusLabel = s.charAt(0).toUpperCase() + s.slice(1);
      var checked = selectedMasjidIds.has(m.id) ? ' checked' : '';

      var actions = '<div class="td-actions">';
      actions += '<button class="btn-sm btn-outline" onclick="editMasjid(\\'' + m.id + '\\')">Edit</button>';

      if (s === 'pending') {
        actions += '<button class="btn-sm btn-green" onclick="setMasjidStatus(\\'' + m.id + '\\',\\'approved\\')">Approve</button>';
        actions += '<button class="btn-sm btn-outline" onclick="setMasjidStatus(\\'' + m.id + '\\',\\'rejected\\')">Reject</button>';
        actions += '<button class="btn-sm btn-yellow" onclick="checkSimilar(\\'' + m.id + '\\')">Cek Duplikat</button>';
      }

      if (currentAdmin && currentAdmin.role === 'super_admin') {
        actions += '<button class="btn-sm btn-red" onclick="confirmDeleteMasjid(\\'' + m.id + '\\',\\'' + safeText(m.name) + '\\')">Hapus</button>';
      }
      actions += '</div>';

      html += '<tr>' +
        '<td class="col-check"><input type="checkbox" class="row-checkbox" value="' + m.id + '" onchange="toggleMasjidCheck(this)"' + checked + '></td>' +
        '<td>' + safeText(m.name) + '</td>' +
        '<td>' + safeText(m.city) + '</td>' +
        '<td><span class="' + badgeClass + '">' + statusLabel + '</span></td>' +
        '<td>' + actions + '</td>' +
        '</tr>';
    }
    html += '</tbody></table>';
    document.getElementById('masjid-table-container').innerHTML = html;
    updateMasjidBulkBar();
  }

  function editMasjid(id) {
    var m = null;
    for (var i = 0; i < masjidList.length; i++) {
      if (masjidList[i].id === id) { m = masjidList[i]; break; }
    }
    if (m) navigateTo('masjid-form', m);
  }

  // ── Masjid Form ──

  function initMasjidForm(masjid) {
    editingMasjidId = masjid ? masjid.id : null;
    document.getElementById('form-title').textContent = masjid ? 'Edit Masjid' : 'Tambah Masjid';
    document.getElementById('form-save-btn').textContent = masjid ? 'Perbarui' : 'Simpan';
    document.getElementById('similar-alert-container').innerHTML = '';

    // Text fields
    var textFields = ['name','city','address','photo_url','google_maps_url','latitude','longitude','ig_post_url','info_label'];
    for (var i = 0; i < textFields.length; i++) {
      var el = document.getElementById('f-' + textFields[i]);
      if (el) el.value = (masjid && masjid[textFields[i]]) ? masjid[textFields[i]] : '';
    }

    // Photo preview
    var preview = document.getElementById('photo-preview');
    var photoUrl = document.getElementById('f-photo_url').value;
    if (photoUrl) { preview.src = photoUrl; preview.style.display = 'block'; }
    else { preview.style.display = 'none'; }
    document.getElementById('photo-upload-status').textContent = '';

    // Toggle fields
    var toggleFields = ['ramadan_takjil','ramadan_makanan_berat','ramadan_ceramah_tarawih','ramadan_mushaf_alquran','ramadan_itikaf','ramadan_parkir','akhwat_wudhu_private','akhwat_mukena_available','akhwat_ac_available','akhwat_safe_entrance'];
    for (var i = 0; i < toggleFields.length; i++) {
      var el = document.getElementById('f-' + toggleFields[i]);
      if (el) el.checked = masjid ? (masjid[toggleFields[i]] === 'ya') : false;
    }

    // Selects
    document.getElementById('f-ramadan_rakaat').value = (masjid && masjid.ramadan_rakaat) ? String(masjid.ramadan_rakaat) : '';
    document.getElementById('f-ramadan_tempo').value = (masjid && masjid.ramadan_tempo) ? masjid.ramadan_tempo : '';

    // Info photos
    var photoContainer = document.getElementById('info-photos-container');
    photoContainer.innerHTML = '';
    if (masjid && masjid.info_photos) {
      try {
        var photos = JSON.parse(masjid.info_photos);
        for (var i = 0; i < photos.length; i++) addInfoPhotoRow(photos[i]);
      } catch(e) {}
    }
  }

  function addInfoPhotoRow(url) {
    var container = document.getElementById('info-photos-container');
    var rows = container.getElementsByClassName('photo-url-row');
    if (rows.length >= 5) { showToast('Maksimal 5 foto info', 'error'); return; }
    var div = document.createElement('div');
    div.className = 'photo-url-row';
    div.innerHTML = '<input type="url" class="info-photo-input" placeholder="https://..." value="' + safeText(url || '') + '" />' +
      '<button type="button" class="btn-upload-photo" onclick="triggerInfoPhotoUpload(this)">📷</button>' +
      '<input type="file" accept="image/*" style="display:none" onchange="handleInfoPhotoUpload(this)" />' +
      '<button type="button" class="btn-remove-photo" onclick="removeInfoPhotoRow(this)">&times;</button>';
    container.appendChild(div);
  }

  function removeInfoPhotoRow(btn) {
    btn.parentElement.remove();
  }

  function triggerPhotoUpload() {
    document.getElementById('photo-upload-input').click();
  }

  async function handlePhotoUpload(input) {
    if (!input.files[0]) return;
    var statusEl = document.getElementById('photo-upload-status');
    statusEl.textContent = 'Mengupload...';
    try {
      var fd = new FormData();
      fd.append('file', input.files[0]);
      fd.append('prefix', 'masjid');
      var res = await fetch('/api/upload', { method: 'POST', body: fd });
      var data = await res.json();
      if (data.ok) {
        document.getElementById('f-photo_url').value = data.url;
        var preview = document.getElementById('photo-preview');
        preview.src = data.url;
        preview.style.display = 'block';
        statusEl.textContent = '✅ Uploaded';
      } else {
        statusEl.textContent = '❌ ' + (data.error || 'Gagal');
      }
    } catch (e) {
      statusEl.textContent = '❌ Upload gagal';
    }
    input.value = '';
  }

  function triggerInfoPhotoUpload(btn) {
    btn.nextElementSibling.click();
  }

  async function handleInfoPhotoUpload(input) {
    if (!input.files[0]) return;
    var row = input.closest('.photo-url-row');
    var urlInput = row.querySelector('.info-photo-input');
    urlInput.placeholder = 'Mengupload...';
    try {
      var fd = new FormData();
      fd.append('file', input.files[0]);
      fd.append('prefix', 'info');
      var res = await fetch('/api/upload', { method: 'POST', body: fd });
      var data = await res.json();
      if (data.ok) {
        urlInput.value = data.url;
        urlInput.placeholder = 'https://...';
        showToast('Foto berhasil diupload', 'success');
      } else {
        urlInput.placeholder = 'https://...';
        showToast(data.error || 'Gagal upload', 'error');
      }
    } catch (e) {
      urlInput.placeholder = 'https://...';
      showToast('Upload gagal', 'error');
    }
    input.value = '';
  }

  function collectFormData() {
    var data = {};
    data.name = document.getElementById('f-name').value.trim();
    data.city = document.getElementById('f-city').value.trim();
    data.address = document.getElementById('f-address').value.trim();
    data.photo_url = document.getElementById('f-photo_url').value.trim();
    data.google_maps_url = document.getElementById('f-google_maps_url').value.trim();
    data.latitude = document.getElementById('f-latitude').value.trim();
    data.longitude = document.getElementById('f-longitude').value.trim();
    data.ig_post_url = document.getElementById('f-ig_post_url').value.trim();
    data.info_label = document.getElementById('f-info_label').value.trim();

    // Info photos
    var photoInputs = document.getElementsByClassName('info-photo-input');
    var photos = [];
    for (var i = 0; i < photoInputs.length; i++) {
      var v = photoInputs[i].value.trim();
      if (v) photos.push(v);
    }
    data.info_photos = photos.length > 0 ? JSON.stringify(photos) : '';

    // Toggles
    var toggleFields = ['ramadan_takjil','ramadan_makanan_berat','ramadan_ceramah_tarawih','ramadan_mushaf_alquran','ramadan_itikaf','ramadan_parkir','akhwat_wudhu_private','akhwat_mukena_available','akhwat_ac_available','akhwat_safe_entrance'];
    for (var i = 0; i < toggleFields.length; i++) {
      data[toggleFields[i]] = document.getElementById('f-' + toggleFields[i]).checked ? 'ya' : 'tidak';
    }

    // Selects
    data.ramadan_rakaat = document.getElementById('f-ramadan_rakaat').value || null;
    data.ramadan_tempo = document.getElementById('f-ramadan_tempo').value || null;

    return data;
  }

  async function saveMasjid() {
    var data = collectFormData();
    if (!data.name || !data.city) {
      showToast('Nama dan Kota wajib diisi', 'error');
      return;
    }

    var btn = document.getElementById('form-save-btn');
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';

    try {
      var url = editingMasjidId ? '/api/masjids/' + editingMasjidId : '/api/masjids';
      var method = editingMasjidId ? 'PUT' : 'POST';
      var res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      var result = await res.json();
      if (!res.ok) {
        showToast(result.error || 'Gagal menyimpan', 'error');
        return;
      }
      showToast(editingMasjidId ? 'Masjid berhasil diperbarui' : 'Masjid berhasil ditambahkan', 'success');
      navigateTo('masjid-list');
    } catch(e) {
      showToast('Terjadi kesalahan jaringan', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = editingMasjidId ? 'Perbarui' : 'Simpan';
    }
  }

  // ── Status / Delete / Similar ──

  async function setMasjidStatus(id, status) {
    try {
      var res = await fetch('/api/masjids/' + id + '/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: status }),
      });
      if (!res.ok) { var d = await res.json(); showToast(d.error || 'Gagal', 'error'); return; }
      showToast('Status diubah ke ' + status, 'success');
      loadMasjidList();
    } catch(e) {
      showToast('Terjadi kesalahan jaringan', 'error');
    }
  }

  function confirmDeleteMasjid(id, name) {
    document.getElementById('confirm-container').innerHTML =
      '<div class="confirm-overlay" onclick="closeConfirm()">' +
        '<div class="confirm-box" onclick="event.stopPropagation()">' +
          '<h3>Hapus Masjid?</h3>' +
          '<p>Apakah Anda yakin ingin menghapus <strong>' + safeText(name) + '</strong>? Tindakan ini tidak dapat dibatalkan.</p>' +
          '<div class="confirm-actions">' +
            '<button class="btn-sm btn-outline" onclick="closeConfirm()">Batal</button>' +
            '<button class="btn-sm btn-red" onclick="deleteMasjid(\\'' + id + '\\')">Hapus</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  async function deleteMasjid(id) {
    closeConfirm();
    try {
      var res = await fetch('/api/masjids/' + id, { method: 'DELETE' });
      if (!res.ok) { var d = await res.json(); showToast(d.error || 'Gagal menghapus', 'error'); return; }
      showToast('Masjid berhasil dihapus', 'success');
      loadMasjidList();
    } catch(e) {
      showToast('Terjadi kesalahan jaringan', 'error');
    }
  }

  function closeConfirm() {
    document.getElementById('confirm-container').innerHTML = '';
  }

  async function checkSimilar(id) {
    try {
      var res = await fetch('/api/masjids/' + id + '/similar');
      if (!res.ok) throw new Error();
      var data = await res.json();
      var results = data.results || data;
      if (results.length === 0) {
        showToast('Tidak ada masjid yang mirip ditemukan', 'success');
        return;
      }
      var html = '<div class="similar-box"><div class="similar-box-title">&#9888; Ditemukan ' + results.length + ' masjid yang mirip</div><ul>';
      for (var i = 0; i < results.length; i++) {
        html += '<li>' + safeText(results[i].name) + ' — ' + safeText(results[i].city) + ' (' + results[i].status + ')</li>';
      }
      html += '</ul></div>';
      // Show as toast-like or inline — let's show as a confirm-style dialog
      document.getElementById('confirm-container').innerHTML =
        '<div class="confirm-overlay" onclick="closeConfirm()">' +
          '<div class="confirm-box" onclick="event.stopPropagation()" style="text-align:left;max-width:500px">' +
            html +
            '<div class="confirm-actions" style="justify-content:flex-end;margin-top:12px">' +
              '<button class="btn-sm btn-outline" onclick="closeConfirm()">Tutup</button>' +
            '</div>' +
          '</div>' +
        '</div>';
    } catch(e) {
      showToast('Gagal memeriksa duplikat', 'error');
    }
  }

  // ── Masjid Bulk Actions ──

  function toggleAllMasjid(el) {
    var checkboxes = document.querySelectorAll('#masjid-table-container .row-checkbox[value]');
    for (var i = 0; i < checkboxes.length; i++) {
      checkboxes[i].checked = el.checked;
      if (el.checked) selectedMasjidIds.add(checkboxes[i].value);
      else selectedMasjidIds.delete(checkboxes[i].value);
    }
    updateMasjidBulkBar();
  }

  function toggleMasjidCheck(el) {
    if (el.checked) selectedMasjidIds.add(el.value);
    else selectedMasjidIds.delete(el.value);
    updateMasjidBulkBar();
  }

  function updateMasjidBulkBar() {
    var bar = document.getElementById('masjid-bulk-bar');
    var countEl = document.getElementById('masjid-bulk-count');
    var selectAll = document.getElementById('masjid-select-all');
    var checkboxes = document.querySelectorAll('#masjid-table-container .row-checkbox[value]');
    var checkedCount = 0;
    for (var i = 0; i < checkboxes.length; i++) { if (checkboxes[i].checked) checkedCount++; }
    bar.classList.toggle('visible', checkedCount > 0);
    countEl.textContent = checkedCount + ' dipilih';
    if (selectAll) {
      selectAll.checked = checkedCount > 0 && checkedCount === checkboxes.length;
      selectAll.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
    }
  }

  async function bulkMasjidAction(status) {
    var ids = Array.from(selectedMasjidIds);
    if (!ids.length) return;
    var btns = document.querySelectorAll('#masjid-bulk-bar button');
    for (var i = 0; i < btns.length; i++) { btns[i].disabled = true; btns[i].textContent = 'Processing...'; }
    try {
      var res = await fetch('/api/masjids/bulk-status', {
        method: 'PATCH', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: ids, status: status })
      });
      var data = await res.json();
      if (data.ok) {
        showToast(data.updated + ' masjid ' + (status === 'approved' ? 'approved' : 'rejected'), 'success');
        selectedMasjidIds.clear();
        loadMasjidList();
      } else { showToast(data.error || 'Gagal', 'error'); }
    } catch (e) { showToast('Terjadi kesalahan', 'error'); }
  }

  // ── Review List ──

  async function loadReviewList() {
    var container = document.getElementById('review-table-container');
    container.innerHTML = '<div class="loading-text">Memuat data review...</div>';
    try {
      var res = await fetch('/api/reviews');
      if (!res.ok) throw new Error();
      var data = await res.json();
      reviewList = data.results || data;
      renderReviewFilters();
      renderReviewTable();
    } catch(e) {
      container.innerHTML = '<div class="loading-text">Gagal memuat data review</div>';
    }
  }

  function renderReviewFilters() {
    var counts = { all: reviewList.length, approved: 0, pending: 0, rejected: 0 };
    for (var i = 0; i < reviewList.length; i++) {
      var s = reviewList[i].status || 'pending';
      if (counts[s] !== undefined) counts[s]++;
    }
    var tabs = [
      { key: 'all', label: 'Semua' },
      { key: 'approved', label: 'Approved' },
      { key: 'pending', label: 'Pending' },
      { key: 'rejected', label: 'Rejected' }
    ];
    var html = '';
    for (var i = 0; i < tabs.length; i++) {
      var t = tabs[i];
      var active = reviewFilter === t.key ? ' active' : '';
      html += '<button class="filter-tab' + active + '" onclick="setReviewFilter(\\'' + t.key + '\\')">' +
        t.label + '<span class="tab-badge">' + counts[t.key] + '</span></button>';
    }
    document.getElementById('review-filter-tabs').innerHTML = '<div class="filter-tabs">' + html + '</div>';
  }

  function setReviewFilter(f) {
    reviewFilter = f;
    selectedReviewIds.clear();
    renderReviewFilters();
    renderReviewTable();
  }

  // ── Review Bulk Actions ──

  function toggleAllReview(el) {
    var checkboxes = document.querySelectorAll('#review-table-container .row-checkbox[value]');
    for (var i = 0; i < checkboxes.length; i++) {
      checkboxes[i].checked = el.checked;
      if (el.checked) selectedReviewIds.add(checkboxes[i].value);
      else selectedReviewIds.delete(checkboxes[i].value);
    }
    updateReviewBulkBar();
  }

  function toggleReviewCheck(el) {
    if (el.checked) selectedReviewIds.add(el.value);
    else selectedReviewIds.delete(el.value);
    updateReviewBulkBar();
  }

  function updateReviewBulkBar() {
    var bar = document.getElementById('review-bulk-bar');
    var countEl = document.getElementById('review-bulk-count');
    var selectAll = document.getElementById('review-select-all');
    var checkboxes = document.querySelectorAll('#review-table-container .row-checkbox[value]');
    var checkedCount = 0;
    for (var i = 0; i < checkboxes.length; i++) { if (checkboxes[i].checked) checkedCount++; }
    bar.classList.toggle('visible', checkedCount > 0);
    countEl.textContent = checkedCount + ' dipilih';
    if (selectAll) {
      selectAll.checked = checkedCount > 0 && checkedCount === checkboxes.length;
      selectAll.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
    }
  }

  async function bulkReviewAction(status) {
    var ids = Array.from(selectedReviewIds);
    if (!ids.length) return;
    var btns = document.querySelectorAll('#review-bulk-bar button');
    for (var i = 0; i < btns.length; i++) { btns[i].disabled = true; btns[i].textContent = 'Processing...'; }
    try {
      var res = await fetch('/api/reviews/bulk-status', {
        method: 'PATCH', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: ids, status: status })
      });
      var data = await res.json();
      if (data.ok) {
        showToast(data.updated + ' review ' + (status === 'approved' ? 'approved' : 'rejected'), 'success');
        selectedReviewIds.clear();
        loadReviewList();
      } else { showToast(data.error || 'Gagal', 'error'); }
    } catch (e) { showToast('Terjadi kesalahan', 'error'); }
  }

  // ── User Management ──

  function formatWA(n) {
    var s = String(n);
    if (s.startsWith('62')) s = '0' + s.slice(2);
    var out = '';
    for (var i = 0; i < s.length; i++) {
      if (i > 0 && i % 4 === 0) out += '-';
      out += s[i];
    }
    return out;
  }

  async function loadUserList() {
    var container = document.getElementById('user-table-container');
    container.innerHTML = '<div class="loading-text">Memuat data users...</div>';
    try {
      var res = await fetch('/api/users');
      if (!res.ok) throw new Error();
      var data = await res.json();
      userList = data;
      renderUserTable();
    } catch (e) {
      container.innerHTML = '<div class="loading-text">Gagal memuat data users</div>';
    }
  }

  function renderUserTable() {
    var container = document.getElementById('user-table-container');
    if (!userList.length) {
      container.innerHTML = '<div class="loading-text">Belum ada user terdaftar</div>';
      return;
    }
    var html = '<table class="data-table"><thead><tr>' +
      '<th>Nama</th><th>WhatsApp</th><th>Kota</th><th>Reviews</th><th>Bergabung</th><th>Aksi</th>' +
      '</tr></thead><tbody>';
    for (var i = 0; i < userList.length; i++) {
      var u = userList[i];
      var dt = u.created_at ? new Date(u.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
      html += '<tr>' +
        '<td>' + safeText(u.name || '-') + '</td>' +
        '<td>' + formatWA(u.wa_number) + '</td>' +
        '<td>' + safeText(u.city || '-') + '</td>' +
        '<td>' + (u.review_count || 0) + '</td>' +
        '<td>' + dt + '</td>' +
        '<td><button class="btn-sm btn-outline" data-uid="' + u.id + '" onclick="navigateTo(\\'user-detail\\', this.dataset.uid)">Detail</button></td>' +
        '</tr>';
    }
    html += '</tbody></table>';
    container.innerHTML = html;
  }

  async function loadUserDetail(id) {
    currentUserId = id;
    var container = document.getElementById('user-detail-container');
    container.innerHTML = '<div class="loading-text">Memuat detail user...</div>';
    document.getElementById('user-detail-title').textContent = 'Detail User';
    try {
      var res = await fetch('/api/users/' + id);
      if (!res.ok) throw new Error();
      var data = await res.json();
      var u = data.user;
      var reviews = data.reviews || [];

      document.getElementById('user-detail-title').textContent = safeText(u.name || 'User');

      var dt = u.created_at ? new Date(u.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-';
      var html = '<div class="user-info-card">' +
        '<div class="user-info-row"><span class="user-info-label">Nama</span><span class="user-info-value">' + safeText(u.name || '-') + '</span></div>' +
        '<div class="user-info-row"><span class="user-info-label">WhatsApp</span><span class="user-info-value">' + formatWA(u.wa_number) + '</span></div>' +
        '<div class="user-info-row"><span class="user-info-label">Kota</span><span class="user-info-value">' + safeText(u.city || '-') + '</span></div>' +
        '<div class="user-info-row"><span class="user-info-label">Bergabung</span><span class="user-info-value">' + dt + '</span></div>' +
        '<div style="margin-top:16px"><button class="btn-sm btn-outline" onclick="openEditUser()">✏️ Edit Profil</button></div>' +
        '</div>';

      // Reviews table
      if (reviews.length > 0) {
        html += '<h3 style="margin-bottom:12px;font-size:16px">Review oleh user ini (' + reviews.length + ')</h3>';
        html += '<table class="data-table"><thead><tr>' +
          '<th>Masjid</th><th>Rating</th><th>Testimoni</th><th>Status</th><th>Tanggal</th><th>Aksi</th>' +
          '</tr></thead><tbody>';
        for (var i = 0; i < reviews.length; i++) {
          var r = reviews[i];
          var rdt = r.created_at ? new Date(r.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
          var statusCls = r.status === 'approved' ? 'badge-approved' : r.status === 'rejected' ? 'badge-rejected' : 'badge-pending';
          html += '<tr>' +
            '<td>' + safeText(r.masjid_name || '-') + '</td>' +
            '<td>⭐ ' + (r.rating || '-') + '</td>' +
            '<td>' + safeText((r.short_description || '').slice(0, 60)) + (r.short_description && r.short_description.length > 60 ? '...' : '') + '</td>' +
            '<td><span class="badge ' + statusCls + '">' + safeText(r.status || 'pending') + '</span></td>' +
            '<td>' + rdt + '</td>' +
            '<td><button class="btn-sm btn-outline" data-rid="' + r.id + '" onclick="editReview(this.dataset.rid)">Edit</button></td>' +
            '</tr>';
        }
        html += '</tbody></table>';
      } else {
        html += '<div class="loading-text" style="margin-top:12px">User ini belum memiliki review</div>';
      }

      container.innerHTML = html;
    } catch (e) {
      container.innerHTML = '<div class="loading-text">Gagal memuat detail user</div>';
    }
  }

  function openEditUser() {
    // Find current user data
    var u = null;
    for (var i = 0; i < userList.length; i++) {
      if (userList[i].id === currentUserId) { u = userList[i]; break; }
    }
    var currentName = u ? (u.name || '') : '';
    var currentCity = u ? (u.city || '') : '';

    var html = '<div class="confirm-overlay" onclick="closeConfirm()">' +
      '<div class="confirm-box" onclick="event.stopPropagation()">' +
      '<h3>Edit User</h3>' +
      '<div class="form-group-admin" style="margin-top:12px">' +
      '<label>Nama</label>' +
      '<input type="text" id="edit-user-name" value="' + safeText(currentName) + '" />' +
      '</div>' +
      '<div class="form-group-admin">' +
      '<label>Kota</label>' +
      '<input type="text" id="edit-user-city" value="' + safeText(currentCity) + '" />' +
      '</div>' +
      '<div class="confirm-actions">' +
      '<button class="btn-sm btn-outline" onclick="closeConfirm()">Batal</button>' +
      '<button class="btn-sm" style="background:var(--green);color:white;border:none" onclick="saveUser()">Simpan</button>' +
      '</div>' +
      '</div></div>';
    document.getElementById('confirm-container').innerHTML = html;
  }

  async function saveUser() {
    var name = document.getElementById('edit-user-name').value.trim();
    var city = document.getElementById('edit-user-city').value.trim();
    if (!name) { showToast('Nama tidak boleh kosong', 'error'); return; }
    try {
      var res = await fetch('/api/users/' + currentUserId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, city: city })
      });
      var data = await res.json();
      if (res.ok) {
        closeConfirm();
        showToast('User berhasil diperbarui', 'success');
        // Update local cache
        for (var i = 0; i < userList.length; i++) {
          if (userList[i].id === currentUserId) {
            userList[i].name = name;
            userList[i].city = city;
            break;
          }
        }
        loadUserDetail(currentUserId);
      } else {
        showToast(data.error || 'Gagal menyimpan', 'error');
      }
    } catch (e) {
      showToast('Terjadi kesalahan', 'error');
    }
  }

  function forceLogoutUser(id, name) {
    var html = '<div class="confirm-overlay" onclick="closeConfirm()">' +
      '<div class="confirm-box" onclick="event.stopPropagation()">' +
      '<h3>Force Logout</h3>' +
      '<p>Hapus semua sesi login untuk <strong>' + safeText(name) + '</strong>? User harus login ulang.</p>' +
      '<div class="confirm-actions">' +
      '<button class="btn-sm btn-outline" onclick="closeConfirm()">Batal</button>' +
      '<button class="btn-sm" style="background:var(--red);color:white;border:none" data-uid="' + id + '" onclick="doForceLogout(this.dataset.uid)">Force Logout</button>' +
      '</div>' +
      '</div></div>';
    document.getElementById('confirm-container').innerHTML = html;
  }

  async function doForceLogout(id) {
    try {
      var res = await fetch('/api/users/' + id + '/force-logout', { method: 'POST' });
      var data = await res.json();
      if (res.ok) {
        closeConfirm();
        showToast('Semua sesi user telah dihapus', 'success');
      } else {
        showToast(data.error || 'Gagal force logout', 'error');
      }
    } catch (e) {
      showToast('Terjadi kesalahan', 'error');
    }
  }

  function forceLogoutFromDetail() {
    if (!currentUserId) return;
    var name = '';
    for (var i = 0; i < userList.length; i++) {
      if (userList[i].id === currentUserId) { name = userList[i].name || 'User'; break; }
    }
    forceLogoutUser(currentUserId, name);
  }

  // ── Admin Management ──

  async function loadAdminList() {
    var container = document.getElementById('admin-table-container');
    container.innerHTML = '<div class="loading-text">Memuat data admin...</div>';
    try {
      var res = await fetch('/api/admins');
      if (!res.ok) throw new Error();
      adminList = await res.json();
      renderAdminTable();
    } catch(e) {
      container.innerHTML = '<div class="loading-text">Gagal memuat data admin</div>';
    }
  }

  function renderAdminTable() {
    var container = document.getElementById('admin-table-container');
    if (adminList.length === 0) {
      container.innerHTML = '<div class="loading-text">Belum ada admin</div>';
      return;
    }
    var html = '<table class="data-table"><thead><tr>' +
      '<th>Nama</th><th>WhatsApp</th><th>Role</th><th>Bergabung</th><th>Aksi</th>' +
      '</tr></thead><tbody>';
    for (var i = 0; i < adminList.length; i++) {
      var a = adminList[i];
      var roleBadge = a.role === 'super_admin'
        ? '<span class="badge badge-super-admin">Super Admin</span>'
        : '<span class="badge badge-admin">Admin</span>';
      var joined = a.created_at ? new Date(a.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '\u2014';
      var actions = '';
      if (a.id !== currentAdmin.id) {
        var roleBtn = '';
        if (a.role === 'admin') {
          roleBtn = '<button class="btn-sm btn-green" data-uid="' + a.id + '" data-uname="' + safeText(a.name) + '" data-role="super_admin" onclick="changeAdminRole(this.dataset.uid, this.dataset.uname, this.dataset.role)">Jadikan Super Admin</button>';
        } else if (a.role === 'super_admin') {
          roleBtn = '<button class="btn-sm btn-outline" data-uid="' + a.id + '" data-uname="' + safeText(a.name) + '" data-role="admin" onclick="changeAdminRole(this.dataset.uid, this.dataset.uname, this.dataset.role)">Jadikan Admin</button>';
        }
        actions = '<div class="td-actions">' + roleBtn +
          '<button class="btn-sm btn-red" data-uid="' + a.id + '" data-uname="' + safeText(a.name) + '" onclick="confirmDemoteAdmin(this.dataset.uid, this.dataset.uname)">Demote</button>' +
          '</div>';
      }
      html += '<tr>' +
        '<td>' + safeText(a.name) + '</td>' +
        '<td>' + formatWA(a.wa_number) + '</td>' +
        '<td>' + roleBadge + '</td>' +
        '<td>' + joined + '</td>' +
        '<td>' + actions + '</td>' +
        '</tr>';
    }
    html += '</tbody></table>';
    container.innerHTML = html;
  }

  function showPromoteAdmin() {
    var html = '<div class="confirm-overlay" onclick="closeConfirm()">' +
      '<div class="confirm-box" onclick="event.stopPropagation()" style="max-width:460px">' +
      '<h3>Promote User ke Admin</h3>' +
      '<div class="form-group-admin">' +
      '<label>Cari User (nama atau nomor WA)</label>' +
      '<input type="text" id="promote-search" placeholder="Ketik minimal 3 karakter..." oninput="searchUsersForPromote()" />' +
      '</div>' +
      '<div class="form-group-admin">' +
      '<label>Role</label>' +
      '<select id="promote-role-select" style="width:100%;padding:8px 10px;border:1px solid #d0d7de;border-radius:6px;font-size:14px">' +
      '<option value="admin" selected>Admin</option>' +
      '<option value="super_admin">Super Admin</option>' +
      '</select>' +
      '</div>' +
      '<div id="promote-search-results" style="max-height:200px;overflow-y:auto;margin-bottom:12px"></div>' +
      '<div class="confirm-actions">' +
      '<button class="btn-sm btn-outline" onclick="closeConfirm()">Batal</button>' +
      '</div>' +
      '</div></div>';
    document.getElementById('confirm-container').innerHTML = html;
  }

  var promoteSearchTimeout = null;

  async function searchUsersForPromote() {
    var q = document.getElementById('promote-search').value.trim();
    var container = document.getElementById('promote-search-results');
    if (q.length < 3) {
      container.innerHTML = '<div style="font-size:13px;color:var(--text-3);padding:8px">Ketik minimal 3 karakter</div>';
      return;
    }
    clearTimeout(promoteSearchTimeout);
    promoteSearchTimeout = setTimeout(async function() {
      try {
        var res = await fetch('/api/users/search?q=' + encodeURIComponent(q));
        if (!res.ok) throw new Error();
        var users = await res.json();
        if (users.length === 0) {
          container.innerHTML = '<div style="font-size:13px;color:var(--text-3);padding:8px">Tidak ada user ditemukan</div>';
          return;
        }
        var html = '';
        for (var i = 0; i < users.length; i++) {
          var u = users[i];
          html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">' +
            '<div><strong>' + safeText(u.name) + '</strong><br><span style="font-size:12px;color:var(--text-3)">' + formatWA(u.wa_number) + '</span></div>' +
            '<button class="btn-sm btn-green" data-uid="' + u.id + '" data-uname="' + safeText(u.name) + '" onclick="submitPromoteAdmin(this.dataset.uid, this.dataset.uname, document.getElementById(\\'promote-role-select\\').value)">Promote</button>' +
            '</div>';
        }
        container.innerHTML = html;
      } catch(e) {
        container.innerHTML = '<div style="font-size:13px;color:var(--text-3);padding:8px">Gagal mencari user</div>';
      }
    }, 300);
  }

  async function submitPromoteAdmin(userId, userName, role) {
    var roleLabel = role === 'super_admin' ? 'Super Admin' : 'Admin';
    try {
      var res = await fetch('/api/users/' + userId + '/role', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: role })
      });
      var data = await res.json();
      if (res.ok) {
        closeConfirm();
        showToast(userName + ' berhasil dipromote menjadi ' + roleLabel, 'success');
        loadAdminList();
      } else {
        showToast(data.error || 'Gagal promote admin', 'error');
      }
    } catch (e) {
      showToast('Terjadi kesalahan', 'error');
    }
  }

  function confirmDemoteAdmin(id, name) {
    document.getElementById('confirm-container').innerHTML =
      '<div class="confirm-overlay" onclick="closeConfirm()">' +
        '<div class="confirm-box" onclick="event.stopPropagation()">' +
          '<h3>Demote Admin?</h3>' +
          '<p>Apakah Anda yakin ingin menghapus akses admin untuk <strong>' + safeText(name) + '</strong>? User tetap terdaftar tetapi tidak bisa mengakses admin panel.</p>' +
          '<div class="confirm-actions">' +
            '<button class="btn-sm btn-outline" onclick="closeConfirm()">Batal</button>' +
            '<button class="btn-sm btn-red" data-uid="' + id + '" onclick="demoteAdmin(this.dataset.uid)">Demote</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  async function demoteAdmin(id) {
    try {
      var res = await fetch('/api/users/' + id + '/role', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'user' })
      });
      var data = await res.json();
      if (res.ok) {
        closeConfirm();
        showToast('Admin berhasil di-demote', 'success');
        loadAdminList();
      } else {
        showToast(data.error || 'Gagal demote admin', 'error');
      }
    } catch (e) {
      showToast('Terjadi kesalahan', 'error');
    }
  }

  async function changeAdminRole(id, name, newRole) {
    var roleLabel = newRole === 'super_admin' ? 'Super Admin' : 'Admin';
    try {
      var res = await fetch('/api/users/' + id + '/role', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });
      var data = await res.json();
      if (res.ok) {
        showToast(name + ' berhasil diubah menjadi ' + roleLabel, 'success');
        loadAdminList();
      } else {
        showToast(data.error || 'Gagal mengubah role', 'error');
      }
    } catch (e) {
      showToast('Terjadi kesalahan', 'error');
    }
  }

  function renderReviewTable() {
    var filtered = [];
    for (var i = 0; i < reviewList.length; i++) {
      var r = reviewList[i];
      var s = r.status || 'pending';
      if (reviewFilter === 'all' || s === reviewFilter) filtered.push(r);
    }

    if (filtered.length === 0) {
      document.getElementById('review-table-container').innerHTML =
        '<div class="empty-state"><div class="empty-state-icon">&#128172;</div>' +
        '<div class="empty-state-text">Tidak ada review ' + (reviewFilter !== 'all' ? 'dengan status ' + reviewFilter : '') + '</div></div>';
      return;
    }

    var html = '<table class="data-table"><thead><tr>' +
      '<th class="col-check"><input type="checkbox" class="row-checkbox" onchange="toggleAllReview(this)" id="review-select-all"></th>' +
      '<th>Reviewer</th><th>Masjid</th><th>Rating</th><th>Testimoni</th><th>Status</th><th>Tanggal</th><th>Aksi</th>' +
      '</tr></thead><tbody>';

    for (var i = 0; i < filtered.length; i++) {
      var r = filtered[i];
      var s = r.status || 'pending';
      var badgeClass = 'badge badge-' + s;
      var statusLabel = s.charAt(0).toUpperCase() + s.slice(1);
      var reviewerName = safeText(r.reviewer_name || 'Anonim');
      var masjidName = safeText(r.masjid_name || '-');
      var rating = r.rating ? Number(r.rating).toFixed(1) : '-';
      var testimoni = safeText((r.short_description || '').substring(0, 50)) + (r.short_description && r.short_description.length > 50 ? '...' : '');
      var date = r.created_at ? r.created_at.substring(0, 10) : '-';
      var checked = selectedReviewIds.has(r.id) ? ' checked' : '';

      var actions = '<div class="td-actions">';
      actions += '<button class="btn-sm btn-outline" onclick="editReview(\\'' + r.id + '\\')">Edit</button>';

      if (s === 'pending') {
        actions += '<button class="btn-sm btn-green" onclick="setReviewStatus(\\'' + r.id + '\\',\\'approved\\')">Approve</button>';
        actions += '<button class="btn-sm btn-outline" onclick="setReviewStatus(\\'' + r.id + '\\',\\'rejected\\')">Reject</button>';
      } else if (s === 'approved') {
        actions += '<button class="btn-sm btn-outline" onclick="setReviewStatus(\\'' + r.id + '\\',\\'rejected\\')">Reject</button>';
      } else if (s === 'rejected') {
        actions += '<button class="btn-sm btn-green" onclick="setReviewStatus(\\'' + r.id + '\\',\\'approved\\')">Approve</button>';
      }

      if (currentAdmin && currentAdmin.role === 'super_admin') {
        actions += '<button class="btn-sm btn-red" onclick="confirmDeleteReview(\\'' + r.id + '\\',\\'' + safeText(r.reviewer_name || 'Anonim') + '\\')">Hapus</button>';
      }
      actions += '</div>';

      html += '<tr>' +
        '<td class="col-check"><input type="checkbox" class="row-checkbox" value="' + r.id + '" onchange="toggleReviewCheck(this)"' + checked + '></td>' +
        '<td>' + reviewerName + '</td>' +
        '<td>' + masjidName + '</td>' +
        '<td>' + rating + '</td>' +
        '<td>' + testimoni + '</td>' +
        '<td><span class="' + badgeClass + '">' + statusLabel + '</span></td>' +
        '<td>' + date + '</td>' +
        '<td>' + actions + '</td>' +
        '</tr>';
    }
    html += '</tbody></table>';
    document.getElementById('review-table-container').innerHTML = html;
    updateReviewBulkBar();
  }

  function editReview(id) {
    var r = null;
    for (var i = 0; i < reviewList.length; i++) {
      if (reviewList[i].id === id) { r = reviewList[i]; break; }
    }
    if (r) navigateTo('review-form', r);
  }

  // ── Review Form ──

  async function initReviewForm(review) {
    editingReviewId = review ? review.id : null;
    document.getElementById('review-form-title').textContent = review ? 'Edit Review' : 'Tambah Review';
    document.getElementById('review-save-btn').textContent = review ? 'Perbarui' : 'Simpan';

    // Populate masjid dropdown
    var select = document.getElementById('rf-masjid_id');
    select.innerHTML = '<option value="">— Pilih Masjid —</option>';
    try {
      var res = await fetch('/api/masjids?status=approved');
      if (res.ok) {
        var masjids = await res.json();
        var list = masjids.results || masjids;
        for (var i = 0; i < list.length; i++) {
          var opt = document.createElement('option');
          opt.value = list[i].id;
          opt.textContent = list[i].name;
          select.appendChild(opt);
        }
      }
    } catch(e) {}

    // Fill form fields
    document.getElementById('rf-reviewer_name').value = (review && review.reviewer_name) ? review.reviewer_name : '';
    document.getElementById('rf-masjid_id').value = (review && review.masjid_id) ? review.masjid_id : '';
    document.getElementById('rf-rating').value = (review && review.rating) ? review.rating : '';
    document.getElementById('rf-source_platform').value = (review && review.source_platform) ? review.source_platform : '';
    document.getElementById('rf-short_description').value = (review && review.short_description) ? review.short_description : '';
    document.getElementById('rf-source_url').value = (review && review.source_url) ? review.source_url : '';
  }

  function collectReviewData() {
    var data = {};
    data.reviewer_name = document.getElementById('rf-reviewer_name').value.trim();
    data.masjid_id = document.getElementById('rf-masjid_id').value;
    data.rating = document.getElementById('rf-rating').value ? parseFloat(document.getElementById('rf-rating').value) : null;
    data.source_platform = document.getElementById('rf-source_platform').value;
    data.short_description = document.getElementById('rf-short_description').value.trim();
    data.source_url = document.getElementById('rf-source_url').value.trim();
    return data;
  }

  async function saveReview() {
    var data = collectReviewData();
    if (!data.masjid_id) {
      showToast('Masjid wajib dipilih', 'error');
      return;
    }

    var btn = document.getElementById('review-save-btn');
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';

    try {
      var url = '/api/reviews/' + editingReviewId;
      var res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      var result = await res.json();
      if (!res.ok) {
        showToast(result.error || 'Gagal menyimpan', 'error');
        return;
      }
      showToast('Review berhasil diperbarui', 'success');
      navigateTo('review-list');
    } catch(e) {
      showToast('Terjadi kesalahan jaringan', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = editingReviewId ? 'Perbarui' : 'Simpan';
    }
  }

  async function setReviewStatus(id, status) {
    try {
      var res = await fetch('/api/reviews/' + id + '/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: status }),
      });
      if (!res.ok) { var d = await res.json(); showToast(d.error || 'Gagal', 'error'); return; }
      showToast('Status review diubah ke ' + status, 'success');
      loadReviewList();
    } catch(e) {
      showToast('Terjadi kesalahan jaringan', 'error');
    }
  }

  function confirmDeleteReview(id, name) {
    document.getElementById('confirm-container').innerHTML =
      '<div class="confirm-overlay" onclick="closeConfirm()">' +
        '<div class="confirm-box" onclick="event.stopPropagation()">' +
          '<h3>Hapus Review?</h3>' +
          '<p>Apakah Anda yakin ingin menghapus review dari <strong>' + safeText(name) + '</strong>? Tindakan ini tidak dapat dibatalkan.</p>' +
          '<div class="confirm-actions">' +
            '<button class="btn-sm btn-outline" onclick="closeConfirm()">Batal</button>' +
            '<button class="btn-sm btn-red" onclick="deleteReview(\\'' + id + '\\')">Hapus</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  async function deleteReview(id) {
    closeConfirm();
    try {
      var res = await fetch('/api/reviews/' + id, { method: 'DELETE' });
      if (!res.ok) { var d = await res.json(); showToast(d.error || 'Gagal menghapus', 'error'); return; }
      showToast('Review berhasil dihapus', 'success');
      loadReviewList();
    } catch(e) {
      showToast('Terjadi kesalahan jaringan', 'error');
    }
  }

  // ── Toast ──

  function showToast(msg, type) {
    var container = document.getElementById('toast-container');
    var toast = document.createElement('div');
    toast.className = 'toast toast-' + (type || 'success');
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(function() { toast.remove(); }, 3000);
  }

  init();
</script>
</body>
</html>`;

// ── AI Extraction System Prompt ──

const AI_SYSTEM_PROMPT = `Kamu adalah asisten yang mengekstrak data review masjid dari pesan WhatsApp berbahasa Indonesia.

Dari teks yang diberikan, ekstrak informasi berikut dalam format JSON array (karena satu pesan bisa berisi review untuk lebih dari 1 masjid):

[
  {
    "masjid_name": "nama masjid yang disebutkan",
    "city": "kota jika disebutkan, null jika tidak",
    "rating": angka 1-5 jika disebutkan, null jika tidak,
    "review_text": "ringkasan testimoni/review dari pengirim"
  }
]

Aturan:
- Selalu kembalikan JSON array, bahkan jika hanya 1 review
- Jika tidak ada review masjid dalam pesan, kembalikan array kosong []
- Jangan mengarang informasi yang tidak ada dalam teks
- Rating bisa dalam format "4/5", "4.5", "8/10" (konversi ke skala 1-5)
- review_text harus merangkum opini pengirim, bukan copy paste seluruh teks
- Respond ONLY with the JSON array, no other text`;

// ── Fonnte Reply Helper ──

async function sendFonnteReply(target, message, env) {
  try {
    await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        'Authorization': env.FONNTE_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ target, message }),
    });
  } catch (e) {
    // Reply failure is non-critical — review is already saved
  }
}

// ── Fonnte Webhook Handler ──

async function handleFonnteWebhook(request, env, ctx) {
  // ── Helper: update result in webhook_logs ──
  let logId = null;
  async function logResult(resultObj) {
    if (!logId) return;
    try {
      await env.DB.prepare("UPDATE webhook_logs SET result = ? WHERE id = ?")
        .bind(JSON.stringify(resultObj), logId).run();
    } catch (_) { /* non-critical */ }
  }

  // ── Step 1: Log raw request body for debugging ──
  let rawBody = '';
  try {
    rawBody = await request.text();
    await env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS webhook_logs (id TEXT PRIMARY KEY, raw_body TEXT, result TEXT, created_at TEXT)"
    ).run();
    logId = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO webhook_logs (id, raw_body, result, created_at) VALUES (?, ?, '', datetime('now'))"
    ).bind(logId, rawBody).run();
  } catch (e) {
    // Logging failure should not block processing
  }

  try {
    // ── Step 2: Parse JSON body ──
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch (parseErr) {
      const r = { error: 'Invalid JSON body', parseError: String(parseErr) };
      await logResult(r);
      return json(r, 400);
    }

    if (!body.message || !body.message.trim()) {
      const r = { error: 'Message is required', body_keys: Object.keys(body) };
      await logResult(r);
      return json(r, 400);
    }

    // ── Step 3: Lenient device validation (contains check) ──
    const deviceStr = String(body.device || '');
    if (!deviceStr.includes('6285111043194')) {
      const r = { error: 'Invalid device', device_received: deviceStr };
      await logResult(r);
      return json(r, 400);
    }

    // ── Step 4: Group vs DM logic ──
    const isGroup = body.sender && body.sender.includes('@g.us');
    let message = body.message.trim();

    if (isGroup) {
      // Group: only process if message starts with /review
      if (!/^\/review\b/i.test(message)) {
        const r = { ok: true, extracted: 0, reason: 'no_trigger', isGroup: true };
        await logResult(r);
        return json(r, 200);
      }
      // Strip /review prefix
      message = message.replace(/^\/review\s*/i, '').trim();
    }

    // ── Step 5: Strip @mentions (LID or phone format) from message ──
    message = message.replace(/@\d+/g, '').trim();

    if (!message) {
      const r = { ok: true, extracted: 0, reason: 'empty_after_strip' };
      await logResult(r);
      return json(r, 200);
    }

    // Reviewer name: use name field, fallback to member (group) or sender (DM)
    const senderName = body.name || (isGroup ? body.member : body.sender) || 'Anonim';
    const replyTarget = body.sender; // group ID for groups, phone for DMs

    // Extract sender WA number for review linking
    const senderWA = isGroup ? String(body.member || '') : String(body.sender || '').replace('@s.whatsapp.net', '');

    // Log what we're sending to AI
    await logResult({ step: 'pre_ai', message_to_ai: message, senderName, isGroup, replyTarget });

    // ── Step 6: Call Workers AI for extraction ──
    let aiResponse;
    try {
      aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          { role: 'system', content: AI_SYSTEM_PROMPT },
          { role: 'user', content: message },
        ],
        max_tokens: 1024,
      });
    } catch (aiErr) {
      const r = { ok: false, error: 'AI call failed', detail: String(aiErr) };
      await logResult(r);
      return json(r, 200);
    }

    // Log raw AI response
    const aiRaw = aiResponse.response || '';
    await logResult({ step: 'post_ai', ai_raw: aiRaw.substring(0, 500) });

    // Parse AI response
    let extracted;
    try {
      let raw = aiRaw;
      // Strip markdown code fences if present
      raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      extracted = JSON.parse(raw);
    } catch (parseErr) {
      const r = { ok: false, error: 'AI response not parseable', ai_raw: aiRaw.substring(0, 500), parseError: String(parseErr) };
      await logResult(r);
      ctx.waitUntil(sendFonnteReply(replyTarget, '🤔 Hmm, sepertinya pesanmu bukan review masjid. Coba kirim ulang dengan format:\n\n' + (isGroup ? '/review ' : '') + 'Masjid [Nama]: [pendapatmu]. Rating [1-5]', env));
      return json(r, 200);
    }

    // Validate it's an array
    if (!Array.isArray(extracted)) {
      const r = { ok: false, error: 'AI response is not an array', ai_raw: aiRaw.substring(0, 500), type: typeof extracted };
      await logResult(r);
      return json(r, 200);
    }

    // Empty array = no reviews found in message
    if (extracted.length === 0) {
      const helpMsg = isGroup
        ? '🤔 Hmm, sepertinya pesanmu bukan review masjid. Coba kirim ulang dengan format:\n\n/review Masjid [Nama]: [pendapatmu]. Rating [1-5]'
        : '🤔 Hmm, sepertinya pesanmu bukan review masjid. Coba kirim ulang dengan format seperti:\n\nReview Masjid [Nama]: [pendapatmu]. Rating [1-5]';
      ctx.waitUntil(sendFonnteReply(replyTarget, helpMsg, env));
      const r = { ok: true, extracted: 0, results: [], ai_returned_empty: true };
      await logResult(r);
      return json(r, 200);
    }

    // ── Step 7: Match masjid + create pending reviews ──
    const results = [];
    for (const item of extracted) {
      const masjidName = item.masjid_name || '';
      const city = item.city || null;
      const rating = item.rating != null ? Number(item.rating) : null;
      const reviewText = item.review_text || '';

      if (!masjidName) {
        results.push({ status: 'skipped', reason: 'no masjid name' });
        continue;
      }

      // Fuzzy match masjid
      const matched = await matchMasjid(masjidName, city, env);

      if (matched) {
        // Create pending review
        const reviewId = crypto.randomUUID();
        const matchedUser = senderWA ? await env.DB.prepare("SELECT id FROM users WHERE wa_number = ?").bind(senderWA).first() : null;
        await env.DB.prepare(
          "INSERT INTO reviews (id, masjid_id, reviewer_name, rating, short_description, source_platform, status, wa_number, user_id, created_at) VALUES (?, ?, ?, ?, ?, 'wa_bot', 'pending', ?, ?, datetime('now'))"
        ).bind(
          reviewId,
          matched.id,
          senderName,
          rating,
          reviewText,
          senderWA || null,
          matchedUser ? matchedUser.id : null
        ).run();

        results.push({
          masjid_name: masjidName,
          matched_masjid_id: matched.id,
          matched_masjid_name: matched.name,
          review_id: reviewId,
          status: 'created',
        });
      } else {
        results.push({
          masjid_name: masjidName,
          matched_masjid_id: null,
          review_id: null,
          status: 'masjid_not_found',
        });
      }
    }

    // ── Step 8: Send reply via Fonnte API ──
    let replyMsg = '';
    const createdResults = results.filter(r => r.status === 'created');
    const notFoundResults = results.filter(r => r.status === 'masjid_not_found');

    if (createdResults.length > 0) {
      const masjidNames = createdResults.map(r => '• ' + r.matched_masjid_name).join('\n');
      replyMsg = '✅ Review diterima! Terima kasih 🙏\n\n' +
        'Diekstrak: ' + createdResults.length + ' review\n' +
        masjidNames + '\n\n' +
        'Review akan ditampilkan setelah diverifikasi tim.';
      if (notFoundResults.length > 0) {
        const missing = notFoundResults.map(r => '• ' + r.masjid_name).join('\n');
        replyMsg += '\n\n⚠️ Masjid tidak ditemukan:\n' + missing + '\nTim akan menambahkan masjid ini.';
      }
    } else if (notFoundResults.length > 0) {
      const missing = notFoundResults.map(r => r.masjid_name).join(', ');
      replyMsg = '⚠️ Review diterima tapi masjid tidak ditemukan di database.\n\n' +
        'Masjid yang disebutkan: ' + missing + '\n\n' +
        'Tim akan menambahkan masjid ini terlebih dahulu.';
    }

    // Send reply (fire-and-forget via ctx.waitUntil)
    if (replyMsg) {
      ctx.waitUntil(sendFonnteReply(replyTarget, replyMsg, env));
    }

    const finalResult = { ok: true, extracted: results.length, results };
    await logResult(finalResult);
    return json(finalResult, 200);

  } catch (err) {
    const r = { ok: false, error: 'Webhook processing failed', detail: String(err), stack: String(err.stack || '') };
    await logResult(r);
    return json(r, 200);
  }
}

// ── Worker Entry Point ──

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);

    try {
      // ── POST /webhook/fonnte (no auth required) ──
      if (pathname === '/webhook/fonnte' && request.method === 'POST') {
        return handleFonnteWebhook(request, env, ctx);
      }

      // ── GET /webhook/fonnte (health check for Fonnte) ──
      if (pathname === '/webhook/fonnte' && request.method === 'GET') {
        return json({ ok: true, message: 'Webhook active' });
      }

      // ── POST /auth/otp/request ──
      if (pathname === '/auth/otp/request' && request.method === 'POST') {
        try {
          if (!env.FONNTE_TOKEN) {
            return json({ error: 'OTP service not configured' }, 500);
          }
          const body = await request.json();
          const wa = normalizeWA(body.wa_number);
          if (!wa || wa.length < 10 || wa.length > 15) {
            return json({ error: 'Nomor WhatsApp tidak valid' }, 400);
          }

          // Check user exists with admin role
          const user = await env.DB.prepare(
            "SELECT id, role FROM users WHERE wa_number = ? AND role IN ('admin', 'super_admin')"
          ).bind(wa).first();
          if (!user) {
            return json({ error: 'Nomor WhatsApp tidak terdaftar sebagai admin' }, 403);
          }

          // Rate limit: max 3 OTP per hour
          const recentCount = await env.DB.prepare(
            "SELECT COUNT(*) as cnt FROM otp_codes WHERE wa_number = ? AND created_at > datetime('now', '-1 hour')"
          ).bind(wa).first();
          if (recentCount && recentCount.cnt >= 3) {
            return json({ error: 'Terlalu banyak percobaan. Coba lagi nanti.' }, 429);
          }

          const code = String(Math.floor(100000 + Math.random() * 900000));
          const id = crypto.randomUUID();
          const created_at = new Date().toISOString();
          const expires_at = new Date(Date.now() + 5 * 60 * 1000).toISOString();

          await env.DB.prepare(
            "INSERT INTO otp_codes (id, wa_number, code, expires_at, used, created_at) VALUES (?, ?, ?, ?, 0, ?)"
          ).bind(id, wa, code, expires_at, created_at).run();

          await fetch('https://api.fonnte.com/send', {
            method: 'POST',
            headers: { 'Authorization': env.FONNTE_TOKEN, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              target: wa,
              message: 'Kode login admin MasjidReview: ' + code + '. Berlaku 5 menit. Jangan bagikan kode ini.',
            }),
          });

          // Cleanup expired OTPs
          env.DB.prepare("DELETE FROM otp_codes WHERE expires_at < datetime('now')").run();

          return json({ ok: true, message: 'OTP terkirim ke WhatsApp' });
        } catch (e) {
          return json({ error: 'Gagal mengirim OTP' }, 500);
        }
      }

      // ── POST /auth/otp/verify ──
      if (pathname === '/auth/otp/verify' && request.method === 'POST') {
        try {
          const body = await request.json();
          const wa = normalizeWA(body.wa_number);
          const code = String(body.code || '').trim();
          if (!wa || !code) {
            return json({ error: 'Nomor WA dan kode OTP wajib diisi' }, 400);
          }

          const otp = await env.DB.prepare(
            "SELECT * FROM otp_codes WHERE wa_number = ? AND code = ? AND used = 0 AND expires_at > datetime('now') ORDER BY created_at DESC LIMIT 1"
          ).bind(wa, code).first();
          if (!otp) {
            return json({ error: 'Kode OTP salah atau sudah kadaluarsa' }, 400);
          }

          // Mark OTP as used
          await env.DB.prepare("UPDATE otp_codes SET used = 1 WHERE id = ?").bind(otp.id).run();

          // Verify user has admin role
          const user = await env.DB.prepare(
            "SELECT id, name, wa_number, role FROM users WHERE wa_number = ? AND role IN ('admin', 'super_admin')"
          ).bind(wa).first();
          if (!user) {
            return json({ error: 'Akun tidak memiliki akses admin' }, 403);
          }

          // Create session in user_sessions (7-day expiry)
          const token = generateToken();
          const sessionId = crypto.randomUUID();
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
          const createdAt = new Date().toISOString();

          await env.DB.prepare(
            "INSERT INTO user_sessions (id, user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)"
          ).bind(sessionId, user.id, token, expiresAt, createdAt).run();

          return new Response(
            JSON.stringify({
              ok: true,
              admin: { id: user.id, name: user.name, wa_number: user.wa_number, role: user.role },
            }),
            {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
                'Set-Cookie': sessionCookie(token),
              },
            }
          );
        } catch (e) {
          return json({ error: 'Verifikasi gagal' }, 500);
        }
      }

      // ── POST /auth/logout ──
      if (pathname === '/auth/logout' && request.method === 'POST') {
        const cookie = request.headers.get('Cookie') || '';
        const match = cookie.match(/(?:^|;\s*)admin_session=([^\s;]+)/);

        if (match) {
          await env.DB.prepare('DELETE FROM user_sessions WHERE token = ?').bind(match[1]).run();
        }

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': clearCookie(),
          },
        });
      }

      // ── GET /auth/me ──
      if (pathname === '/auth/me' && request.method === 'GET') {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);
        return json(admin);
      }

      // ── GET /api/stats ──
      if (pathname === '/api/stats' && request.method === 'GET') {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);

        const stats = await env.DB.prepare(`
          SELECT
            (SELECT COUNT(*) FROM masjid WHERE status = 'approved') as total_masjid,
            (SELECT COUNT(*) FROM reviews WHERE status = 'approved') as total_reviews,
            (SELECT COUNT(*) FROM reviews WHERE status = 'pending') as pending_reviews,
            (SELECT COUNT(*) FROM masjid WHERE status = 'pending') as pending_masjid,
            (SELECT COUNT(*) FROM users) as total_users,
            (SELECT COUNT(*) FROM users WHERE role IN ('admin', 'super_admin')) as total_admins
        `).first();

        return json(stats);
      }

      // ── GET /api/masjids ──
      if (pathname === '/api/masjids' && request.method === 'GET') {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);

        const url = new URL(request.url);
        const status = url.searchParams.get('status');

        let sql = 'SELECT * FROM masjid';
        const params = [];
        if (status) {
          sql += ' WHERE status = ?';
          params.push(status);
        }
        sql += " ORDER BY CASE WHEN status='pending' THEN 0 ELSE 1 END, name ASC";

        const stmt = params.length > 0
          ? env.DB.prepare(sql).bind(...params)
          : env.DB.prepare(sql);
        const { results } = await stmt.all();
        return json(results);
      }

      // ── POST /api/masjids ──
      if (pathname === '/api/masjids' && request.method === 'POST') {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);

        const body = await request.json();
        if (!body.name || !body.city) {
          return json({ error: 'Nama dan kota wajib diisi' }, 400);
        }

        const id = crypto.randomUUID();
        const allowedCols = ['name','city','address','photo_url','google_maps_url','latitude','longitude','ig_post_url','info_label','info_photos','ramadan_takjil','ramadan_makanan_berat','ramadan_ceramah_tarawih','ramadan_mushaf_alquran','ramadan_itikaf','ramadan_parkir','ramadan_rakaat','ramadan_tempo','akhwat_wudhu_private','akhwat_mukena_available','akhwat_ac_available','akhwat_safe_entrance'];

        const cols = ['id', 'status'];
        const vals = [id, 'approved'];
        const placeholders = ['?', '?'];

        for (const col of allowedCols) {
          if (body[col] !== undefined && body[col] !== null && body[col] !== '') {
            cols.push(col);
            vals.push(body[col]);
            placeholders.push('?');
          }
        }

        await env.DB.prepare(
          'INSERT INTO masjid (' + cols.join(',') + ') VALUES (' + placeholders.join(',') + ')'
        ).bind(...vals).run();

        const created = await env.DB.prepare('SELECT * FROM masjid WHERE id = ?').bind(id).first();
        return json(created, 201);
      }

      // ── GET /api/masjids/:id/similar ──
      const similarMatch = pathname.match(/^\/api\/masjids\/([^/]+)\/similar$/);
      if (similarMatch && request.method === 'GET') {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);

        const masjidId = similarMatch[1];
        const masjid = await env.DB.prepare('SELECT * FROM masjid WHERE id = ?').bind(masjidId).first();
        if (!masjid) return json({ error: 'Masjid not found' }, 404);

        const stopWords = ['masjid','agung','besar','jami','raya','al','an','ar','as','at'];
        const words = masjid.name.split(/\s+/).filter(function(w) {
          return !stopWords.includes(w.toLowerCase()) && w.length > 1;
        });

        if (words.length === 0) return json([]);

        const conditions = [];
        const params = [];
        for (const word of words) {
          conditions.push("name LIKE ?");
          params.push('%' + word + '%');
        }

        const sql = 'SELECT id, name, city, status FROM masjid WHERE (' + conditions.join(' OR ') + ') AND city = ? AND id != ? LIMIT 10';
        params.push(masjid.city, masjidId);

        const { results } = await env.DB.prepare(sql).bind(...params).all();
        return json(results);
      }

      // ── POST /api/upload ──
      if (pathname === '/api/upload' && request.method === 'POST') {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);

        const formData = await request.formData();
        const file = formData.get('file');
        if (!file || !file.size) return json({ error: 'No file provided' }, 400);
        if (!file.type.startsWith('image/')) return json({ error: 'File must be an image' }, 400);
        if (file.size > 5 * 1024 * 1024) return json({ error: 'Max file size is 5MB' }, 400);

        const extMap = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
        const ext = extMap[file.type] || 'jpg';
        const prefix = formData.get('prefix') || 'masjid';
        const uuid = crypto.randomUUID();
        const key = prefix + '/' + uuid + '.' + ext;

        await env.IMAGES.put(key, file.stream(), {
          httpMetadata: { contentType: file.type },
        });

        const publicUrl = 'https://masjidreview.id/images/' + key;
        return json({ ok: true, url: publicUrl, key: key });
      }

      // ── PATCH /api/masjids/bulk-status ──
      if (pathname === '/api/masjids/bulk-status' && request.method === 'PATCH') {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);
        const body = await request.json();
        const ids = body.ids;
        const status = body.status;
        if (!Array.isArray(ids) || ids.length === 0 || ids.length > 50) {
          return json({ error: 'ids must be an array of 1-50 items' }, 400);
        }
        if (!status || !['approved', 'rejected'].includes(status)) {
          return json({ error: 'Status harus approved atau rejected' }, 400);
        }
        for (let i = 0; i < ids.length; i++) {
          await env.DB.prepare('UPDATE masjid SET status = ? WHERE id = ?').bind(status, ids[i]).run();
        }
        return json({ ok: true, updated: ids.length });
      }

      // ── PATCH /api/masjids/:id/status ──
      const statusMatch = pathname.match(/^\/api\/masjids\/([^/]+)\/status$/);
      if (statusMatch && request.method === 'PATCH') {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);

        const masjidId = statusMatch[1];
        const body = await request.json();

        if (!body.status || !['approved', 'rejected'].includes(body.status)) {
          return json({ error: 'Status harus approved atau rejected' }, 400);
        }

        await env.DB.prepare('UPDATE masjid SET status = ? WHERE id = ?').bind(body.status, masjidId).run();
        const updated = await env.DB.prepare('SELECT * FROM masjid WHERE id = ?').bind(masjidId).first();
        if (!updated) return json({ error: 'Masjid not found' }, 404);
        return json(updated);
      }

      // ── /api/masjids/:id (GET, PUT, DELETE) ──
      const masjidIdMatch = pathname.match(/^\/api\/masjids\/([^/]+)$/);
      if (masjidIdMatch) {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);

        const masjidId = masjidIdMatch[1];

        // GET single
        if (request.method === 'GET') {
          const row = await env.DB.prepare('SELECT * FROM masjid WHERE id = ?').bind(masjidId).first();
          if (!row) return json({ error: 'Masjid not found' }, 404);
          return json(row);
        }

        // PUT update
        if (request.method === 'PUT') {
          const body = await request.json();
          const allowedCols = ['name','city','address','photo_url','google_maps_url','latitude','longitude','ig_post_url','info_label','info_photos','ramadan_takjil','ramadan_makanan_berat','ramadan_ceramah_tarawih','ramadan_mushaf_alquran','ramadan_itikaf','ramadan_parkir','ramadan_rakaat','ramadan_tempo','akhwat_wudhu_private','akhwat_mukena_available','akhwat_ac_available','akhwat_safe_entrance','status'];

          const setClauses = [];
          const vals = [];
          for (const col of allowedCols) {
            if (body[col] !== undefined) {
              setClauses.push(col + ' = ?');
              vals.push(body[col]);
            }
          }

          if (setClauses.length === 0) return json({ error: 'Tidak ada data untuk diperbarui' }, 400);

          vals.push(masjidId);
          await env.DB.prepare(
            'UPDATE masjid SET ' + setClauses.join(', ') + ' WHERE id = ?'
          ).bind(...vals).run();

          const updated = await env.DB.prepare('SELECT * FROM masjid WHERE id = ?').bind(masjidId).first();
          return json(updated);
        }

        // DELETE
        if (request.method === 'DELETE') {
          if (admin.role !== 'super_admin') {
            return json({ error: 'Hanya super_admin yang dapat menghapus masjid' }, 403);
          }
          await env.DB.prepare('DELETE FROM masjid WHERE id = ?').bind(masjidId).run();
          return json({ ok: true });
        }
      }

      // ── GET /api/reviews ──
      if (pathname === '/api/reviews' && request.method === 'GET') {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);

        const url = new URL(request.url);
        const status = url.searchParams.get('status');

        let sql = "SELECT r.*, m.name as masjid_name FROM reviews r LEFT JOIN masjid m ON r.masjid_id = m.id";
        const params = [];
        if (status) {
          sql += ' WHERE r.status = ?';
          params.push(status);
        }
        sql += " ORDER BY CASE WHEN r.status='pending' THEN 0 ELSE 1 END, r.created_at DESC";

        const stmt = params.length > 0
          ? env.DB.prepare(sql).bind(...params)
          : env.DB.prepare(sql);
        const { results } = await stmt.all();
        return json(results);
      }

      // ── PATCH /api/reviews/bulk-status ──
      if (pathname === '/api/reviews/bulk-status' && request.method === 'PATCH') {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);
        const body = await request.json();
        const ids = body.ids;
        const status = body.status;
        if (!Array.isArray(ids) || ids.length === 0 || ids.length > 50) {
          return json({ error: 'ids must be an array of 1-50 items' }, 400);
        }
        if (!status || !['approved', 'rejected'].includes(status)) {
          return json({ error: 'Status harus approved atau rejected' }, 400);
        }
        for (let i = 0; i < ids.length; i++) {
          if (status === 'approved') {
            await env.DB.prepare('UPDATE reviews SET status = ?, validated_by = ? WHERE id = ?').bind(status, admin.email, ids[i]).run();
          } else {
            await env.DB.prepare('UPDATE reviews SET status = ? WHERE id = ?').bind(status, ids[i]).run();
          }
        }
        return json({ ok: true, updated: ids.length });
      }

      // ── PATCH /api/reviews/:id/status ──
      const reviewStatusMatch = pathname.match(/^\/api\/reviews\/([^/]+)\/status$/);
      if (reviewStatusMatch && request.method === 'PATCH') {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);

        const reviewId = reviewStatusMatch[1];
        const body = await request.json();

        if (!body.status || !['approved', 'rejected'].includes(body.status)) {
          return json({ error: 'Status harus approved atau rejected' }, 400);
        }

        if (body.status === 'approved') {
          await env.DB.prepare('UPDATE reviews SET status = ?, validated_by = ? WHERE id = ?')
            .bind(body.status, admin.email, reviewId).run();
        } else {
          await env.DB.prepare('UPDATE reviews SET status = ? WHERE id = ?')
            .bind(body.status, reviewId).run();
        }

        const updated = await env.DB.prepare(
          "SELECT r.*, m.name as masjid_name FROM reviews r LEFT JOIN masjid m ON r.masjid_id = m.id WHERE r.id = ?"
        ).bind(reviewId).first();
        if (!updated) return json({ error: 'Review not found' }, 404);
        return json(updated);
      }

      // ── /api/reviews/:id (GET, PUT, DELETE) ──
      const reviewIdMatch = pathname.match(/^\/api\/reviews\/([^/]+)$/);
      if (reviewIdMatch) {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);

        const reviewId = reviewIdMatch[1];

        // GET single review
        if (request.method === 'GET') {
          const row = await env.DB.prepare(
            "SELECT r.*, m.name as masjid_name FROM reviews r LEFT JOIN masjid m ON r.masjid_id = m.id WHERE r.id = ?"
          ).bind(reviewId).first();
          if (!row) return json({ error: 'Review not found' }, 404);
          return json(row);
        }

        // PUT update review
        if (request.method === 'PUT') {
          const body = await request.json();
          const allowedCols = ['reviewer_name', 'rating', 'short_description', 'source_url', 'source_platform', 'masjid_id'];

          const setClauses = [];
          const vals = [];
          for (const col of allowedCols) {
            if (body[col] !== undefined) {
              setClauses.push(col + ' = ?');
              vals.push(body[col]);
            }
          }

          if (setClauses.length === 0) return json({ error: 'Tidak ada data untuk diperbarui' }, 400);

          vals.push(reviewId);
          await env.DB.prepare(
            'UPDATE reviews SET ' + setClauses.join(', ') + ' WHERE id = ?'
          ).bind(...vals).run();

          const updated = await env.DB.prepare(
            "SELECT r.*, m.name as masjid_name FROM reviews r LEFT JOIN masjid m ON r.masjid_id = m.id WHERE r.id = ?"
          ).bind(reviewId).first();
          return json(updated);
        }

        // DELETE review
        if (request.method === 'DELETE') {
          if (admin.role !== 'super_admin') {
            return json({ error: 'Hanya super_admin yang dapat menghapus review' }, 403);
          }
          await env.DB.prepare('DELETE FROM reviews WHERE id = ?').bind(reviewId).run();
          return json({ ok: true });
        }
      }

      // ── GET /api/users ──
      if (pathname === '/api/users' && request.method === 'GET') {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);
        const { results } = await env.DB.prepare(
          "SELECT u.*, COUNT(r.id) as review_count FROM users u LEFT JOIN reviews r ON r.user_id = u.id GROUP BY u.id ORDER BY u.created_at DESC"
        ).all();
        return json(results);
      }

      // ── GET /api/users/search (for admin promote dialog) ──
      if (pathname === '/api/users/search' && request.method === 'GET') {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);
        if (admin.role !== 'super_admin') return json({ error: 'Forbidden' }, 403);
        const url = new URL(request.url);
        const q = (url.searchParams.get('q') || '').trim();
        if (!q || q.length < 3) return json({ error: 'Minimal 3 karakter' }, 400);
        const { results } = await env.DB.prepare(
          "SELECT id, name, wa_number, role FROM users WHERE role = 'user' AND (name LIKE ? OR wa_number LIKE ?) LIMIT 10"
        ).bind('%' + q + '%', '%' + q + '%').all();
        return json(results);
      }

      // ── POST /api/users/:id/force-logout (must be before /api/users/:id) ──
      const forceLogoutMatch = pathname.match(/^\/api\/users\/([^/]+)\/force-logout$/);
      if (forceLogoutMatch && request.method === 'POST') {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);
        const userId = forceLogoutMatch[1];
        await env.DB.prepare('DELETE FROM user_sessions WHERE user_id = ?').bind(userId).run();
        return json({ ok: true });
      }

      // ── PATCH /api/users/:id/role (must be before generic /api/users/:id) ──
      const userRoleMatch = pathname.match(/^\/api\/users\/([^/]+)\/role$/);
      if (userRoleMatch && request.method === 'PATCH') {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);
        if (admin.role !== 'super_admin') return json({ error: 'Forbidden' }, 403);
        const userId = userRoleMatch[1];
        const body = await request.json();
        const newRole = body.role;
        if (!['user', 'admin', 'super_admin'].includes(newRole)) {
          return json({ error: 'Role tidak valid' }, 400);
        }
        if (admin.id === userId) {
          return json({ error: 'Tidak dapat mengubah role diri sendiri' }, 400);
        }
        const target = await env.DB.prepare('SELECT id, role FROM users WHERE id = ?').bind(userId).first();
        if (!target) return json({ error: 'User tidak ditemukan' }, 404);
        await env.DB.prepare('UPDATE users SET role = ? WHERE id = ?').bind(newRole, userId).run();
        // If demoting, clear their sessions
        if (newRole === 'user' && target.role !== 'user') {
          await env.DB.prepare('DELETE FROM user_sessions WHERE user_id = ?').bind(userId).run();
        }
        const updated = await env.DB.prepare('SELECT id, name, wa_number, role, created_at FROM users WHERE id = ?').bind(userId).first();
        return json(updated);
      }

      // ── GET/PUT /api/users/:id ──
      const userIdMatch = pathname.match(/^\/api\/users\/([^/]+)$/);
      if (userIdMatch) {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);
        const userId = userIdMatch[1];

        if (request.method === 'GET') {
          const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first();
          if (!user) return json({ error: 'User not found' }, 404);
          const { results: reviews } = await env.DB.prepare(
            "SELECT r.*, m.name as masjid_name FROM reviews r LEFT JOIN masjid m ON r.masjid_id = m.id WHERE r.user_id = ? ORDER BY r.created_at DESC"
          ).bind(userId).all();
          return json({ user, reviews });
        }

        if (request.method === 'PUT') {
          const body = await request.json();
          const name = body.name ? String(body.name).trim() : null;
          const city = body.city ? String(body.city).trim() : null;
          if (!name) return json({ error: 'Nama tidak boleh kosong' }, 400);
          await env.DB.prepare('UPDATE users SET name = ?, city = ? WHERE id = ?').bind(name, city || null, userId).run();
          const updated = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first();
          return json(updated);
        }
      }

      // ── GET /api/admins ──
      if (pathname === '/api/admins' && request.method === 'GET') {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);
        if (admin.role !== 'super_admin') return json({ error: 'Forbidden' }, 403);
        const { results } = await env.DB.prepare(
          "SELECT id, name, wa_number, role, created_at FROM users WHERE role IN ('admin', 'super_admin') ORDER BY created_at ASC"
        ).all();
        return json(results);
      }

      // ── Serve HTML for all other routes ──
      return new Response(HTML, {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' },
      });

    } catch (err) {
      return json({ error: 'Internal server error' }, 500);
    }
  },
};
