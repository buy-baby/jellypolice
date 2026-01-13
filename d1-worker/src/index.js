import { Router } from "itty-router";
import bcrypt from "bcryptjs";
const router = Router();

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json; charset=utf-8" },
    ...init,
  });
}
function ok() {
  return new Response(null, { status: 204 });
}
function unauthorized() {
  return json({ error: "unauthorized" }, { status: 401 });
}
async function readBody(request) {
  const text = await request.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}
function isAdmin(request, env) {
  const token = env.API_TOKEN || "";
  if (!token) return true;
  const auth = request.headers.get("authorization") || "";
  return auth === `Bearer ${token}`;
}

// -------------------DEFAULT----------------------
const DEFAULT_PAGES = {
  agency: {
    title: "젤리경찰청 기관 소개",
    content: "젤리 경찰청은 시민의 안전과 질서를 위해 존재합니다.",
  },
  rank: {
    title: "젤리경찰청 직급표",
    high: { 치안총감: "", 치안정감: "", 치안감: "" },
    mid: { 경무관: "", 총경: "", 경정: "", 경감: "" },
    normal: {
      경위: ["", "", "", "", ""],
      경사: ["", "", "", "", ""],
      경장: ["", "", "", "", ""],
      순경: ["", "", "", "", ""],
    },
    probation: ["", "", "", "", ""],
  },
  department: {
    title: "부서 소개",
    teams: [
      { name: "감사팀", desc: "※ 세부 내용은 관리자 페이지에서 수정 가능합니다." },
      { name: "인사팀", desc: "※ 세부 내용은 관리자 페이지에서 수정 가능합니다." },
      { name: "특수 검거 기동대(SCP)", desc: "※ 세부 내용은 관리자 페이지에서 수정 가능합니다." },
      { name: "특공대(SOU)", desc: "※ 세부 내용은 관리자 페이지에서 수정 가능합니다." },
      { name: "항공팀(ASD)", desc: "※ 세부 내용은 관리자 페이지에서 수정 가능합니다." },
    ],
  },

  apply_conditions: {
    title: "젤리 경찰청 채용 안내",
    cards: {
      eligibility: {
        title: "지원 자격 안내",
        content: "※ 세부 내용은 관리자 페이지에서 수정 가능합니다.",
      },
      disqualify: {
        title: "지원 불가 사유",
        content: "※ 세부 내용은 관리자 페이지에서 수정 가능합니다.",
      },
      preference: {
        title: "지원 우대 사항",
        content: "※ 세부 내용은 관리자 페이지에서 수정 가능합니다.",
      },
    },
    side: {
      linkText: "링크1",
      linkUrl: "#",
    },
  },
};

async function getOrSeedPage(env, key) {
  const row = await env.DB.prepare("SELECT page_json FROM pages WHERE page_key = ?")
    .bind(key)
    .first();

  if (row && row.page_json) {
    try {
      return JSON.parse(row.page_json);
    } catch {
      return DEFAULT_PAGES[key] || {};
    }
  }

  const data = DEFAULT_PAGES[key] || {};
  await env.DB.prepare(
    "INSERT OR REPLACE INTO pages(page_key, page_json, updated) VALUES(?, ?, ?)"
  )
    .bind(key, JSON.stringify(data), new Date().toISOString())
    .run();

  return data;
}

async function setPage(env, key, data) {
  await env.DB.prepare(
    "INSERT OR REPLACE INTO pages(page_key, page_json, updated) VALUES(?, ?, ?)"
  )
    .bind(key, JSON.stringify(data || {}), new Date().toISOString())
    .run();
}

// ---- Root ----
router.get("/", () =>
  new Response("Jelly Police D1 API is running", {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
);

// ---- Health ----
router.get("/api/health", () => json({ ok: true }));

// ---- Pages ----
router.get("/api/agency", async (req, env) => json(await getOrSeedPage(env, "agency")));
router.get("/api/rank", async (req, env) => json(await getOrSeedPage(env, "rank")));
router.get("/api/department", async (req, env) => json(await getOrSeedPage(env, "department")));
router.get("/api/apply/conditions", async (req, env) =>
  json(await getOrSeedPage(env, "apply_conditions"))
);

router.put("/api/agency", async (req, env) => {
  if (!isAdmin(req, env)) return unauthorized();
  await setPage(env, "agency", await readBody(req));
  return ok();
});
router.put("/api/rank", async (req, env) => {
  if (!isAdmin(req, env)) return unauthorized();
  await setPage(env, "rank", await readBody(req));
  return ok();
});
router.put("/api/department", async (req, env) => {
  if (!isAdmin(req, env)) return unauthorized();
  await setPage(env, "department", await readBody(req));
  return ok();
});
router.put("/api/apply/conditions", async (req, env) => {
  if (!isAdmin(req, env)) return unauthorized();
  await setPage(env, "apply_conditions", await readBody(req));
  return ok();
});

// ---- Notices ----
router.get("/api/notices", async (req, env) => {
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") || 5), 20);

  const { results } = await env.DB.prepare(
    "SELECT id, title, content, created FROM notices ORDER BY id DESC LIMIT ?"
  )
    .bind(limit)
    .all();

  return json(results || []);
});

router.post("/api/notices", async (req, env) => {
  if (!isAdmin(req, env)) return unauthorized();

  const body = await readBody(req);
  const title = (body.title || "").trim();
  const content = (body.content || "").trim();
  if (!title || !content) return json({ error: "title/content required" }, { status: 400 });

  const created = new Date().toISOString();

  const r = await env.DB.prepare(
    "INSERT INTO notices(title, content, created) VALUES(?, ?, ?)"
  )
    .bind(title, content, created)
    .run();

  return json({ ok: true, id: r.meta?.last_row_id ?? null });
});

router.get("/api/notices/:id", async (req, env) => {
  const id = Number(req.params.id);
  if (!id) return json({ error: "bad_id" }, { status: 400 });

  const row = await env.DB.prepare(
    "SELECT id, title, content, created FROM notices WHERE id = ?"
  )
    .bind(id)
    .first();

  if (!row) return json({ error: "not_found" }, { status: 404 });
  return json(row);
});

router.put("/api/notices/:id", async (req, env) => {
  if (!isAdmin(req, env)) return unauthorized();

  const id = Number(req.params.id);
  if (!id) return json({ error: "bad_id" }, { status: 400 });

  const body = await readBody(req);
  const title = (body.title || "").trim();
  const content = (body.content || "").trim();
  if (!title || !content) return json({ error: "title/content required" }, { status: 400 });

  const r = await env.DB.prepare(
    "UPDATE notices SET title = ?, content = ? WHERE id = ?"
  )
    .bind(title, content, id)
    .run();
  if (!r.meta || r.meta.changes === 0) return json({ error: "not_found" }, { status: 404 });

  return ok();
});

router.delete("/api/notices/:id", async (req, env) => {
  if (!isAdmin(req, env)) return unauthorized();

  const id = Number(req.params.id);
  if (!id) return json({ error: "bad_id" }, { status: 400 });

  await env.DB.prepare("DELETE FROM notices WHERE id = ?").bind(id).run();
  return ok();
});

// ---- Complaints ----
router.get("/api/complaints", async (req, env) => {
  if (!isAdmin(req, env)) return unauthorized();

  const { results } = await env.DB.prepare(`
    SELECT 
      c.id,
      c.userId,
      c.name,
      c.identity,
      c.content,
      c.created,
      c.fileName,
      c.fileKey,
      c.status,
      c.statusUpdatedAt,

      u.username,
      u.nickname,
      u.uniqueCode,

      u.discord_id,
      u.discord_name,
      u.discord_last_verified_at

    FROM complaints c
    LEFT JOIN users u ON c.userId = u.id
    ORDER BY c.id DESC
  `).all();

  return json(results || []);
});

router.post("/api/complaints", async (req, env) => {
  const body = await readBody(req);
  const created = body.created || new Date().toISOString();

  const userId = body.userId ?? null;
  const status = (body.status || "미접수").trim();
  const statusUpdatedAt = new Date().toISOString();

  const r = await env.DB.prepare(
    "INSERT INTO complaints(userId, name, identity, content, created, fileName, fileKey, status, statusUpdatedAt) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(
      userId,
      body.name || "",
      body.identity || "",
      body.content || "",
      created,
      body.fileName || "",
      body.fileKey || "",
      status,
      statusUpdatedAt
    )
    .run();

  return json({ ok: true, id: r.meta?.last_row_id ?? null });
});

const ALLOWED_COMPLAINT_STATUS = new Set([
  "미접수",
  "접수 중",
  "접수 완료",
  "처리 중",
  "처리 완료",
]);

router.put("/api/complaints/:id/status", async (req, env) => {
  if (!isAdmin(req, env)) return unauthorized();

  const id = Number(req.params.id);
  if (!id) return json({ error: "bad_id" }, { status: 400 });

  const body = await readBody(req);
  const status = String(body.status || "").trim();

  if (!ALLOWED_COMPLAINT_STATUS.has(status)) {
    return json({ error: "invalid_status" }, { status: 400 });
  }

  const statusUpdatedAt = new Date().toISOString();

  const r = await env.DB.prepare(
    "UPDATE complaints SET status = ?, statusUpdatedAt = ? WHERE id = ?"
  )
    .bind(status, statusUpdatedAt, id)
    .run();

  if (!r.meta || r.meta.changes === 0) {
    return json({ error: "not_found" }, { status: 404 });
  }

  return ok();
});

// ---- Suggestions ----
router.get("/api/suggestions", async (req, env) => {
  if (!isAdmin(req, env)) return unauthorized();

  const { results } = await env.DB.prepare(`
    SELECT 
      s.id,
      s.userId,
      s.name,
      s.identity,
      s.content,
      s.created,
      u.username
    FROM suggestions s
    LEFT JOIN users u ON s.userId = u.id
    ORDER BY s.id DESC
  `).all();

  return json(results || []);
});

router.post("/api/suggestions", async (req, env) => {
  const body = await readBody(req);
  const created = body.created || new Date().toISOString();

  const userId = body.userId ?? null;

  const r = await env.DB.prepare(
    "INSERT INTO suggestions(userId, name, identity, content, created) VALUES(?, ?, ?, ?, ?)"
  )
    .bind(userId, body.name || "", body.identity || "", body.content || "", created)
    .run();

  return json({ ok: true, id: r.meta?.last_row_id ?? null });
});

// ---- register ----
router.post("/api/auth/register", async (req, env) => {
  const body = await readBody(req);

  const uniqueCode = (body.uniqueCode || "").trim();
  const nickname = (body.nickname || "").trim();
  const username = (body.username || "").trim();
  const password = body.password || "";
  const agree = body.agree === true;

  const discord_id = (body.discord_id || "").trim();
  const discord_name = (body.discord_name || "").trim();

  if (!uniqueCode || !nickname || !username || !password) {
    return json({ error: "all_fields_required" }, { status: 400 });
  }

  if (!agree) {
    return json({ error: "terms_not_agreed" }, { status: 400 });
  }

  if (!discord_id || !discord_name) {
    return json({ error: "discord_required" }, { status: 400 });
  }

  const discordExists = await env.DB.prepare(
    "SELECT id FROM users WHERE discord_id = ?"
  ).bind(discord_id).first();

  if (discordExists) {
    return json({ error: "discord_conflict" }, { status: 409 });
  }

  const exists = await env.DB.prepare(
    "SELECT id FROM users WHERE LOWER(username) = LOWER(?)"
  ).bind(username).first();

  if (exists) {
    return json({ error: "username_taken" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const createdAt = new Date().toISOString();
  const agreedAt = new Date().toISOString();
  const now = new Date().toISOString(); // ✅ 가입 시점에 갱신 시각 저장

  const r = await env.DB.prepare(
    `INSERT INTO users(
      uniqueCode, nickname, username, passwordHash, role, createdAt, agreed, agreedAt,
      discord_id, discord_name, discord_last_verified_at
    )
    VALUES(?, ?, ?, ?, 'user', ?, 1, ?, ?, ?, ?)`
  )
    .bind(
      uniqueCode,
      nickname,
      username,
      passwordHash,
      createdAt,
      agreedAt,
      discord_id,
      discord_name,
      now
    )
    .run();

  return json({ ok: true, id: r.meta?.last_row_id ?? null });
});

// --- login ---
router.post("/api/auth/login", async (req, env) => {
  const body = await readBody(req);

  const username = (body.username || "").trim();
  const password = body.password || "";

  if (!username || !password) {
    return json({ error: "username_password_required" }, { status: 400 });
  }

  const user = await env.DB.prepare(
    `SELECT
      id, uniqueCode, nickname, username, passwordHash, role, createdAt,
      discord_id, discord_name, discord_last_verified_at
     FROM users
     WHERE LOWER(username) = LOWER(?)`
  ).bind(username).first();

  if (!user) return json({ error: "invalid_credentials" }, { status: 401 });

  const okPw = await bcrypt.compare(password, user.passwordHash || "");
  if (!okPw) return json({ error: "invalid_credentials" }, { status: 401 });

  return json({
    id: user.id,
    uniqueCode: user.uniqueCode,
    nickname: user.nickname,
    username: user.username,
    role: user.role,
    createdAt: user.createdAt,

    discord_id: user.discord_id || "",
    discord_name: user.discord_name || "",
    discord_last_verified_at: user.discord_last_verified_at || "",
  });
});

// --- users (admin list) ---
router.get("/api/admin/users", async (req, env) => {
  if (!isAdmin(req, env)) return unauthorized();

  const { results } = await env.DB.prepare(
    `SELECT
      id, uniqueCode, nickname, username, role, createdAt,
      discord_id, discord_name, discord_last_verified_at
     FROM users
     ORDER BY id DESC
     LIMIT 500`
  ).all();

  return json(results || []);
});


// ✅ 디스코드 표시명/갱신시각 업데이트 (서버만 호출: 관리자 토큰 필요)
router.put("/api/users/:id/discord", async (req, env) => {
  if (!isAdmin(req, env)) return unauthorized();

  const id = Number(req.params.id);
  if (!id) return json({ error: "bad_id" }, { status: 400 });

  const body = await readBody(req);
  const discord_id = String(body.discord_id || "").trim();
  const discord_name = String(body.discord_name || "").trim();

  if (!discord_id || !discord_name) {
    return json({ error: "discord_required" }, { status: 400 });
  }

  const row = await env.DB.prepare(
    "SELECT discord_id FROM users WHERE id = ?"
  ).bind(id).first();

  if (!row) return json({ error: "not_found" }, { status: 404 });
  if (String(row.discord_id || "") !== discord_id) {
    return json({ error: "discord_mismatch" }, { status: 409 });
  }

  const now = new Date().toISOString();

  await env.DB.prepare(
    "UPDATE users SET discord_name = ?, discord_last_verified_at = ? WHERE id = ?"
  )
    .bind(discord_name, now, id)
    .run();

  return json({ ok: true, discord_last_verified_at: now });
});

// --- role ---
router.put("/api/admin/users/:id/role", async (req, env) => {
  if (!isAdmin(req, env)) return unauthorized();

  const id = Number(req.params.id);
  if (!id) return json({ error: "bad_id" }, { status: 400 });

  const body = await readBody(req);
  const role = body.role === "admin" ? "admin" : "user";

  const r = await env.DB.prepare(
    "UPDATE users SET role = ? WHERE id = ?"
  ).bind(role, id).run();

  if (!r.meta || r.meta.changes === 0) return json({ error: "not_found" }, { status: 404 });
  return ok();
});

router.all("*", () => json({ error: "not_found" }, { status: 404 }));

export default {
  async fetch(request, env, ctx) {
    return router.handle(request, env, ctx);
  },
};
