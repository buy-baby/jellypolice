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

// 시민용: 공지 목록 (기본 5개)
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

// 관리자용: 공지 추가
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

// 공지 단건 조회 (시민/관리자 공용)
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

// 관리자용: 공지 수정
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

  return ok(); // 204
});


// 관리자용: 공지 삭제
router.delete("/api/notices/:id", async (req, env) => {
  if (!isAdmin(req, env)) return unauthorized();

  const id = Number(req.params.id);
  if (!id) return json({ error: "bad_id" }, { status: 400 });

  await env.DB.prepare("DELETE FROM notices WHERE id = ?").bind(id).run();
  return ok(); // 204
});

// ---- Complaints ----
router.get("/api/complaints", async (req, env) => {
  if (!isAdmin(req, env)) return unauthorized();
  const { results } = await env.DB.prepare(
    "SELECT id, userId, name, identity, content, created, fileName, fileKey FROM complaints ORDER BY id DESC"
  ).all();
  return json(results || []);
});

router.post("/api/complaints", async (req, env) => {
  const body = await readBody(req);
  const created = body.created || new Date().toISOString();

  const userId = body.userId ?? null; // ✅ 추가

  const r = await env.DB.prepare(
    "INSERT INTO complaints(userId, name, identity, content, created, fileName, fileKey) VALUES(?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(
      userId,
      body.name || "",
      body.identity || "",
      body.content || "",
      created,
      body.fileName || "",
      body.fileKey || ""
    )
    .run();

  return json({ ok: true, id: r.meta?.last_row_id ?? null });
});


// ---- Suggestions ----
router.get("/api/suggestions", async (req, env) => {
  if (!isAdmin(req, env)) return unauthorized();
  const { results } = await env.DB.prepare(
    "SELECT id, userId, name, identity, content, created FROM suggestions ORDER BY id DESC"
  ).all();
  return json(results || []);
});

router.post("/api/suggestions", async (req, env) => {
  const body = await readBody(req);
  const created = body.created || new Date().toISOString();

  const userId = body.userId ?? null; // ✅ 추가

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

  if (!uniqueCode || !nickname || !username || !password) {
    return json({ error: "all_fields_required" }, { status: 400 });
  }

  // 중복 체크
  const exists = await env.DB.prepare(
    "SELECT id FROM users WHERE LOWER(username) = LOWER(?)"
  ).bind(username).first();

  if (exists) {
    return json({ error: "username_taken" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const createdAt = new Date().toISOString();

  const r = await env.DB.prepare(
    "INSERT INTO users(uniqueCode, nickname, username, passwordHash, role, createdAt) VALUES(?, ?, ?, ?, 'user', ?)"
  )
    .bind(uniqueCode, nickname, username, passwordHash, createdAt)
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
    "SELECT id, uniqueCode, nickname, username, passwordHash, role, createdAt FROM users WHERE LOWER(username) = LOWER(?)"
  ).bind(username).first();

  // 보안상 아이디/비번 틀림은 같은 메시지
  if (!user) return json({ error: "invalid_credentials" }, { status: 401 });

  const okPw = await bcrypt.compare(password, user.passwordHash || "");
  if (!okPw) return json({ error: "invalid_credentials" }, { status: 401 });

  // passwordHash는 절대 반환하지 않기
  return json({
    id: user.id,
    uniqueCode: user.uniqueCode,
    nickname: user.nickname,
    username: user.username,
    role: user.role,
    createdAt: user.createdAt,
  });
});

// --- users ---

router.get("/api/admin/users", async (req, env) => {
  if (!isAdmin(req, env)) return unauthorized();

  const { results } = await env.DB.prepare(
    "SELECT id, uniqueCode, nickname, username, role, createdAt FROM users ORDER BY id DESC LIMIT 500"
  ).all();

  return json(results || []);
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