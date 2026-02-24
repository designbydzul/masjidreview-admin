import HTML from './frontend.js';

// ── Security: Allowed Origins ──
const ALLOWED_ORIGINS = [
  "https://masjidreview-admin.designbydzul.workers.dev"
];

function getCorsHeaders(request) {
  const origin = request && request.headers ? request.headers.get("Origin") : null;
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin"
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

// ── Security: HTTP Headers ──
const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' https://accounts.google.com; style-src 'self' 'unsafe-inline' https://accounts.google.com; img-src 'self' data: blob: https://masjidreview.id; connect-src 'self' https://accounts.google.com; frame-src https://accounts.google.com; frame-ancestors 'none'",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
};

// ── JSON Helper ──
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...getCorsHeaders(json._currentRequest), ...SECURITY_HEADERS, 'Content-Type': 'application/json' },
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
  const maxAge = 30 * 24 * 60 * 60; // 30 days
  return `admin_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

function getDateRange(url) {
  const from = url.searchParams.get('from') || new Date(Date.now() - 30 * 86400000).toISOString();
  const to = url.searchParams.get('to') || new Date().toISOString();
  return { from, to };
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

    // ── Step 3: Device validation (exact match) ──
    const deviceStr = String(body.device || '');
    if (deviceStr !== '6285111043194') {
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

// ── Database Migrations ──

let migrated = false;

async function runMigrations(env) {
  if (migrated) return;

  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS _migrations (version INTEGER PRIMARY KEY, applied_at TEXT DEFAULT (datetime('now')))"
  ).run();

  const latest = await env.DB.prepare('SELECT MAX(version) as v FROM _migrations').first();
  const currentVersion = latest?.v || 0;

  // v1: facilities + masjid_facilities tables, seed data, column migration (applied 2025-02-21)

  // v2: Add google_id and email columns for Google Sign-in
  if (currentVersion < 2) {
    await env.DB.prepare('ALTER TABLE users ADD COLUMN google_id TEXT').run();
    await env.DB.prepare('ALTER TABLE users ADD COLUMN email TEXT').run();
    await env.DB.prepare(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL'
    ).run();
    await env.DB.prepare('INSERT INTO _migrations (version) VALUES (2)').run();
  }

  // v3: Make wa_number nullable (applied 2026-02-23 via wrangler d1 execute with PRAGMA foreign_keys=OFF)

  // v4: Create changelog table
  if (currentVersion < 4) {
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS changelog (
        id TEXT PRIMARY KEY,
        version TEXT NOT NULL,
        title TEXT NOT NULL,
        details TEXT,
        categories TEXT DEFAULT '[]',
        status TEXT DEFAULT 'draft',
        created_at TEXT DEFAULT (datetime('now')),
        published_at TEXT
      )
    `).run();
    await env.DB.prepare('INSERT INTO _migrations (version) VALUES (4)').run();
  }

  // v5: Create feedback table
  if (currentVersion < 5) {
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS feedback (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        message TEXT NOT NULL,
        name TEXT,
        wa_number TEXT,
        user_id TEXT REFERENCES users(id),
        priority TEXT,
        status TEXT NOT NULL DEFAULT 'todo',
        created_at TEXT NOT NULL
      )
    `).run();
    await env.DB.prepare('INSERT INTO _migrations (version) VALUES (5)').run();
  }

  // v6: Add type column to feedback + seed backlog ideas
  if (currentVersion < 6) {
    try {
      await env.DB.prepare("ALTER TABLE feedback ADD COLUMN type TEXT NOT NULL DEFAULT 'feedback'").run();
    } catch (e) { /* column may already exist */ }

    // Seed backlog ideas (only if none exist yet)
    const existingIdeas = await env.DB.prepare("SELECT COUNT(*) as cnt FROM feedback WHERE type = 'idea'").first();
    if (!existingIdeas || existingIdeas.cnt === 0) {
      const ideas = [
        'Feedback Hub: Form publik (/feedback) untuk user kirim feedback (bug, saran, umum) tanpa login. Admin side: kanban board untuk manage feedback, admin bisa kategorisasi dan set prioritas.',
        'Program Masjid: Section baru di detail page untuk info program unggulan masjid (buka puasa Senin-Kamis, kajian rutin, tahfidz, dll). Dari feedback user.',
        'Masjid Near Me: Fitur nearby mosques berdasarkan GPS/lokasi user, tampilkan masjid terdekat dari database.',
        'Sistem "Masjid Heroes": Ada profile page, review history, dan badge per user. Seperti Google Maps contributors.',
        'Search by keyword: Cari masjid by nama atau alamat.',
        'Map view: Menampilkan semua masjid di peta.',
        'Filter tambahan: Rakaat (11/23) dan Tempo (khusyuk/sedang/cepat) sebagai opsi filter listing.',
        'WhatsApp Community integration lebih dalam ke web app.',
        'Community onboarding via bot: Bot tanya data dasar (nama, profesi, kota) saat calon member join WA community.',
        'Daily digest ke WA group kalau ada banyak pending submissions.',
        'Gamification: Streak badges untuk reviewer yang konsisten, "Top Reviewer" per kota.',
        'Rejection reason (internal note) di admin dashboard.',
        'Audit log untuk tracking admin actions.',
        'Drop deprecated tables: admins dan sessions (admin sessions lama).',
      ];
      for (const msg of ideas) {
        await env.DB.prepare(
          "INSERT INTO feedback (id, type, category, message, name, priority, status, created_at) VALUES (?, 'idea', 'umum', ?, 'Tim Masjid Review', NULL, 'todo', ?)"
        ).bind(crypto.randomUUID(), msg, new Date().toISOString()).run();
      }
    }

    await env.DB.prepare('INSERT INTO _migrations (version) VALUES (6)').run();
  }

  // v7: Create facility_groups table for dynamic group management + column ordering
  if (currentVersion < 7) {
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS facility_groups (
        grp TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0
      )
    `).run();

    // Seed existing groups
    await env.DB.prepare("INSERT OR IGNORE INTO facility_groups (grp, label, sort_order) VALUES ('ramadhan', 'Ramadhan', 0)").run();
    await env.DB.prepare("INSERT OR IGNORE INTO facility_groups (grp, label, sort_order) VALUES ('masjid', 'Masjid', 1)").run();
    await env.DB.prepare("INSERT OR IGNORE INTO facility_groups (grp, label, sort_order) VALUES ('akhwat', 'Akhwat', 2)").run();

    await env.DB.prepare('INSERT INTO _migrations (version) VALUES (7)').run();
  }

  // v8: Add submitted_by column to masjid table for tracking who submitted
  if (currentVersion < 8) {
    try {
      await env.DB.prepare('ALTER TABLE masjid ADD COLUMN submitted_by TEXT').run();
    } catch (e) { /* column may already exist */ }
    await env.DB.prepare('INSERT INTO _migrations (version) VALUES (8)').run();
  }

  migrated = true;
}

// ── Worker Entry Point ──

export default {
  async fetch(request, env, ctx) {
    // Store request reference for CORS origin checking in json() helper
    json._currentRequest = request;
    const { pathname } = new URL(request.url);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: { ...getCorsHeaders(request), ...SECURITY_HEADERS } });
    }

    try {
      // Run database migrations (non-blocking — don't let migration errors kill routes)
      try {
        await runMigrations(env);
      } catch (migrationErr) {
        console.error('Migration failed:', migrationErr);
      }
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

          // Rate limit: max 3 OTP per 10 minutes
          const recentCount = await env.DB.prepare(
            "SELECT COUNT(*) as cnt FROM otp_codes WHERE wa_number = ? AND created_at > datetime('now', '-10 minutes')"
          ).bind(wa).first();
          if (recentCount && recentCount.cnt >= 3) {
            return json({ error: 'Terlalu banyak permintaan OTP. Silakan coba lagi dalam 10 menit.' }, 429);
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

          // Create session in user_sessions (30-day expiry)
          const token = generateToken();
          const sessionId = crypto.randomUUID();
          const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
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
                ...getCorsHeaders(request),
                ...SECURITY_HEADERS,
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
            ...getCorsHeaders(request),
            ...SECURITY_HEADERS,
            'Content-Type': 'application/json',
            'Set-Cookie': clearCookie(),
          },
        });
      }

      // ── POST /auth/google ──
      if (pathname === '/auth/google' && request.method === 'POST') {
        try {
          const body = await request.json();
          const credential = body.credential;
          if (!credential) return json({ error: 'Google credential required' }, 400);

          // Verify token with Google
          const verifyRes = await fetch(
            `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
          );
          if (!verifyRes.ok) return json({ error: 'Invalid Google token' }, 401);

          const tokenInfo = await verifyRes.json();
          if (tokenInfo.aud !== env.GOOGLE_CLIENT_ID) {
            return json({ error: 'Invalid token audience' }, 401);
          }

          const google_id = tokenInfo.sub;
          const email = tokenInfo.email;
          const name = tokenInfo.name || email;

          // Find or create user
          let user = await env.DB.prepare(
            'SELECT id, name, wa_number, role FROM users WHERE google_id = ?'
          ).bind(google_id).first();

          if (!user) {
            const userId = crypto.randomUUID();
            const createdAt = new Date().toISOString();
            await env.DB.prepare(
              "INSERT INTO users (id, google_id, email, name, role, created_at) VALUES (?, ?, ?, ?, 'user', ?)"
            ).bind(userId, google_id, email, name, createdAt).run();
            user = await env.DB.prepare(
              'SELECT id, name, wa_number, role FROM users WHERE id = ?'
            ).bind(userId).first();
          }

          // Admin role check
          if (!user || !['admin', 'super_admin'].includes(user.role)) {
            return json({ error: 'Akun kamu tidak memiliki akses admin' }, 403);
          }

          // Create session (30-day expiry)
          const token = generateToken();
          const sessionId = crypto.randomUUID();
          const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
          const createdAt = new Date().toISOString();

          await env.DB.prepare(
            'INSERT INTO user_sessions (id, user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
          ).bind(sessionId, user.id, token, expiresAt, createdAt).run();

          return new Response(
            JSON.stringify({
              ok: true,
              admin: { id: user.id, name: user.name, wa_number: user.wa_number, role: user.role },
            }),
            {
              status: 200,
              headers: {
                ...getCorsHeaders(request),
                ...SECURITY_HEADERS,
                'Content-Type': 'application/json',
                'Set-Cookie': sessionCookie(token),
              },
            }
          );
        } catch (e) {
          return json({ error: 'Google sign-in failed' }, 500);
        }
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

      // ── GET /api/facility-groups ──
      if (pathname === '/api/facility-groups' && request.method === 'GET') {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);
        const { results } = await env.DB.prepare('SELECT * FROM facility_groups ORDER BY sort_order').all();
        return json(results);
      }

      // ── POST /api/facility-groups ──
      if (pathname === '/api/facility-groups' && request.method === 'POST') {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);
        const body = await request.json();
        if (!body.label || !body.label.trim()) {
          return json({ error: 'Nama grup wajib diisi' }, 400);
        }
        const grp = body.label.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
        // Check if group already exists
        const existing = await env.DB.prepare('SELECT grp FROM facility_groups WHERE grp = ?').bind(grp).first();
        if (existing) return json({ error: 'Grup sudah ada' }, 409);
        // Get max sort_order
        const maxOrder = await env.DB.prepare('SELECT MAX(sort_order) as max_order FROM facility_groups').first();
        const sort_order = (maxOrder?.max_order ?? -1) + 1;
        await env.DB.prepare('INSERT INTO facility_groups (grp, label, sort_order) VALUES (?, ?, ?)').bind(grp, body.label.trim(), sort_order).run();
        const created = await env.DB.prepare('SELECT * FROM facility_groups WHERE grp = ?').bind(grp).first();
        return json(created, 201);
      }

      // ── PATCH /api/facility-groups/:grp ──
      const facGroupMatch = pathname.match(/^\/api\/facility-groups\/([^/]+)$/);
      if (facGroupMatch && request.method === 'PATCH') {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);
        const grp = decodeURIComponent(facGroupMatch[1]);
        const body = await request.json();
        if (body.sort_order === undefined) return json({ error: 'sort_order wajib diisi' }, 400);
        await env.DB.prepare('UPDATE facility_groups SET sort_order = ? WHERE grp = ?').bind(body.sort_order, grp).run();
        const updated = await env.DB.prepare('SELECT * FROM facility_groups WHERE grp = ?').bind(grp).first();
        if (!updated) return json({ error: 'Group not found' }, 404);
        return json(updated);
      }

      // ── DELETE /api/facility-groups/:grp ──
      if (facGroupMatch && request.method === 'DELETE') {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);
        if (admin.role !== 'super_admin') return json({ error: 'Hanya super_admin yang dapat menghapus grup' }, 403);
        const grp = decodeURIComponent(facGroupMatch[1]);
        // Check if group has facilities
        const count = await env.DB.prepare('SELECT COUNT(*) as cnt FROM facilities WHERE grp = ?').bind(grp).first();
        if (count?.cnt > 0) return json({ error: 'Grup masih memiliki fasilitas. Hapus atau pindahkan fasilitas terlebih dahulu.' }, 400);
        await env.DB.prepare('DELETE FROM facility_groups WHERE grp = ?').bind(grp).run();
        return json({ ok: true });
      }

      // ── PATCH /api/facilities/:id/toggle ──
      const facToggleMatch = pathname.match(/^\/api\/facilities\/([^/]+)\/toggle$/);
      if (facToggleMatch && request.method === 'PATCH') {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);

        const facId = facToggleMatch[1];
        await env.DB.prepare(
          'UPDATE facilities SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END WHERE id = ?'
        ).bind(facId).run();

        const updated = await env.DB.prepare('SELECT * FROM facilities WHERE id = ?').bind(facId).first();
        if (!updated) return json({ error: 'Facility not found' }, 404);
        return json(updated);
      }

      // ── GET /api/facilities ──
      if (pathname === '/api/facilities' && request.method === 'GET') {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);

        const { results } = await env.DB.prepare('SELECT * FROM facilities ORDER BY grp, sort_order').all();
        return json(results);
      }

      // ── POST /api/facilities ──
      if (pathname === '/api/facilities' && request.method === 'POST') {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);

        const body = await request.json();
        if (!body.name || !body.grp || !body.input_type) {
          return json({ error: 'name, grp, dan input_type wajib diisi' }, 400);
        }
        if (!['toggle', 'dropdown', 'number'].includes(body.input_type)) {
          return json({ error: 'input_type harus toggle, dropdown, atau number' }, 400);
        }
        // Validate grp exists in facility_groups table
        const grpExists = await env.DB.prepare('SELECT grp FROM facility_groups WHERE grp = ?').bind(body.grp).first();
        if (!grpExists) {
          return json({ error: 'Grup tidak valid' }, 400);
        }

        const id = crypto.randomUUID();
        const options = body.input_type === 'dropdown' && body.options
          ? (typeof body.options === 'string' ? body.options : JSON.stringify(body.options))
          : null;
        const sort_order = body.sort_order || 0;

        await env.DB.prepare(
          'INSERT INTO facilities (id, name, grp, input_type, options, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(id, body.name, body.grp, body.input_type, options, sort_order).run();

        const created = await env.DB.prepare('SELECT * FROM facilities WHERE id = ?').bind(id).first();
        return json(created, 201);
      }

      // ── /api/facilities/:id (PUT, DELETE) ──
      const facIdMatch = pathname.match(/^\/api\/facilities\/([^/]+)$/);
      if (facIdMatch) {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);

        const facId = facIdMatch[1];

        // PUT update
        if (request.method === 'PUT') {
          const body = await request.json();
          const setClauses = [];
          const vals = [];

          for (const col of ['name', 'grp', 'input_type', 'sort_order', 'is_active']) {
            if (body[col] !== undefined) {
              setClauses.push(col + ' = ?');
              vals.push(body[col]);
            }
          }
          if (body.options !== undefined) {
            setClauses.push('options = ?');
            vals.push(body.options ? (typeof body.options === 'string' ? body.options : JSON.stringify(body.options)) : null);
          }

          if (setClauses.length === 0) return json({ error: 'Tidak ada data untuk diperbarui' }, 400);

          vals.push(facId);
          await env.DB.prepare('UPDATE facilities SET ' + setClauses.join(', ') + ' WHERE id = ?').bind(...vals).run();
          const updated = await env.DB.prepare('SELECT * FROM facilities WHERE id = ?').bind(facId).first();
          if (!updated) return json({ error: 'Facility not found' }, 404);
          return json(updated);
        }

        // DELETE
        if (request.method === 'DELETE') {
          if (admin.role !== 'super_admin') {
            return json({ error: 'Hanya super_admin yang dapat menghapus fasilitas' }, 403);
          }
          await env.DB.prepare('DELETE FROM masjid_facilities WHERE facility_id = ?').bind(facId).run();
          await env.DB.prepare('DELETE FROM facilities WHERE id = ?').bind(facId).run();
          return json({ ok: true });
        }
      }

      // ── GET /api/facility-suggestions ──
      if (pathname === '/api/facility-suggestions' && request.method === 'GET') {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);

        const url = new URL(request.url);
        const masjidId = url.searchParams.get('masjid_id');
        const status = url.searchParams.get('status');

        let sql = `SELECT fs.*, f.name as facility_name, m.name as masjid_name
          FROM facility_suggestions fs
          LEFT JOIN facilities f ON fs.facility_id = f.id
          JOIN masjid m ON fs.masjid_id = m.id
          WHERE 1=1`;
        const params = [];

        if (masjidId) {
          sql += ' AND fs.masjid_id = ?';
          params.push(masjidId);
        }
        if (status) {
          sql += ' AND fs.status = ?';
          params.push(status);
        }

        sql += ' ORDER BY fs.created_at DESC';

        const stmt = params.length > 0
          ? env.DB.prepare(sql).bind(...params)
          : env.DB.prepare(sql);
        const { results } = await stmt.all();
        return json(results);
      }

      // ── PATCH /api/facility-suggestions/bulk-status ──
      if (pathname === '/api/facility-suggestions/bulk-status' && request.method === 'PATCH') {
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

        const placeholders = ids.map(() => '?').join(',');
        const { results: suggestions } = await env.DB.prepare(
          `SELECT * FROM facility_suggestions WHERE id IN (${placeholders})`
        ).bind(...ids).all();

        for (const sug of suggestions) {
          if (status === 'rejected') {
            await env.DB.prepare("UPDATE facility_suggestions SET status = 'rejected' WHERE id = ?").bind(sug.id).run();
          } else {
            await env.DB.prepare("UPDATE facility_suggestions SET status = 'approved' WHERE id = ?").bind(sug.id).run();
            if (sug.facility_id) {
              await env.DB.prepare(
                "INSERT INTO masjid_facilities (id, masjid_id, facility_id, value) VALUES (?, ?, ?, ?) ON CONFLICT(masjid_id, facility_id) DO UPDATE SET value = excluded.value"
              ).bind(crypto.randomUUID(), sug.masjid_id, sug.facility_id, sug.suggested_value).run();
            }
          }
        }

        return json({ ok: true, updated: suggestions.length });
      }

      // ── PATCH /api/facility-suggestions/:id ──
      const facSugMatch = pathname.match(/^\/api\/facility-suggestions\/([^/]+)$/);
      if (facSugMatch && request.method === 'PATCH') {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);

        const sugId = facSugMatch[1];
        const body = await request.json();

        if (!body.action || !['approve', 'reject'].includes(body.action)) {
          return json({ error: 'action harus approve atau reject' }, 400);
        }

        const suggestion = await env.DB.prepare('SELECT * FROM facility_suggestions WHERE id = ?').bind(sugId).first();
        if (!suggestion) return json({ error: 'Suggestion not found' }, 404);

        if (body.action === 'reject') {
          await env.DB.prepare("UPDATE facility_suggestions SET status = 'rejected' WHERE id = ?").bind(sugId).run();
        } else {
          // Approve: update status + upsert into masjid_facilities (only if facility_id exists)
          await env.DB.prepare("UPDATE facility_suggestions SET status = 'approved' WHERE id = ?").bind(sugId).run();
          if (suggestion.facility_id) {
            await env.DB.prepare(
              "INSERT INTO masjid_facilities (id, masjid_id, facility_id, value) VALUES (?, ?, ?, ?) ON CONFLICT(masjid_id, facility_id) DO UPDATE SET value = excluded.value"
            ).bind(crypto.randomUUID(), suggestion.masjid_id, suggestion.facility_id, suggestion.suggested_value).run();
          }
        }

        const updated = await env.DB.prepare('SELECT * FROM facility_suggestions WHERE id = ?').bind(sugId).first();
        return json(updated);
      }

      // ── GET /api/masjids ──
      if (pathname === '/api/masjids' && request.method === 'GET') {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);

        const url = new URL(request.url);
        const status = url.searchParams.get('status');

        let sql = `SELECT m.*,
          (SELECT COUNT(*) FROM facility_suggestions fs WHERE fs.masjid_id = m.id AND fs.status = 'pending') as pending_suggestions,
          (SELECT COUNT(*) FROM analytics_events ae WHERE ae.event_type = 'page_view' AND ae.page = '/masjids/' || m.id AND ae.created_at > datetime('now', '-30 days')) as views_30d,
          (SELECT COUNT(*) FROM reviews r WHERE r.masjid_id = m.id AND r.status = 'approved') as review_count
        FROM masjid m`;
        const params = [];
        if (status) {
          sql += ' WHERE m.status = ?';
          params.push(status);
        }
        sql += " ORDER BY CASE WHEN m.status='pending' THEN 0 ELSE 1 END, m.name ASC";

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

        // Handle dynamic facilities
        if (body.facilities && typeof body.facilities === 'object') {
          const facBatch = [];
          for (const [facId, value] of Object.entries(body.facilities)) {
            if (value === null || value === '' || value === undefined) continue;
            facBatch.push(
              env.DB.prepare(
                'INSERT INTO masjid_facilities (id, masjid_id, facility_id, value) VALUES (?, ?, ?, ?)'
              ).bind(crypto.randomUUID(), id, facId, String(value))
            );
          }
          if (facBatch.length > 0) await env.DB.batch(facBatch);
        }

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
          const row = await env.DB.prepare(
            'SELECT m.*, u.name as submitted_by_name, u.wa_number as submitted_by_wa FROM masjid m LEFT JOIN users u ON m.submitted_by = u.id WHERE m.id = ?'
          ).bind(masjidId).first();
          if (!row) return json({ error: 'Masjid not found' }, 404);

          // Attach dynamic facilities
          const { results: facRows } = await env.DB.prepare(
            'SELECT mf.facility_id, mf.value FROM masjid_facilities mf WHERE mf.masjid_id = ?'
          ).bind(masjidId).all();
          row.facilities = {};
          for (const f of facRows) {
            row.facilities[f.facility_id] = f.value;
          }

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

          // Handle dynamic facilities
          if (body.facilities && typeof body.facilities === 'object') {
            const facBatch = [];
            for (const [facId, value] of Object.entries(body.facilities)) {
              if (value === null || value === '' || value === undefined || value === 'tidak') {
                facBatch.push(
                  env.DB.prepare('DELETE FROM masjid_facilities WHERE masjid_id = ? AND facility_id = ?').bind(masjidId, facId)
                );
              } else {
                facBatch.push(
                  env.DB.prepare(
                    "INSERT INTO masjid_facilities (id, masjid_id, facility_id, value) VALUES (?, ?, ?, ?) ON CONFLICT(masjid_id, facility_id) DO UPDATE SET value = excluded.value"
                  ).bind(crypto.randomUUID(), masjidId, facId, String(value))
                );
              }
            }
            if (facBatch.length > 0) await env.DB.batch(facBatch);
          }

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

      // ── POST /reviews (admin — create review) ──
      if (pathname === '/reviews' && request.method === 'POST') {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);
        const body = await request.json();
        if (!body.masjid_id || !body.reviewer_name) {
          return json({ error: 'masjid_id dan reviewer_name wajib diisi' }, 400);
        }

        const id = crypto.randomUUID();
        const status = body.source_platform === 'web' ? 'approved' : 'pending';
        const wa = body.wa_number ? normalizeWA(body.wa_number) : null;
        const matchedUser = wa ? await env.DB.prepare('SELECT id FROM users WHERE wa_number = ?').bind(wa).first() : null;

        await env.DB.prepare(
          "INSERT INTO reviews (id, masjid_id, reviewer_name, rating, short_description, source_platform, source_url, status, wa_number, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))"
        ).bind(
          id,
          body.masjid_id,
          body.reviewer_name,
          body.rating ? Number(body.rating) : null,
          body.short_description || null,
          body.source_platform || null,
          body.source_url || null,
          status,
          wa || null,
          matchedUser ? matchedUser.id : null
        ).run();

        const created = await env.DB.prepare(
          "SELECT r.*, m.name as masjid_name FROM reviews r LEFT JOIN masjid m ON r.masjid_id = m.id WHERE r.id = ?"
        ).bind(id).first();
        return json(created, 201);
      }

      // ── POST /api/reviews (admin — always approved) ──
      if (pathname === '/api/reviews' && request.method === 'POST') {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);

        const body = await request.json();
        if (!body.masjid_id || !body.reviewer_name) {
          return json({ error: 'masjid_id dan reviewer_name wajib diisi' }, 400);
        }

        const id = crypto.randomUUID();

        await env.DB.prepare(
          "INSERT INTO reviews (id, masjid_id, reviewer_name, rating, short_description, source_platform, source_url, status, validated_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', ?, datetime('now'))"
        ).bind(
          id,
          body.masjid_id,
          body.reviewer_name,
          body.rating ? Number(body.rating) : null,
          body.short_description || null,
          body.source_platform || null,
          body.source_url || null,
          admin.name
        ).run();

        const created = await env.DB.prepare(
          "SELECT r.*, m.name as masjid_name FROM reviews r LEFT JOIN masjid m ON r.masjid_id = m.id WHERE r.id = ?"
        ).bind(id).first();
        return json(created, 201);
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
            await env.DB.prepare('UPDATE reviews SET status = ?, validated_by = ? WHERE id = ?').bind(status, admin.name, ids[i]).run();
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
            .bind(body.status, admin.name, reviewId).run();
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

      // ── POST /api/users (admin — create user) ──
      if (pathname === '/api/users' && request.method === 'POST') {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);

        const body = await request.json();
        const name = body.name ? String(body.name).trim() : null;
        const rawWA = body.wa_number ? normalizeWA(body.wa_number) : null;

        if (!name) return json({ error: 'Nama wajib diisi' }, 400);
        if (!rawWA || !/^62\d{8,13}$/.test(rawWA)) return json({ error: 'Nomor WA tidak valid' }, 400);

        // Check duplicate
        const existing = await env.DB.prepare('SELECT id FROM users WHERE wa_number = ?').bind(rawWA).first();
        if (existing) return json({ error: 'Nomor WA sudah terdaftar' }, 409);

        const id = crypto.randomUUID();
        const city = body.city ? String(body.city).trim() : null;
        const age_range = body.age_range ? String(body.age_range).trim() : null;

        await env.DB.prepare(
          "INSERT INTO users (id, name, wa_number, role, city, age_range, created_at) VALUES (?, ?, ?, 'user', ?, ?, datetime('now'))"
        ).bind(id, name, rawWA, city, age_range).run();

        const created = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
        return json(created, 201);
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
        if (admin.role !== 'super_admin') {
          return json({ error: 'Hanya super_admin yang dapat force-logout user' }, 403);
        }
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
          const age_range = body.age_range !== undefined ? (body.age_range ? String(body.age_range).trim() : null) : undefined;
          if (!name) return json({ error: 'Nama tidak boleh kosong' }, 400);
          if (age_range !== undefined) {
            await env.DB.prepare('UPDATE users SET name = ?, city = ?, age_range = ? WHERE id = ?').bind(name, city || null, age_range, userId).run();
          } else {
            await env.DB.prepare('UPDATE users SET name = ?, city = ? WHERE id = ?').bind(name, city || null, userId).run();
          }
          const updated = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first();
          return json(updated);
        }

        if (request.method === 'DELETE') {
          if (admin.role !== 'super_admin') return json({ error: 'Hanya super_admin yang dapat menghapus user' }, 403);
          if (userId === admin.id) return json({ error: 'Tidak bisa menghapus akun sendiri' }, 400);

          const user = await env.DB.prepare('SELECT wa_number FROM users WHERE id = ?').bind(userId).first();
          if (!user) return json({ error: 'User not found' }, 404);

          // 1. Delete all sessions
          await env.DB.prepare('DELETE FROM user_sessions WHERE user_id = ?').bind(userId).run();
          // 2. Orphan reviews (set user_id = NULL)
          await env.DB.prepare('UPDATE reviews SET user_id = NULL WHERE user_id = ?').bind(userId).run();
          // 3. Orphan facility suggestions (clear submitted_by_wa)
          await env.DB.prepare('UPDATE facility_suggestions SET submitted_by_wa = NULL WHERE submitted_by_wa = ?').bind(user.wa_number).run();
          // 4. Orphan masjid submissions (clear submitted_by)
          await env.DB.prepare('UPDATE masjid SET submitted_by = NULL WHERE submitted_by = ?').bind(userId).run();
          // 5. Delete user
          await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();

          return json({ ok: true });
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

      // ── GET /api/changelog ──
      if (pathname === '/api/changelog' && request.method === 'GET') {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);

        const url = new URL(request.url);
        const status = url.searchParams.get('status');

        let sql = 'SELECT * FROM changelog';
        const params = [];

        if (status && ['draft', 'published'].includes(status)) {
          sql += ' WHERE status = ?';
          params.push(status);
        }

        sql += ' ORDER BY created_at DESC';

        const stmt = params.length > 0
          ? env.DB.prepare(sql).bind(...params)
          : env.DB.prepare(sql);
        const { results } = await stmt.all();
        return json(results);
      }

      // ── POST /api/changelog ──
      if (pathname === '/api/changelog' && request.method === 'POST') {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);

        const body = await request.json();
        const { version, title, details, categories } = body;

        if (!version || !title) {
          return json({ error: 'Version dan title wajib diisi' }, 400);
        }

        let cats = '[]';
        if (categories) {
          if (!Array.isArray(categories)) return json({ error: 'Categories harus berupa array' }, 400);
          const validCats = ['public_app', 'admin', 'worker', 'database', 'deployment', 'docs'];
          const invalid = categories.filter(c => !validCats.includes(c));
          if (invalid.length > 0) return json({ error: 'Kategori tidak valid: ' + invalid.join(', ') }, 400);
          cats = JSON.stringify(categories);
        }

        const id = crypto.randomUUID();
        const createdAt = new Date().toISOString();

        await env.DB.prepare(
          'INSERT INTO changelog (id, version, title, details, categories, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(id, version, title, details || null, cats, 'draft', createdAt).run();

        const entry = await env.DB.prepare('SELECT * FROM changelog WHERE id = ?').bind(id).first();
        return json(entry, 201);
      }

      // ── PUT/DELETE /api/changelog/:id ──
      const changelogMatch = pathname.match(/^\/api\/changelog\/([^/]+)$/);
      if (changelogMatch && request.method === 'PUT') {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);

        const entryId = changelogMatch[1];
        const existing = await env.DB.prepare('SELECT * FROM changelog WHERE id = ?').bind(entryId).first();
        if (!existing) return json({ error: 'Entry tidak ditemukan' }, 404);

        const body = await request.json();
        const { version, title, details, categories } = body;

        if (!version || !title) {
          return json({ error: 'Version dan title wajib diisi' }, 400);
        }

        let cats = existing.categories;
        if (categories !== undefined) {
          if (!Array.isArray(categories)) return json({ error: 'Categories harus berupa array' }, 400);
          const validCats = ['public_app', 'admin', 'worker', 'database', 'deployment', 'docs'];
          const invalid = categories.filter(c => !validCats.includes(c));
          if (invalid.length > 0) return json({ error: 'Kategori tidak valid: ' + invalid.join(', ') }, 400);
          cats = JSON.stringify(categories);
        }

        await env.DB.prepare(
          'UPDATE changelog SET version = ?, title = ?, details = ?, categories = ? WHERE id = ?'
        ).bind(version, title, details || null, cats, entryId).run();

        const updated = await env.DB.prepare('SELECT * FROM changelog WHERE id = ?').bind(entryId).first();
        return json(updated);
      }

      if (changelogMatch && request.method === 'DELETE') {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);
        if (admin.role !== 'super_admin') return json({ error: 'Hanya super_admin yang dapat menghapus changelog' }, 403);

        const entryId = changelogMatch[1];
        const existing = await env.DB.prepare('SELECT * FROM changelog WHERE id = ?').bind(entryId).first();
        if (!existing) return json({ error: 'Entry tidak ditemukan' }, 404);

        await env.DB.prepare('DELETE FROM changelog WHERE id = ?').bind(entryId).run();
        return json({ ok: true });
      }

      // ── PATCH /api/changelog/:id/status ──
      const changelogStatusMatch = pathname.match(/^\/api\/changelog\/([^/]+)\/status$/);
      if (changelogStatusMatch && request.method === 'PATCH') {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);

        const entryId = changelogStatusMatch[1];
        const existing = await env.DB.prepare('SELECT * FROM changelog WHERE id = ?').bind(entryId).first();
        if (!existing) return json({ error: 'Entry tidak ditemukan' }, 404);

        const body = await request.json();
        const { status } = body;

        if (!status || !['draft', 'published'].includes(status)) {
          return json({ error: 'Status harus draft atau published' }, 400);
        }

        const publishedAt = status === 'published' ? new Date().toISOString() : null;

        await env.DB.prepare(
          'UPDATE changelog SET status = ?, published_at = ? WHERE id = ?'
        ).bind(status, publishedAt, entryId).run();

        const updated = await env.DB.prepare('SELECT * FROM changelog WHERE id = ?').bind(entryId).first();
        return json(updated);
      }

      // ── GET /api/feedback ──
      if (pathname === '/api/feedback' && request.method === 'GET') {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);

        const url = new URL(request.url);
        const status = url.searchParams.get('status');
        const type = url.searchParams.get('type');

        let sql = 'SELECT * FROM feedback';
        const conditions = [];
        const params = [];

        if (status && ['todo', 'in_progress', 'hold', 'done', 'archived'].includes(status)) {
          conditions.push('status = ?');
          params.push(status);
        }
        if (type && ['feedback', 'idea'].includes(type)) {
          conditions.push('type = ?');
          params.push(type);
        }
        if (conditions.length > 0) {
          sql += ' WHERE ' + conditions.join(' AND ');
        }

        sql += ' ORDER BY created_at DESC';

        const stmt = params.length > 0
          ? env.DB.prepare(sql).bind(...params)
          : env.DB.prepare(sql);
        const { results } = await stmt.all();
        return json(results);
      }

      // ── POST /api/feedback ──
      if (pathname === '/api/feedback' && request.method === 'POST') {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);

        const body = await request.json();
        const { category, message, name, wa_number, priority, status, type } = body;

        if (!category || !message) return json({ error: 'Category dan message wajib diisi' }, 400);
        if (!['bug', 'saran', 'umum'].includes(category)) return json({ error: 'Category tidak valid' }, 400);
        if (priority && !['low', 'medium', 'high'].includes(priority)) return json({ error: 'Priority tidak valid' }, 400);

        const feedbackType = type || 'feedback';
        if (!['feedback', 'idea'].includes(feedbackType)) return json({ error: 'Type tidak valid' }, 400);

        const feedbackStatus = status || 'todo';
        if (!['todo', 'in_progress', 'hold', 'done', 'archived'].includes(feedbackStatus)) return json({ error: 'Status tidak valid' }, 400);

        const id = crypto.randomUUID();
        const createdAt = new Date().toISOString();

        await env.DB.prepare(
          'INSERT INTO feedback (id, type, category, message, name, wa_number, priority, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(id, feedbackType, category, message, name || null, wa_number || null, priority || null, feedbackStatus, createdAt).run();

        const entry = await env.DB.prepare('SELECT * FROM feedback WHERE id = ?').bind(id).first();
        return json(entry, 201);
      }

      // ── PATCH /api/feedback/:id ──
      const feedbackIdMatch = pathname.match(/^\/api\/feedback\/([^/]+)$/);
      if (feedbackIdMatch && request.method === 'PATCH') {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);
        if (admin.role !== 'super_admin') return json({ error: 'Hanya super_admin yang dapat mengubah feedback' }, 403);

        const feedbackId = feedbackIdMatch[1];
        const existing = await env.DB.prepare('SELECT * FROM feedback WHERE id = ?').bind(feedbackId).first();
        if (!existing) return json({ error: 'Feedback tidak ditemukan' }, 404);

        const body = await request.json();
        const setClauses = [];
        const vals = [];

        if (body.status !== undefined) {
          if (!['todo', 'in_progress', 'hold', 'done', 'archived'].includes(body.status)) {
            return json({ error: 'Status tidak valid' }, 400);
          }
          setClauses.push('status = ?');
          vals.push(body.status);
        }

        if (body.priority !== undefined) {
          if (body.priority !== null && !['low', 'medium', 'high'].includes(body.priority)) {
            return json({ error: 'Priority tidak valid' }, 400);
          }
          setClauses.push('priority = ?');
          vals.push(body.priority);
        }

        if (body.type !== undefined) {
          if (!['feedback', 'idea'].includes(body.type)) {
            return json({ error: 'Type tidak valid' }, 400);
          }
          setClauses.push('type = ?');
          vals.push(body.type);
        }

        if (body.category !== undefined) {
          if (!['bug', 'saran', 'umum'].includes(body.category)) {
            return json({ error: 'Category tidak valid' }, 400);
          }
          setClauses.push('category = ?');
          vals.push(body.category);
        }

        if (body.message !== undefined) {
          if (!body.message || !body.message.trim()) {
            return json({ error: 'Message tidak boleh kosong' }, 400);
          }
          setClauses.push('message = ?');
          vals.push(body.message.trim());
        }

        if (body.name !== undefined) {
          setClauses.push('name = ?');
          vals.push(body.name || null);
        }

        if (body.wa_number !== undefined) {
          setClauses.push('wa_number = ?');
          vals.push(body.wa_number || null);
        }

        if (setClauses.length === 0) {
          return json({ error: 'Tidak ada data untuk diperbarui' }, 400);
        }

        vals.push(feedbackId);
        await env.DB.prepare(
          'UPDATE feedback SET ' + setClauses.join(', ') + ' WHERE id = ?'
        ).bind(...vals).run();

        const updated = await env.DB.prepare('SELECT * FROM feedback WHERE id = ?').bind(feedbackId).first();
        return json(updated);
      }

      if (feedbackIdMatch && request.method === 'DELETE') {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);
        if (admin.role !== 'super_admin') return json({ error: 'Hanya super_admin yang dapat menghapus feedback' }, 403);

        const feedbackId = feedbackIdMatch[1];
        const existing = await env.DB.prepare('SELECT * FROM feedback WHERE id = ?').bind(feedbackId).first();
        if (!existing) return json({ error: 'Feedback tidak ditemukan' }, 404);

        await env.DB.prepare('DELETE FROM feedback WHERE id = ?').bind(feedbackId).run();
        return json({ ok: true });
      }

      // ── GET /api/analytics/overview ──
      if (pathname === '/api/analytics/overview' && request.method === 'GET') {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);
        const url = new URL(request.url);
        const { from, to } = getDateRange(url);
        const row = await env.DB.prepare(
          `SELECT
            SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) as total_page_views,
            COUNT(DISTINCT CASE WHEN event_type = 'page_view' THEN ip_hash END) as unique_visitors,
            SUM(CASE WHEN event_type = 'review_submitted' THEN 1 ELSE 0 END) as total_reviews,
            SUM(CASE WHEN event_type = 'masjid_submitted' THEN 1 ELSE 0 END) as total_masjids
          FROM analytics_events WHERE created_at BETWEEN ? AND ?`
        ).bind(from, to).first();
        return json(row);
      }

      // ── GET /api/analytics/cta-summary ──
      if (pathname === '/api/analytics/cta-summary' && request.method === 'GET') {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);
        const url = new URL(request.url);
        const { from, to } = getDateRange(url);
        const { results } = await env.DB.prepare(
          `SELECT event_type, COUNT(*) as count FROM analytics_events
          WHERE event_type IN ('cta_click_tulis_review','cta_click_tambah_masjid','ig_link_click','maps_link_click')
            AND created_at BETWEEN ? AND ?
          GROUP BY event_type`
        ).bind(from, to).all();
        return json(results);
      }

      // ── GET /api/analytics/filter-usage ──
      if (pathname === '/api/analytics/filter-usage' && request.method === 'GET') {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);
        const url = new URL(request.url);
        const { from, to } = getDateRange(url);
        const { results: cities } = await env.DB.prepare(
          `SELECT json_extract(event_data, '$.city') as name, COUNT(*) as count
          FROM analytics_events
          WHERE event_type = 'filter_city' AND created_at BETWEEN ? AND ?
          GROUP BY name ORDER BY count DESC LIMIT 10`
        ).bind(from, to).all();
        const { results: preferences } = await env.DB.prepare(
          `SELECT json_extract(event_data, '$.preference') as name, COUNT(*) as count
          FROM analytics_events
          WHERE event_type = 'filter_preference' AND created_at BETWEEN ? AND ?
          GROUP BY name ORDER BY count DESC LIMIT 10`
        ).bind(from, to).all();
        return json({ cities, preferences });
      }

      // ── GET /api/analytics/conversions ──
      if (pathname === '/api/analytics/conversions' && request.method === 'GET') {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);
        const url = new URL(request.url);
        const { from, to } = getDateRange(url);
        const { results } = await env.DB.prepare(
          `SELECT event_type, COUNT(*) as count FROM analytics_events
          WHERE event_type IN ('page_view','login_start','login_success','review_submitted')
            AND created_at BETWEEN ? AND ?
          GROUP BY event_type`
        ).bind(from, to).all();
        return json(results);
      }

      // ── GET /api/analytics/peak-hours ──
      if (pathname === '/api/analytics/peak-hours' && request.method === 'GET') {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);
        const url = new URL(request.url);
        const { from, to } = getDateRange(url);
        const { results } = await env.DB.prepare(
          `SELECT CAST(strftime('%H', created_at) AS INTEGER) as hour, COUNT(*) as count
          FROM analytics_events WHERE created_at BETWEEN ? AND ?
          GROUP BY hour ORDER BY hour`
        ).bind(from, to).all();
        return json(results);
      }

      // ── GET /api/analytics/city-traffic ──
      if (pathname === '/api/analytics/city-traffic' && request.method === 'GET') {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);
        const url = new URL(request.url);
        const { from, to } = getDateRange(url);
        const { results } = await env.DB.prepare(
          `SELECT json_extract(event_data, '$.city') as city, COUNT(*) as count
          FROM analytics_events
          WHERE event_type = 'filter_city' AND created_at BETWEEN ? AND ?
          GROUP BY city ORDER BY count DESC`
        ).bind(from, to).all();
        return json(results);
      }

      // ── GET /api/analytics/top-pages ──
      if (pathname === '/api/analytics/top-pages' && request.method === 'GET') {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);
        const url = new URL(request.url);
        const { from, to } = getDateRange(url);
        const { results } = await env.DB.prepare(
          `SELECT page, COUNT(*) as count FROM analytics_events
          WHERE event_type = 'page_view' AND created_at BETWEEN ? AND ? AND page IS NOT NULL
          GROUP BY page ORDER BY count DESC LIMIT 20`
        ).bind(from, to).all();
        return json(results);
      }

      // ── GET /api/analytics/export ──
      if (pathname === '/api/analytics/export' && request.method === 'GET') {
        const admin = await getSession(request, env);
        if (!admin) return json({ error: 'Unauthorized' }, 401);
        const url = new URL(request.url);
        const { from, to } = getDateRange(url);
        const eventType = url.searchParams.get('event_type');

        let sql = 'SELECT id, event_type, event_data, page, session_id, ip_hash, created_at FROM analytics_events WHERE created_at BETWEEN ? AND ?';
        const params = [from, to];
        if (eventType) {
          sql += ' AND event_type = ?';
          params.push(eventType);
        }
        sql += ' ORDER BY created_at DESC';

        const { results } = await env.DB.prepare(sql).bind(...params).all();

        const csvHeaders = 'id,event_type,event_data,page,session_id,ip_hash,created_at';
        const csvRows = results.map(r =>
          [r.id, r.event_type, '"' + (r.event_data || '').replace(/"/g, '""') + '"', r.page || '', r.session_id || '', r.ip_hash || '', r.created_at || ''].join(',')
        );
        const csv = csvHeaders + '\n' + csvRows.join('\n');

        return new Response(csv, {
          status: 200,
          headers: {
            ...getCorsHeaders(request),
            ...SECURITY_HEADERS,
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename=analytics_export.csv',
          },
        });
      }

      // ── Serve HTML for all other routes ──
      return new Response(HTML, {
        headers: { ...SECURITY_HEADERS, 'Content-Type': 'text/html;charset=UTF-8' },
      });

    } catch (err) {
      return json({ error: 'Internal server error' }, 500);
    }
  },
};
