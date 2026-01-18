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
  if (!token) return true; // 토큰 미설정이면 전체 허용(개발용)
  const auth = request.headers.get("authorization") || "";
  return auth === `Bearer ${token}`;
}

// ------------------- DEFAULT ----------------------
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
      eligibility: { title: "지원 자격 안내", content: "※ 세부 내용은 관리자 페이지에서 수정 가능합니다." },
      disqualify: { title: "지원 불가 사유", content: "※ 세부 내용은 관리자 페이지에서 수정 가능합니다." },
      preference: { title: "지원 우대 사항", content: "※ 세부 내용은 관리자 페이지에서 수정 가능합니다." },
    },
    side: { linkText: "링크1", linkUrl: "#" },
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

// =======================================================
// ✅ FAQ (Public + Admin)
// - Public:  GET /api/faqs?limit=5
// - Admin :  GET /api/admin/faqs
//            POST /api/admin/faqs
//            GET /api/admin/faqs/:id
//            PUT /api/admin/faqs/:id
//            DELETE /api/admin/faqs/:id
// =======================================================

router.get("/api/faqs", async (req, env) => {
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") || 5), 20);

  const { results } = await env.DB.prepare(
    "SELECT id, title, content, created_at, updated_at FROM faqs ORDER BY id DESC LIMIT ?"
  )
    .bind(limit)
    .all();

  return json(results || []);
});

router.get("/api/admin/faqs", async (req, env) => {
  if (!isAdmin(req, env)) return unauthorized();

  const { results } = await env.DB.prepare(
    "SELECT id, title, content, created_at, updated_at FROM faqs ORDER BY id DESC LIMIT 500"
  ).all();

  return json(results || []);
});

router.post("/api/admin/faqs", async (req, env) => {
  if (!isAdmin(req, env)) return unauthorized();

  const body = await readBody(req);
  const title = (body.title || "").trim();
  const content = (body.content || "").trim();
  if (!title || !content) return json({ error: "title/content required" }, { status: 400 });

  const now = new Date().toISOString();

  const r = await env.DB.prepare(
    "INSERT INTO faqs(title, content, created_at, updated_at) VALUES(?, ?, ?, ?)"
  )
    .bind(title, content, now, now)
    .run();

  return json({ ok: true, id: r.meta?.last_row_id ?? null });
});

router.get("/api/admin/faqs/:id", async (req, env) => {
  if (!isAdmin(req, env)) return unauthorized();

  const id = Number(req.params.id);
  if (!id) return json({ error: "bad_id" }, { status: 400 });

  const row = await env.DB.prepare(
    "SELECT id, title, content, created_at, updated_at FROM faqs WHERE id = ?"
  )
    .bind(id)
    .first();

  if (!row) return json({ error: "not_found" }, { status: 404 });
  return json(row);
});

router.put("/api/admin/faqs/:id", async (req, env) => {
  if (!isAdmin(req, env)) return unauthorized();

  const id = Number(req.params.id);
  if (!id) return json({ error: "bad_id" }, { status: 400 });

  const body = await readBody(req);
  const title = (body.title || "").trim();
  const content = (body.content || "").trim();
  if (!title || !content) return json({ error: "title/content required" }, { status: 400 });

  const now = new Date().toISOString();

  const r = await env.DB.prepare(
    "UPDATE faqs SET title = ?, content = ?, updated_at = ? WHERE id = ?"
  )
    .bind(title, content, now, id)
    .run();

  if (!r.meta || r.meta.changes === 0) return json({ error: "not_found" }, { status: 404 });
  return ok();
});

router.delete("/api/admin/faqs/:id", async (req, env) => {
  if (!isAdmin(req, env)) return unauthorized();

  const id = Number(req.params.id);
  if (!id) return json({ error: "bad_id" }, { status: 400 });

  const r = await env.DB.prepare("DELETE FROM faqs WHERE id = ?").bind(id).run();
  if (!r.meta || r.meta.changes === 0) return json({ error: "not_found" }, { status: 404 });

  return ok();
});

// ---- Notices ----
router.get("/api/notices", async (req, env) => {
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") || 5), 20);

  const { results } = await env.DB.prepare(
    "SELECT id, title, content, created, pinned FROM notices ORDER BY pinned DESC, id DESC LIMIT ?"
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
  const pinned = Number(body.pinned) === 1 ? 1 : 0;

  const r = await env.DB.prepare(
    "INSERT INTO notices(title, content, created, pinned) VALUES(?, ?, ?, ?)"
  )
    .bind(title, content, created, pinned)
    .run();

  return json({ ok: true, id: r.meta?.last_row_id ?? null });
});

router.get("/api/notices/:id", async (req, env) => {
  const id = Number(req.params.id);
  if (!id) return json({ error: "bad_id" }, { status: 400 });

  const row = await env.DB.prepare(
    "SELECT id, title, content, created, pinned FROM notices WHERE id = ?"
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

  // pinned만 바꾸는 요청 지원
  if (Object.prototype.hasOwnProperty.call(body, "pinned")) {
    const pinned = Number(body.pinned) === 1 ? 1 : 0;

    const r = await env.DB.prepare(
      "UPDATE notices SET pinned = ? WHERE id = ?"
    )
      .bind(pinned, id)
      .run();

    if (!r.meta || r.meta.changes === 0) return json({ error: "not_found" }, { status: 404 });
    return ok();
  }

  // title/content 수정
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
      c.content,
      c.created,
      c.fileName,
      c.fileKey,
      c.status,
      c.statusUpdatedAt,

      u.username,
      u.nickname,

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
  const status = String(body.status || "미접수").trim();
  const statusUpdatedAt = new Date().toISOString();

  const r = await env.DB.prepare(
    "INSERT INTO complaints(userId, name, content, created, fileName, fileKey, status, statusUpdatedAt) VALUES(?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(
      userId,
      body.name || "",
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

// ---- Free Board (자유게시판) ----

// 목록
router.get("/api/board/posts", async (req, env) => {
  if (!isAdmin(req, env)) return unauthorized();

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") || 10), 30);
  const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0);

  const { results } = await env.DB.prepare(`
    SELECT id, user_id, author_username, author_nickname, title, created_at
    FROM free_posts
    WHERE deleted = 0
    ORDER BY id DESC
    LIMIT ? OFFSET ?
  `).bind(limit, offset).all();

  return json(results || []);
});

// 글 상세 (+ 이미지 + 댓글)
router.get("/api/board/posts/:id", async (req, env) => {
  if (!isAdmin(req, env)) return unauthorized();

  const id = Number(req.params.id);
  if (!id) return json({ error: "bad_id" }, { status: 400 });

  const post = await env.DB.prepare(`
    SELECT id, user_id, author_username, author_nickname, title, content, created_at, updated_at
    FROM free_posts
    WHERE id = ? AND deleted = 0
  `).bind(id).first();

  if (!post) return json({ error: "not_found" }, { status: 404 });

  const { results: images } = await env.DB.prepare(`
    SELECT id, post_id, file_name, file_key, content_type, size, created_at
    FROM free_post_images
    WHERE post_id = ?
    ORDER BY id ASC
  `).bind(id).all();

  const { results: comments } = await env.DB.prepare(`
    SELECT id, post_id, user_id, author_username, author_nickname, content, created_at
    FROM free_post_comments
    WHERE post_id = ? AND deleted = 0
    ORDER BY id ASC
  `).bind(id).all();

  return json({ post, images: images || [], comments: comments || [] });
});

// 글 작성 (id 먼저 생성)
router.post("/api/board/posts", async (req, env) => {
  if (!isAdmin(req, env)) return unauthorized();

  const body = await readBody(req);
  const user_id = body.user_id ?? null;
  const author_username = (body.author_username || "").slice(0, 60);
  const author_nickname = (body.author_nickname || "").slice(0, 60);

  const title = (body.title || "").trim().slice(0, 120);
  const content = (body.content || "").trim().slice(0, 20000);

  if (!user_id || !title || !content) {
    return json({ error: "required" }, { status: 400 });
  }

  const now = new Date().toISOString();

  const r = await env.DB.prepare(`
    INSERT INTO free_posts(
      user_id, author_username, author_nickname,
      title, content, created_at, updated_at, deleted
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `).bind(
    user_id, author_username, author_nickname,
    title, content, now, now
  ).run();

  return json({ ok: true, id: r.meta?.last_row_id ?? null });
});

// 글 이미지 등록 (R2 업로드는 서버가 하고, key만 저장)
router.post("/api/board/posts/:id/images", async (req, env) => {
  if (!isAdmin(req, env)) return unauthorized();

  const postId = Number(req.params.id);
  if (!postId) return json({ error: "bad_id" }, { status: 400 });

  const body = await readBody(req);
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) return ok();

  const now = new Date().toISOString();

  // 여러개 insert
  for (const it of items.slice(0, 10)) {
    const file_name = String(it.file_name || "").slice(0, 200);
    const file_key = String(it.file_key || "").slice(0, 400);
    const content_type = String(it.content_type || "").slice(0, 100);
    const size = Number(it.size || 0) || 0;

    if (!file_key) continue;

    await env.DB.prepare(`
      INSERT INTO free_post_images(post_id, file_name, file_key, content_type, size, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(postId, file_name, file_key, content_type, size, now).run();
  }

  return ok();
});

// 댓글 작성
router.post("/api/board/posts/:id/comments", async (req, env) => {
  if (!isAdmin(req, env)) return unauthorized();

  const postId = Number(req.params.id);
  if (!postId) return json({ error: "bad_id" }, { status: 400 });

  const body = await readBody(req);
  const user_id = body.user_id ?? null;
  const author_username = (body.author_username || "").slice(0, 60);
  const author_nickname = (body.author_nickname || "").slice(0, 60);

  const content = (body.content || "").trim().slice(0, 2000);
  if (!user_id || !content) return json({ error: "required" }, { status: 400 });

  const now = new Date().toISOString();

  const r = await env.DB.prepare(`
    INSERT INTO free_post_comments(
      post_id, user_id, author_username, author_nickname,
      content, created_at, deleted
    ) VALUES (?, ?, ?, ?, ?, ?, 0)
  `).bind(postId, user_id, author_username, author_nickname, content, now).run();

  return json({ ok: true, id: r.meta?.last_row_id ?? null });
});

// 글 삭제 (작성자 or admin 판단은 "서버"에서 하고, Worker는 그냥 삭제 처리)
router.delete("/api/board/posts/:id", async (req, env) => {
  if (!isAdmin(req, env)) return unauthorized();

  const id = Number(req.params.id);
  if (!id) return json({ error: "bad_id" }, { status: 400 });

  const now = new Date().toISOString();
  await env.DB.prepare(`
    UPDATE free_posts SET deleted = 1, updated_at = ? WHERE id = ?
  `).bind(now, id).run();

  return ok();
});

// 댓글 삭제 (서버에서 권한 검사)
router.delete("/api/board/comments/:id", async (req, env) => {
  if (!isAdmin(req, env)) return unauthorized();

  const id = Number(req.params.id);
  if (!id) return json({ error: "bad_id" }, { status: 400 });

  await env.DB.prepare(`
    UPDATE free_post_comments SET deleted = 1 WHERE id = ?
  `).bind(id).run();

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
    "INSERT INTO suggestions(userId, name, content, created) VALUES(?, ?, ?, ?)"
  )
    .bind(userId, body.name || "", body.content || "", created)
    .run();

  return json({ ok: true, id: r.meta?.last_row_id ?? null });
});

// ---- register ----
router.post("/api/auth/register", async (req, env) => {
  const body = await readBody(req);

  const nickname = (body.nickname || "").trim();
  const username = (body.username || "").trim();
  const password = body.password || "";
  const agree = body.agree === true;

  const discord_id = (body.discord_id || "").trim();
  const discord_name = (body.discord_name || "").trim();

  if (!nickname || !username || !password) {
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
  const now = new Date().toISOString();

  const r = await env.DB.prepare(
    `INSERT INTO users(
      nickname, username, passwordHash, role, createdAt, agreed, agreedAt,
      discord_id, discord_name, discord_last_verified_at
    )
    VALUES(?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`
  )
    .bind(
      nickname,
      username,
      passwordHash,
      "user",
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
      id, nickname, username, passwordHash, role, createdAt,
      discord_id, discord_name, discord_last_verified_at
     FROM users
     WHERE LOWER(username) = LOWER(?)`
  ).bind(username).first();

  if (!user) return json({ error: "invalid_credentials" }, { status: 401 });

  const okPw = await bcrypt.compare(password, user.passwordHash || "");
  if (!okPw) return json({ error: "invalid_credentials" }, { status: 401 });

  return json({
    id: user.id,
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
      id, nickname, username, role, createdAt,
      discord_id, discord_name, discord_last_verified_at
     FROM users
     ORDER BY id DESC
     LIMIT 500`
  ).all();

  return json(results || []);
});

// ✅ 디스코드 표시명/갱신시각 업데이트
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

// ---- Audit Logs ----
router.post("/api/audit-logs", async (req, env) => {
  if (!isAdmin(req, env)) return unauthorized();

  const body = await readBody(req);
  const created = new Date().toISOString();

  const actor_user_id = body.actor_user_id ?? null;
  const actor_username = (body.actor_username || "").slice(0, 60);
  const actor_nickname = (body.actor_nickname || "").slice(0, 60);
  const actor_role = (body.actor_role || "").slice(0, 30);
  const actor_discord_id = (body.actor_discord_id || "").slice(0, 40);

  const action = (body.action || "").trim().slice(0, 80);
  if (!action) return json({ error: "action_required" }, { status: 400 });

  const target_type = (body.target_type || "").slice(0, 40);
  const target_id = body.target_id != null ? String(body.target_id).slice(0, 60) : "";
  const ip = (body.ip || "").slice(0, 80);
  const ua = (body.ua || "").slice(0, 200);
  const detail = body.detail != null ? JSON.stringify(body.detail).slice(0, 4000) : "";

  const r = await env.DB.prepare(
    `INSERT INTO audit_logs(
      created,
      actor_user_id, actor_username, actor_nickname, actor_role, actor_discord_id,
      action, target_type, target_id,
      ip, ua, detail
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      created,
      actor_user_id, actor_username, actor_nickname, actor_role, actor_discord_id,
      action, target_type, target_id,
      ip, ua, detail
    )
    .run();

  return json({ ok: true, id: r.meta?.last_row_id ?? null });
});

// 게시판 이미지 메타 단일 조회 (프록시용)
router.get("/api/board/images/:id", async (req, env) => {
  if (!isAdmin(req, env)) return unauthorized();

  const id = Number(req.params.id);
  if (!id) return json({ error: "bad_id" }, { status: 400 });

  const row = await env.DB.prepare(`
    SELECT id, post_id, file_name, file_key, content_type, size, created_at
    FROM free_post_images
    WHERE id = ?
  `).bind(id).first();

  if (!row) return json({ error: "not_found" }, { status: 404 });
  return json(row);
});

// ------------------- Board (Admin) ----------------------

// 관리자: 게시글 목록
router.get("/api/admin/board/posts", async (req, env) => {
  if (!isAdmin(req, env)) return unauthorized();

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200);

  // ⚠️ 테이블명이 다르면 여기만 바꾸면 됨
  const { results } = await env.DB.prepare(`
    SELECT
      p.id,
      p.title,
      p.created_at,
      p.author_user_id,
      u.username as author_username,
      u.nickname as author_nickname
    FROM board_posts p
    LEFT JOIN users u ON u.id = p.author_user_id
    ORDER BY p.id DESC
    LIMIT ?
  `).bind(limit).all();

  return json({ posts: results || [] });
});

// 관리자: 게시글 삭제 (댓글/이미지까지 같이 정리)
router.delete("/api/admin/board/posts/:id", async (req, env) => {
  if (!isAdmin(req, env)) return unauthorized();

  const id = Number(req.params.id);
  if (!id) return json({ error: "bad_id" }, { status: 400 });

  // 댓글 삭제(있다면)
  await env.DB.prepare("DELETE FROM board_comments WHERE post_id = ?").bind(id).run();

  // 이미지 메타 삭제(있다면)
  await env.DB.prepare("DELETE FROM board_images WHERE post_id = ?").bind(id).run();

  // 본문 삭제
  const r = await env.DB.prepare("DELETE FROM board_posts WHERE id = ?").bind(id).run();
  if (!r.meta || r.meta.changes === 0) return json({ error: "not_found" }, { status: 404 });

  return ok();
});


router.all("*", () => json({ error: "not_found" }, { status: 404 }));

export default {
  async fetch(request, env, ctx) {
    return router.handle(request, env, ctx);
  },
};
