// server.js (정리본)
// - 메인 FAQ: D1 Worker API(d1Api)로 가져오기
// - Admin FAQ: D1 Worker API로 CRUD
// - getNoticesSomehow / db.prepare 제거 (ReferenceError 방지)
// - /healthz 추가 (Render health check 안정화)
// - /my 중복 라우트 제거
// - 라우트 섹션별 정렬

const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const session = require("express-session");

const passport = require("passport");
const DiscordStrategy = require("passport-discord").Strategy;

// ✅ Discord Webhook helper
const { sendDiscordWebhook } = require("./src/discordWebhook");

const {
  getAgency, setAgency,
  getRank, setRank,
  getDepartment, setDepartment,
  listComplaints, listSuggestions,
  addComplaint, addSuggestion,
  getApplyConditions, setApplyConditions,
  listNotices, addNotice, deleteNotice,
  getNotice, updateNotice,
  addAuditLog,
  listAuditLogs, // (지금은 사용 안 해도 OK)
} = require("./src/storage");

const app = express();
const PORT = process.env.PORT || 3000;

// =========================
// 0) 안정화: 런타임 에러 로그
// =========================
process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});

// =========================
// 1) Cloudflare R2 (파일 저장용)
// =========================
const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY,
    secretAccessKey: process.env.R2_SECRET_KEY,
  },
});
const R2_BUCKET = process.env.R2_BUCKET_NAME;

// =========================
// 2) Redis(Valkey) 세션 스토어 (버전 호환)
// =========================
const { createClient } = require("redis");
const connectRedisImport = require("connect-redis");

function buildRedisStore(sessionModule) {
  if (connectRedisImport && typeof connectRedisImport.default === "function") {
    return connectRedisImport.default;
  }
  if (connectRedisImport && typeof connectRedisImport === "function" && connectRedisImport.name === "RedisStore") {
    return connectRedisImport;
  }
  if (connectRedisImport && typeof connectRedisImport === "function") {
    return connectRedisImport(sessionModule);
  }
  if (connectRedisImport && typeof connectRedisImport.RedisStore === "function") {
    return connectRedisImport.RedisStore;
  }
  return null;
}

const redisUrl = (process.env.REDIS_URL || "").trim();
let redisClient = null;
let redisStore = null;

if (redisUrl) {
  redisClient = createClient({ url: redisUrl });

  redisClient.on("error", (err) => {
    console.error("❌ Redis error:", err);
  });

  redisClient.connect()
    .then(() => console.log("✅ Redis connected"))
    .catch((e) => console.error("❌ Redis connect failed:", e));

  const RedisStore = buildRedisStore(session);
  if (!RedisStore) {
    console.error("❌ connect-redis export 형태를 인식하지 못했습니다. connect-redis 버전을 확인해주세요.");
  } else {
    redisStore = new RedisStore({
      client: redisClient,
      prefix: "sess:",
    });
  }
} else {
  console.warn("⚠️ REDIS_URL is not set. Falling back to MemoryStore (dev only).");
}

// =========================
// 3) D1 API helper (Worker 호출)
// =========================
async function d1Api(method, apiPath, body = null, token = process.env.D1_API_TOKEN || "") {
  const base = (process.env.D1_API_BASE || "").replace(/\/+$/, "");
  if (!base) throw new Error("D1_API_BASE is not set");

  const url = `${base}${apiPath}`;

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(`D1 API ${method} ${apiPath} failed: ${res.status} ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

// =========================
// 4) Express 기본 설정 / Middleware
// =========================
app.set("trust proxy", 1);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static("public"));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "public", "views"));

const upload = multer({ storage: multer.memoryStorage() });

app.use(session({
  store: redisStore || undefined,
  secret: process.env.SESSION_SECRET || "jellypolice-session-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 6, // 6시간
  }
}));

// locals
app.use((req, res, next) => {
  res.locals.me = req.session.user || null;
  res.locals.request = req;
  next();
});

// =========================
// 5) 감사 로그 헬퍼
// =========================
function getClientIp(req) {
  return (req.ip || "").toString();
}

async function auditLog(req, {
  action,
  targetType = "",
  targetId = "",
  detail = null,
} = {}) {
  try {
    const me = req.session?.user || null;

    await addAuditLog({
      actor_user_id: me?.id ?? null,
      actor_username: me?.username ?? "",
      actor_nickname: me?.nickname ?? "",
      actor_role: me?.role ?? "",
      actor_discord_id: me?.discord_id ?? "",
      action,
      target_type: targetType,
      target_id: targetId,
      ip: getClientIp(req),
      ua: req.headers["user-agent"] || "",
      detail,
    });
  } catch (e) {
    console.error("❌ auditLog failed:", e?.message || e);
  }
}

// =========================
// 6) 날짜 유틸 (KST)
// =========================
function formatKST(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
app.locals.formatKST = formatKST;

function formatKSTDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
app.locals.formatKSTDate = formatKSTDate;

// =========================
// 7) Discord 강제 갱신 관련
// =========================
function canRefreshDiscord(lastIso) {
  if (!lastIso) return true;
  const last = new Date(lastIso).getTime();
  if (!Number.isFinite(last)) return true;
  const diff = Date.now() - last;
  return diff >= 1000 * 60 * 60 * 24 * 7;
}
app.locals.canRefreshDiscord = canRefreshDiscord;

function shouldForceDiscordRefresh(req) {
  const me = req.session?.user;
  if (!me || !me.id) return false;
  if (!me.discord_id) return false;
  const last = me.discord_last_verified_at || "";
  return app.locals.canRefreshDiscord(last);
}

// =========================
// 8) Auth Guards
// =========================
const requireLogin = (req, res, next) => {
  if (req.session && req.session.user && req.session.user.id) return next();
  const nextUrl = encodeURIComponent(req.originalUrl || "/");
  return res.redirect(`/auth/required?next=${nextUrl}`);
};

const requireAdmin = (req, res, next) => {
  if (!req.session || !req.session.user) {
    const nextUrl = encodeURIComponent(req.originalUrl || "/admin");
    return res.redirect(`/auth/required?next=${nextUrl}`);
  }
  if (req.session.user.role === "admin") return next();
  return res.status(403).send("접근 권한이 없습니다.");
};

// =========================
// 9) Passport (Discord)
// =========================
app.use(passport.initialize());

passport.use(
  "discord-link",
  new DiscordStrategy(
    {
      clientID: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      callbackURL: process.env.DISCORD_LINK_CALLBACK_URL,
      scope: ["identify"],
    },
    (accessToken, refreshToken, profile, done) => {
      try {
        const discord_id = profile.id;
        const discord_name = profile.global_name || profile.username;
        return done(null, { discord_id, discord_name });
      } catch (e) {
        return done(e);
      }
    }
  )
);

// =========================
// 10) 강제 갱신 전역 미들웨어
// =========================
app.use((req, res, next) => {
  const allowPrefixes = [
    "/healthz",
    "/login",
    "/logout",
    "/register",
    "/auth/required",
    "/auth/discord",
    "/css",
    "/js",
    "/images",
    "/uploads",
    "/favicon",
    "/__routes",
  ];

  if (allowPrefixes.some(p => req.path.startsWith(p))) return next();

  if (req.session?.user?.id && shouldForceDiscordRefresh(req)) {
    req.session.discordFlow = {
      mode: "refresh",
      returnTo: req.originalUrl || "/",
    };
    return res.redirect("/auth/discord/refresh");
  }

  next();
});

// =========================
// 11) Debug / Health
// =========================
app.get("/healthz", (req, res) => res.status(200).send("ok"));

app.get("/__routes", (req, res) => {
  res.type("text").send(
`OK
/my/complaints
/my/complaints/:id
/my/suggestions
/my/suggestions/:id
`
  );
});

// =========================
// 12) Auth Pages
// =========================
app.get("/auth/required", (req, res) => {
  const nextUrl = req.query.next || "/";
  res.render("auth/required", {
    message: "해당 기능을 이용하기 위해서 로그인이 필요합니다.",
    nextUrl,
  });
});

// Discord Link (Register Flow)
app.get("/auth/discord/link", (req, res, next) => {
  req.session.discordFlow = { mode: "register", returnTo: "/register" };
  return passport.authenticate("discord-link", { session: false })(req, res, next);
});

// Discord Refresh (Forced Flow)
app.get("/auth/discord/refresh", requireLogin, (req, res, next) => {
  if (!req.session.discordFlow || req.session.discordFlow.mode !== "refresh") {
    req.session.discordFlow = { mode: "refresh", returnTo: req.query.next || "/" };
  }
  return passport.authenticate("discord-link", { session: false })(req, res, next);
});

// Discord Callback (Both flows)
app.get("/auth/discord/callback", (req, res, next) => {
  passport.authenticate("discord-link", { session: false }, async (err, user) => {
    if (err) {
      console.error("❌ Discord callback error:", err);
      if (req.session?.discordFlow?.mode === "refresh") return res.redirect("/auth/discord/refresh");
      return res.redirect("/register");
    }
    if (!user) {
      if (req.session?.discordFlow?.mode === "refresh") return res.redirect("/auth/discord/refresh");
      return res.redirect("/register");
    }

    const flow = req.session.discordFlow || { mode: "register", returnTo: "/register" };
    delete req.session.discordFlow;

    // register flow
    if (flow.mode === "register") {
      req.session.discordLink = {
        discord_id: user.discord_id,
        discord_name: user.discord_name,
      };
      return res.redirect(flow.returnTo || "/register");
    }

    // refresh flow
    if (flow.mode === "refresh") {
      try {
        const me = req.session.user;
        if (!me || !me.id) return res.redirect("/login");

        if (String(me.discord_id || "") !== String(user.discord_id || "")) {
          console.error("❌ discord id mismatch during refresh");
          req.session.discordFlow = { mode: "refresh", returnTo: flow.returnTo || "/" };
          return res.redirect("/auth/discord/refresh");
        }

        const result = await d1Api("PUT", `/api/users/${me.id}/discord`, {
          discord_id: me.discord_id,
          discord_name: user.discord_name,
        });

        req.session.user.discord_name = user.discord_name;
        req.session.user.discord_last_verified_at =
          result?.discord_last_verified_at || new Date().toISOString();

        await auditLog(req, {
          action: "discord_refresh",
          targetType: "user",
          targetId: me.id,
          detail: {
            discord_id: me.discord_id,
            discord_name: user.discord_name,
          },
        });

        return res.redirect(flow.returnTo || "/");
      } catch (e) {
        console.error("❌ Discord refresh update error:", e);
        req.session.discordFlow = { mode: "refresh", returnTo: flow.returnTo || "/" };
        return res.redirect("/auth/discord/refresh");
      }
    }

    return res.redirect("/");
  })(req, res, next);
});

app.get("/auth/discord/unlink", (req, res) => {
  delete req.session.discordLink;
  return res.redirect("/register");
});

// =========================
// 13) Register / Login / Logout
// =========================
app.get("/register", (req, res) => {
  res.render("auth/register", {
    error: null,
    form: {},
    discordLink: req.session.discordLink || null,
  });
});

app.post("/register", async (req, res) => {
  try {
    const nickname = (req.body.nickname || "").trim();
    const username = (req.body.username || "").trim();
    const password = (req.body.password || "");
    const discordLink = req.session.discordLink || null;

    if (!nickname || !username || !password) {
      return res.render("auth/register", { error: "모든 항목을 입력해주세요.", form: req.body, discordLink });
    }
    if (!req.body.agree) {
      return res.render("auth/register", { error: "약관 및 개인정보 처리방침에 동의해야 가입할 수 있습니다.", form: req.body, discordLink });
    }
    if (!discordLink || !discordLink.discord_id || !discordLink.discord_name) {
      return res.render("auth/register", { error: "디스코드 계정을 연결해야 가입할 수 있습니다.", form: req.body, discordLink: null });
    }

    await d1Api("POST", "/api/auth/register", {
      nickname,
      username,
      password,
      agree: !!req.body.agree,
      discord_id: discordLink.discord_id,
      discord_name: discordLink.discord_name,
    });

    await auditLog(req, {
      action: "auth_register",
      targetType: "auth",
      detail: { username, nickname, discord_id: discordLink.discord_id, discord_name: discordLink.discord_name },
    });

    delete req.session.discordLink;
    return res.redirect("/login");
  } catch (e) {
    console.error("❌ register error:", e);

    const msg = String(e.message || "");
    if (msg.includes(" 409 ")) {
      if (msg.includes("discord_conflict")) {
        return res.render("auth/register", { error: "이미 다른 계정에 연결된 디스코드입니다.", form: req.body, discordLink: req.session.discordLink || null });
      }
      if (msg.includes("username_taken")) {
        return res.render("auth/register", { error: "이미 사용 중인 아이디입니다.", form: req.body, discordLink: req.session.discordLink || null });
      }
      return res.render("auth/register", { error: "이미 사용 중인 정보가 있습니다.", form: req.body, discordLink: req.session.discordLink || null });
    }

    if (msg.includes("discord_required")) {
      return res.render("auth/register", { error: "디스코드 계정을 연결해야 가입할 수 있습니다.", form: req.body, discordLink: req.session.discordLink || null });
    }

    return res.render("auth/register", { error: "회원가입 중 오류가 발생했습니다.", form: req.body, discordLink: req.session.discordLink || null });
  }
});

app.get("/login", (req, res) => {
  const nextUrl = req.query.next || "/";
  res.render("auth/login", { error: null, nextUrl });
});

app.post("/login", async (req, res) => {
  try {
    const username = (req.body.username || "").trim();
    const password = req.body.password || "";
    const nextUrl = req.body.nextUrl || "/";

    if (!username || !password) {
      return res.render("auth/login", { error: "아이디와 비밀번호를 입력해주세요.", nextUrl });
    }

    const user = await d1Api("POST", "/api/auth/login", { username, password });

    req.session.user = {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      role: user.role || "user",
      discord_id: user.discord_id || "",
      discord_name: user.discord_name || "",
      discord_last_verified_at: user.discord_last_verified_at || "",
    };

    if (shouldForceDiscordRefresh(req)) {
      req.session.discordFlow = { mode: "refresh", returnTo: nextUrl || "/" };
      return res.redirect("/auth/discord/refresh");
    }

    return res.redirect(nextUrl || "/");
  } catch (e) {
    console.error("❌ login error:", e);
    const nextUrl = req.body.nextUrl || "/";
    return res.render("auth/login", { error: "아이디 또는 비밀번호가 올바르지 않습니다.", nextUrl });
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

// =========================
// 14) Admin (기본)
// =========================
app.get("/admin", requireAdmin, (_, res) => res.render("admin/admin_main"));

app.get("/admin/users", requireAdmin, async (req, res) => {
  try {
    const users = await d1Api("GET", "/api/admin/users");
    res.render("admin/users", { users });
  } catch (e) {
    console.error("❌ admin users list error:", e);
    return res.status(500).send("유저 목록을 불러오지 못했습니다.");
  }
});

app.post("/admin/users/:id/role", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const role = req.body.role === "admin" ? "admin" : "user";

    if (req.session.user && Number(req.session.user.id) === id && role !== "admin") {
      return res.status(400).send("자기 자신의 관리자 권한은 해제할 수 없습니다.");
    }

    await d1Api("PUT", `/api/admin/users/${id}/role`, { role });

    await auditLog(req, {
      action: "user_role_change",
      targetType: "user",
      targetId: id,
      detail: { role },
    });

    return res.redirect("/admin/users");
  } catch (e) {
    console.error("❌ admin role change error:", e);
    return res.status(500).send("권한 변경에 실패했습니다.");
  }
});

// =========================
// 15) Admin - Notices
// =========================
app.get("/admin/notices", requireAdmin, async (_, res) => {
  const notices = await listNotices(20);
  res.render("admin/notices", { notices });
});

app.post("/admin/notices", requireAdmin, async (req, res) => {
  await addNotice({ title: req.body.title || "", content: req.body.content || "" });

  await auditLog(req, {
    action: "notice_create",
    targetType: "notice",
    detail: { title: req.body.title || "" },
  });

  res.redirect("/admin/notices");
});

app.get("/admin/notices/delete/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await deleteNotice(id);

  await auditLog(req, {
    action: "notice_delete",
    targetType: "notice",
    targetId: id,
    detail: { via: "GET" },
  });

  res.redirect("/admin/notices");
});

app.get("/admin/notices/:id/edit", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const notice = await getNotice(id);
  if (!notice) return res.status(404).send("공지사항을 찾을 수 없습니다.");
  res.render("admin/notice_edit", { notice });
});

app.post("/admin/notices/:id/edit", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await updateNotice(id, { title: req.body.title || "", content: req.body.content || "" });

  await auditLog(req, {
    action: "notice_update",
    targetType: "notice",
    targetId: id,
    detail: { title: req.body.title || "" },
  });

  res.redirect("/admin/notices");
});

app.post("/admin/notices/:id/delete", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await deleteNotice(id);

  await auditLog(req, {
    action: "notice_delete",
    targetType: "notice",
    targetId: id,
    detail: { via: "POST" },
  });

  res.redirect("/admin/notices");
});

app.post("/admin/notices/:id/pin", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await updateNotice(id, { pinned: 1 });

    await auditLog(req, {
      action: "notice_pin",
      targetType: "notice",
      targetId: id,
      detail: { pinned: 1 },
    });

    return res.redirect("/admin/notices");
  } catch (e) {
    console.error("❌ notice pin error:", e);
    return res.status(500).send("공지 고정에 실패했습니다.");
  }
});

app.post("/admin/notices/:id/unpin", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await updateNotice(id, { pinned: 0 });

    await auditLog(req, {
      action: "notice_pin",
      targetType: "notice",
      targetId: id,
      detail: { pinned: 0 },
    });

    return res.redirect("/admin/notices");
  } catch (e) {
    console.error("❌ notice unpin error:", e);
    return res.status(500).send("공지 고정 해제에 실패했습니다.");
  }
});

// =========================
// 16) Admin - FAQ (D1 Worker API)
// =========================
// 필요 API (Worker에 구현 필요):
// GET    /api/faqs?limit=5               (public)
// GET    /api/admin/faqs                (admin list)
// POST   /api/admin/faqs                (admin create)
// GET    /api/admin/faqs/:id            (admin detail)
// PUT    /api/admin/faqs/:id            (admin update)
// DELETE /api/admin/faqs/:id            (admin delete)

app.get("/admin/faqs", requireAdmin, async (req, res) => {
  try {
    const result = await d1Api("GET", "/api/admin/faqs");
    const faqs = Array.isArray(result) ? result : (result?.faqs || []);
    return res.render("admin/faqs/index", { faqs });
  } catch (e) {
    console.error("❌ admin faqs list error:", e?.message || e);
    return res.render("admin/faqs/index", { faqs: [] });
  }
});

app.post("/admin/faqs", requireAdmin, async (req, res) => {
  try {
    const title = (req.body.title || "").trim();
    const content = (req.body.content || "").trim();
    if (!title || !content) return res.redirect("/admin/faqs");

    await d1Api("POST", "/api/admin/faqs", { title, content });

    await auditLog(req, {
      action: "faq_create",
      targetType: "faq",
      detail: { title },
    });

    return res.redirect("/admin/faqs");
  } catch (e) {
    console.error("❌ admin faq create error:", e?.message || e);
    return res.status(500).send("FAQ 추가에 실패했습니다.");
  }
});

app.get("/admin/faqs/:id/edit", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const faq = await d1Api("GET", `/api/admin/faqs/${id}`);
    if (!faq) return res.redirect("/admin/faqs");
    return res.render("admin/faqs/edit", { faq });
  } catch (e) {
    console.error("❌ admin faq edit page error:", e?.message || e);
    return res.redirect("/admin/faqs");
  }
});

app.post("/admin/faqs/:id/edit", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const title = (req.body.title || "").trim();
    const content = (req.body.content || "").trim();

    await d1Api("PUT", `/api/admin/faqs/${id}`, { title, content });

    await auditLog(req, {
      action: "faq_update",
      targetType: "faq",
      targetId: id,
      detail: { title },
    });

    return res.redirect("/admin/faqs");
  } catch (e) {
    console.error("❌ admin faq update error:", e?.message || e);
    return res.status(500).send("FAQ 수정에 실패했습니다.");
  }
});

app.post("/admin/faqs/:id/delete", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await d1Api("DELETE", `/api/admin/faqs/${id}`);

    await auditLog(req, {
      action: "faq_delete",
      targetType: "faq",
      targetId: id,
    });

    return res.redirect("/admin/faqs");
  } catch (e) {
    console.error("❌ admin faq delete error:", e?.message || e);
    return res.status(500).send("FAQ 삭제에 실패했습니다.");
  }
});

// =========================
// 17) Public Pages (Intro, Apply, Notice, Main 등)
// =========================
app.get("/", async (req, res) => {
  try {
    // board preview
    let boardPreview = [];
    try {
      const r = await d1Api("GET", "/api/board/posts?limit=5&offset=0");
      boardPreview = Array.isArray(r) ? r : [];
  } catch (e) {
      console.error("❌ board preview load error:", e?.message || e);
      boardPreview = [];
  }

    // 공지
    let notices = [];
    try {
      notices = await listNotices(5);
    } catch (e) {
      console.error("❌ main notices load error:", e);
      notices = [];
    }

    // FAQ
    let faqs = [];
    try {
      const result = await d1Api("GET", "/api/faqs?limit=5");
      faqs = Array.isArray(result) ? result : (result?.faqs || []);
    } catch (e) {
      console.error("❌ main faqs load error:", e?.message || e);
      faqs = [];
    }

    return res.render("main/main", { notices, faqs, boardPreview });
  } catch (e) {
    console.error("❌ main route fatal error:", e);
    return res.status(500).send("메인 페이지를 불러오지 못했습니다.");
  }
});

app.get("/intro/agency", async (_, res) => {
  const data = await getAgency();
  res.render("intro/intro_agency", { data });
});

app.get("/intro/rank", async (_, res) => {
  const data = await getRank();
  res.render("intro/intro_rank", { data });
});

app.get("/intro/department", async (_, res) => {
  const data = await getDepartment();
  res.render("intro/intro_department", { data });
});

app.get("/apply", (_, res) => res.render("apply/index"));

app.get("/apply/conditions", async (_, res) => {
  const data = await getApplyConditions();
  res.render("apply/apply_conditions", { data });
});

app.get("/apply/apply", (_, res) => {
  const url = process.env.APPLY_FORM_URL || "https://forms.gle/c7jvyTj2qzGhauKT8";
  return res.redirect(url);
});

app.get("/customer", (_, res) => res.render("customer/index"));

app.get("/notice", async (_, res) => {
  try {
    const notices = await listNotices(50);
    res.render("notice/list", { notices });
  } catch (e) {
    console.error("❌ /notice error:", e);
    res.status(500).send("공지 목록을 불러오지 못했습니다.");
  }
});

app.get("/notice/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const notice = await getNotice(id);
    if (!notice) return res.status(404).send("공지사항을 찾을 수 없습니다.");
    res.render("notice/view", { notice });
  } catch (e) {
    console.error("❌ /notice/:id error:", e);
    res.status(500).send("공지 상세를 불러오지 못했습니다.");
  }
});

// =========================
// 18) Admin Inquiry / Suggest
// =========================
app.get("/admin/inquiry", requireAdmin, async (_, res) => {
  const complaints = await listComplaints();
  res.render("admin/inquiry_list", { complaints });
});

app.get("/admin/inquiry/view/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);

  const complaints = await listComplaints();
  const c = (complaints || []).find((x) => Number(x.id) === id);
  if (!c) return res.status(404).send("민원을 찾을 수 없습니다.");

  res.render("admin/inquiry_view", { c });
});

app.post("/admin/inquiry/:id/status", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const status = (req.body.status || "").trim();

    await d1Api("PUT", `/api/complaints/${id}/status`, { status });

    await auditLog(req, {
      action: "complaint_status_update",
      targetType: "complaint",
      targetId: id,
      detail: { status },
    });

    return res.redirect(`/admin/inquiry/view/${id}`);
  } catch (e) {
    console.error("❌ status update error:", e);
    return res.status(500).send("상태 변경에 실패했습니다.");
  }
});

app.get("/admin/suggest", requireAdmin, async (_, res) => {
  const suggestions = await listSuggestions();
  res.render("admin/suggest_list", { suggestions });
});

app.get("/admin/suggest/view/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);

  const suggestions = await listSuggestions();
  const s = (suggestions || []).find((x) => Number(x.id) === id);
  if (!s) return res.status(404).send("건의를 찾을 수 없습니다.");

  res.render("admin/suggest_view", { s });
});

// =========================
// 19) Citizen Pages (민원/건의)
// =========================
app.get("/inquiry", requireLogin, (_, res) => res.render("inquiry/index"));
app.get("/suggest", requireLogin, (_, res) => res.render("suggest/suggest"));

app.get("/inquiry/success", (_, res) => res.render("inquiry/success"));
app.get("/suggest/success", (_, res) => res.render("suggest/success"));

// 민원 제출
app.post("/submit", requireLogin, upload.single("file"), async (req, res) => {
  try {
    const created = new Date().toISOString();

    let fileKey = "";
    let fileName = "";

    if (req.file) {
      fileName = req.file.originalname || "";

      if (
        process.env.R2_ENDPOINT &&
        process.env.R2_ACCESS_KEY &&
        process.env.R2_SECRET_KEY &&
        R2_BUCKET
      ) {
        fileKey = `complaints/${Date.now()}-${fileName}`.replace(/\s+/g, "_");

        await r2.send(
          new PutObjectCommand({
            Bucket: R2_BUCKET,
            Key: fileKey,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
          })
        );
      }
    }

    await addComplaint({
      userId: req.session.user.id,
      name: req.body.name || "",
      content: req.body.content || "",
      created,
      fileName,
      fileKey,
    });

    await auditLog(req, {
      action: "complaint_create",
      targetType: "complaint",
      detail: { name: req.body.name || "", hasFile: !!req.file },
    });

    // 디스코드 알림
    try {
      const me = req.session.user;
      const roleId = process.env.DISCORD_ROLE_MENTION_ID;
      const roleMention = roleId ? `<@&${roleId}>` : "";
      const author = me?.nickname || me?.username || "알 수 없음";

      await sendDiscordWebhook(process.env.DISCORD_WEBHOOK_COMPLAINT, {
        content: `${roleMention} ${author}님이 민원을 작성하였습니다`,
        allowed_mentions: { roles: roleId ? [roleId] : [] },
      });
    } catch (e) {
      console.error("❌ complaint webhook error:", e?.message || e);
    }

    return res.redirect("/inquiry/success");
  } catch (err) {
    console.error("❌ 민원 제출 오류:", err);
    return res.status(500).send("민원 제출 중 오류가 발생했습니다.");
  }
});

// 건의 제출
app.post("/suggest", requireLogin, async (req, res) => {
  try {
    const created = new Date().toISOString();

    await addSuggestion({
      userId: req.session.user.id,
      name: req.body.name || "",
      content: req.body.content || "",
      created,
    });

    await auditLog(req, {
      action: "suggestion_create",
      targetType: "suggestion",
      detail: { name: req.body.name || "" },
    });

    // 디스코드 알림(실패해도 건의 접수는 성공 처리)
    try {
      const me = req.session.user;
      const roleMention = "<@&1460793406535237733>";
      const author = me?.nickname || me?.username || "알 수 없음";

      await sendDiscordWebhook(process.env.DISCORD_WEBHOOK_SUGGESTION, {
        content: `${roleMention} ${author}님이 건의를 작성하였습니다`,
        allowed_mentions: { roles: ["1460793406535237733"] },
      });
    } catch (e) {
      console.error("❌ suggestion webhook error:", e?.message || e);
    }

    return res.redirect("/suggest/success");
  } catch (err) {
    console.error("❌ 건의 제출 오류:", err);
    return res.status(500).send("건의 제출 중 오류가 발생했습니다.");
  }
});

// -------------------- Free Board Pages --------------------

// 목록
app.get("/board", requireLogin, async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = 10;
    const offset = (page - 1) * limit;

    const posts = await d1Api("GET", `/api/board/posts?limit=${limit}&offset=${offset}`);

    return res.render("board/list", {
      posts: Array.isArray(posts) ? posts : [],
      page,
    });
  } catch (e) {
    console.error("❌ /board error:", e?.message || e);
    return res.status(500).send("자유게시판을 불러오지 못했습니다.");
  }
});

// 작성 페이지
app.get("/board/write", requireLogin, (req, res) => {
  res.render("board/write", { error: null, form: {} });
});

// ✅ 글 작성 (이미지 업로드: 최대 5장)
app.post("/board/write", requireLogin, upload.array("images", 5), async (req, res) => {
  try {
    const title = (req.body.title || "").trim();
    const content = (req.body.content || "").trim();

    if (!title || !content) {
      return res.render("board/write", { error: "제목/내용을 입력해주세요.", form: req.body });
    }

    const me = req.session.user;

    // 1) 글 먼저 생성
    const created = await d1Api("POST", "/api/board/posts", {
      user_id: me.id,
      author_username: me.username,
      author_nickname: me.nickname,
      title,
      content,
    });

    const postId = created?.id;
    if (!postId) throw new Error("post_create_failed");

    // 2) 이미지 업로드 (이미지만 허용)
    const items = [];
    const files = Array.isArray(req.files) ? req.files : [];

    for (const f of files) {
      if (!f || !f.mimetype) continue;

      // ✅ 이미지 MIME만 허용
      if (!/^image\/(png|jpeg|jpg|webp|gif)$/.test(f.mimetype)) {
        continue;
      }

      const safeName = (f.originalname || "image")
        .replace(/[^\w.\-()]+/g, "_")
        .slice(0, 120);

      const key = `freeboard/${postId}/${Date.now()}-${safeName}`;

      // R2 업로드
      await r2.send(new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: f.buffer,
        ContentType: f.mimetype,
      }));

      items.push({
        file_name: safeName,
        file_key: key,
        content_type: f.mimetype,
        size: f.size || 0,
      });
    }

    // 3) 이미지 메타 저장
    if (items.length > 0) {
      await d1Api("POST", `/api/board/posts/${postId}/images`, { items });
    }

    await auditLog(req, {
      action: "board_post_create",
      targetType: "free_post",
      targetId: postId,
      detail: { title, images: items.length },
    });

    return res.redirect(`/board/${postId}`);
  } catch (e) {
    console.error("❌ /board/write error:", e?.message || e);
    return res.status(500).send("글 작성에 실패했습니다.");
  }
});

// 상세
app.get("/board/:id", requireLogin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const data = await d1Api("GET", `/api/board/posts/${id}`);

    // data: { post, images, comments }
    return res.render("board/view", {
      post: data?.post || null,
      images: data?.images || [],
      comments: data?.comments || [],
      me: req.session.user,
    });
  } catch (e) {
    console.error("❌ /board/:id error:", e?.message || e);
    return res.status(500).send("글을 불러오지 못했습니다.");
  }
});

// 댓글 작성
app.post("/board/:id/comment", requireLogin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const content = (req.body.content || "").trim();
    if (!content) return res.redirect(`/board/${id}`);

    const me = req.session.user;

    await d1Api("POST", `/api/board/posts/${id}/comments`, {
      user_id: me.id,
      author_username: me.username,
      author_nickname: me.nickname,
      content,
    });

    await auditLog(req, {
      action: "board_comment_create",
      targetType: "free_post",
      targetId: id,
    });

    return res.redirect(`/board/${id}`);
  } catch (e) {
    console.error("❌ comment error:", e?.message || e);
    return res.status(500).send("댓글 작성에 실패했습니다.");
  }
});


// =========================
// 20) My Pages (중복 제거)
// =========================
app.get("/my", requireLogin, (req, res) => {
  res.render("my/index", { me: req.session.user });
});

app.get("/my/inquiry", requireLogin, async (req, res) => {
  try {
    const userId = String(req.session.user.id);
    const all = await listComplaints();
    const mine = (all || []).filter((c) => String(c.userId) === userId);
    return res.render("my/complaints", { complaints: mine });
  } catch (e) {
    console.error("❌ /my/inquiry error:", e);
    return res.status(500).send("나의 민원 목록을 불러오지 못했습니다.");
  }
});

app.get("/my/inquiry/:id", requireLogin, async (req, res) => {
  try {
    const userId = String(req.session.user.id);
    const id = String(req.params.id);

    const all = await listComplaints();
    const complaint = (all || []).find(
      (c) => String(c.id) === id && String(c.userId) === userId
    );

    if (!complaint) return res.status(404).send("존재하지 않거나 접근 권한이 없습니다.");
    return res.render("my/complaint_detail", { complaint });
  } catch (e) {
    console.error("❌ /my/inquiry/:id error:", e);
    return res.status(500).send("나의 민원 상세를 불러오지 못했습니다.");
  }
});

app.get("/my/suggest", requireLogin, async (req, res) => {
  try {
    const userId = String(req.session.user.id);
    const all = await listSuggestions();
    const mine = (all || []).filter((s) => String(s.userId) === userId);
    return res.render("my/suggestions", { suggestions: mine });
  } catch (e) {
    console.error("❌ /my/suggest error:", e);
    return res.status(500).send("나의 건의 목록을 불러오지 못했습니다.");
  }
});

app.get("/my/suggest/:id", requireLogin, async (req, res) => {
  try {
    const userId = String(req.session.user.id);
    const id = String(req.params.id);

    const all = await listSuggestions();
    const suggestion = (all || []).find(
      (s) => String(s.id) === id && String(s.userId) === userId
    );

    if (!suggestion) return res.status(404).send("존재하지 않거나 접근 권한이 없습니다.");
    return res.render("my/suggestions_detail", { suggestion });
  } catch (e) {
    console.error("❌ /my/suggest/:id error:", e);
    return res.status(500).send("나의 건의 상세를 불러오지 못했습니다.");
  }
});

// 호환 리다이렉트
app.get("/my/complaints", (req, res) => res.redirect("/my/inquiry"));
app.get("/my/complaints/:id", (req, res) => res.redirect(`/my/inquiry/${req.params.id}`));
app.get("/my/suggestions", (req, res) => res.redirect("/my/suggest"));
app.get("/my/suggestions/:id", (req, res) => res.redirect(`/my/suggest/${req.params.id}`));

// =========================
// 21) Admin Edit Pages (Agency/Department/Rank/Apply Conditions)
// =========================
app.get("/admin/edit/agency", requireAdmin, async (_, res) => {
  const data = await getAgency();
  res.render("admin/edit_agency", { data });
});

app.post("/admin/edit/agency", requireAdmin, async (req, res) => {
  await setAgency({ title: req.body.title || "", content: req.body.content || "" });

  await auditLog(req, {
    action: "agency_update",
    targetType: "page",
    targetId: "agency",
  });

  res.redirect("/intro/agency");
});

app.get("/admin/edit/department", requireAdmin, async (_, res) => {
  const data = await getDepartment();
  res.render("admin/edit_department", { data });
});

app.post("/admin/edit/department", requireAdmin, async (req, res) => {
  const teams = Object.values(req.body.teams || {}).map((t) => ({
    name: t.name || "",
    desc: t.desc || "",
  }));

  await setDepartment({ title: req.body.title || "부서 소개", teams });

  await auditLog(req, {
    action: "department_update",
    targetType: "page",
    targetId: "department",
  });

  res.redirect("/intro/department");
});

app.get("/admin/edit/rank", requireAdmin, async (_, res) => {
  const data = await getRank();
  res.render("admin/edit_rank", { data });
});

app.post("/admin/edit/rank", requireAdmin, async (req, res) => {
  const origin = await getRank();

  Object.keys(origin.high || {}).forEach((k) => { origin.high[k] = req.body[`high_${k}`] || ""; });
  Object.keys(origin.mid || {}).forEach((k) => { origin.mid[k] = req.body[`mid_${k}`] || ""; });

  Object.keys(origin.normal || {}).forEach((rank) => {
    origin.normal[rank] = [1, 2, 3, 4, 5].map((i) => req.body[`normal_${rank}_${i}`] || "");
  });

  origin.probation = [1, 2, 3, 4, 5].map((i) => req.body[`probation_${i}`] || "");

  await setRank(origin);

  await auditLog(req, {
    action: "rank_update",
    targetType: "page",
    targetId: "rank",
  });

  res.redirect("/intro/rank");
});

app.get("/admin/edit/apply/conditions", requireAdmin, async (_, res) => {
  const data = await getApplyConditions();
  res.render("admin/edit_apply_conditions", { data });
});

app.post("/admin/edit/apply/conditions", requireAdmin, async (req, res) => {
  const next = {
    title: req.body.title || "젤리 경찰청 채용 안내",
    cards: {
      eligibility: { title: req.body.eligibility_title || "지원 자격 안내", content: req.body.eligibility_content || "" },
      disqualify: { title: req.body.disqualify_title || "지원 불가 사유", content: req.body.disqualify_content || "" },
      preference: { title: req.body.preference_title || "지원 우대 사항", content: req.body.preference_content || "" },
    },
    side: { linkText: req.body.side_linkText || "링크1", linkUrl: req.body.side_linkUrl || "#" },
  };

  await setApplyConditions(next);

  await auditLog(req, {
    action: "apply_conditions_update",
    targetType: "page",
    targetId: "apply_conditions",
  });

  return res.redirect("/apply/conditions");
});

// =========================
// 22) Legal
// =========================
app.get("/terms", (req, res) => {
  res.render("legal/terms");
});

app.get("/privacy", (req, res) => {
  res.render("legal/privacy");
});

// =========================
// 23) Global Error Handler
// =========================
app.use((err, req, res, next) => {
  console.error("🔥 GLOBAL ERROR:", err);
  res.status(500).send("Internal Server Error");
});

// =========================
// 24) Server
// =========================
app.listen(PORT, () => console.log(`✅ Server running on ${PORT}`));
