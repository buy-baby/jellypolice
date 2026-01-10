const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const session = require("express-session");

const {
  getAgency, setAgency,
  getRank, setRank,
  getDepartment, setDepartment,
  listComplaints, listSuggestions,
  addComplaint, addSuggestion,
  getApplyConditions, setApplyConditions,
  listNotices, addNotice, deleteNotice,
  getNotice, updateNotice,
} = require("./src/storage");

const app = express();
const PORT = process.env.PORT || 3000;

// ------------------------- Cloudflare R2 (파일 저장용) -------------------------
const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY,
    secretAccessKey: process.env.R2_SECRET_KEY,
  },
});
const R2_BUCKET = process.env.R2_BUCKET_NAME;

// ------------------------- D1 API helper (Worker 호출) -------------------------
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

  // 204 대비
  return text ? JSON.parse(text) : null;
}

// ------------------------- Middleware -------------------------
app.set("trust proxy", 1);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static("public"));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "public", "views"));

const upload = multer({ storage: multer.memoryStorage() });

app.use(session({
  secret: process.env.SESSION_SECRET || "jellypolice-session-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: "auto",
    maxAge: 1000 * 60 * 60 * 6, // 6시간
  }
}));

app.use((req, res, next) => {
  res.locals.me = req.session.user || null;
  next();
});

// ------------------------- UTC -> KST -------------------------

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


// ------------------------- Auth Guards -------------------------
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

// ------------------------- Debug Routes (배포 확인용) -------------------------
// 배포된 server.js가 최신인지 확인하려고 만든 라우트.
// 브라우저에서 /__routes 로 들어가면 지금 등록된 핵심 라우트 문자열을 확인 가능.
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

// ------------------------- Auth Required Page -------------------------
app.get("/auth/required", (req, res) => {
  const nextUrl = req.query.next || "/";
  res.render("auth/required", {
    message: "해당 기능을 이용하기 위해서 로그인이 필요합니다.",
    nextUrl,
  });
});

// ------------------------- Register (D1) -------------------------
app.get("/register", (req, res) => {
  res.render("auth/register", { error: null, form: {} });
});

app.post("/register", async (req, res) => {
  try {
    const uniqueCode = (req.body.uniqueCode || "").trim();
    const nickname = (req.body.nickname || "").trim();
    const username = (req.body.username || "").trim();
    const password = (req.body.password || "");

    if (!uniqueCode || !nickname || !username || !password) {
      return res.render("auth/register", { error: "모든 항목을 입력해주세요.", form: req.body });
    }

    await d1Api("POST", "/api/auth/register", {
      uniqueCode,
      nickname,
      username,
      password,
    });

    return res.redirect("/login");
  } catch (e) {
    console.error("❌ register error:", e);

    const msg = String(e.message || "");
    if (msg.includes(" 409 ")) {
      return res.render("auth/register", { error: "이미 사용 중인 아이디입니다.", form: req.body });
    }

    return res.render("auth/register", { error: "회원가입 중 오류가 발생했습니다.", form: req.body });
  }
});

// ------------------------- Login (D1) -------------------------
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
    };

    // ✅ nextUrl로 돌아가기 (auth/required에서 넘어온 흐름 포함)
    return res.redirect(nextUrl || "/");
  } catch (e) {
    console.error("❌ login error:", e);
    const nextUrl = req.body.nextUrl || "/";
    return res.render("auth/login", { error: "아이디 또는 비밀번호가 올바르지 않습니다.", nextUrl });
  }
});

// ------------------------- Logout -------------------------
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

// ------------------------- Admin Main -------------------------
app.get("/admin", requireAdmin, (_, res) => res.render("admin/admin_main"));

// ------------------------- Admin Manage Users (D1) -------------------------
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
    return res.redirect("/admin/users");
  } catch (e) {
    console.error("❌ admin role change error:", e);
    return res.status(500).send("권한 변경에 실패했습니다.");
  }
});

// ------------------------- Admin Notice management -------------------------
app.get("/admin/notices", requireAdmin, async (_, res) => {
  const notices = await listNotices(20);
  res.render("admin/notices", { notices });
});

app.post("/admin/notices", requireAdmin, async (req, res) => {
  await addNotice({
    title: req.body.title || "",
    content: req.body.content || "",
  });
  res.redirect("/admin/notices");
});

app.get("/admin/notices/delete/:id", requireAdmin, async (req, res) => {
  await deleteNotice(Number(req.params.id));
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
  await updateNotice(id, {
    title: req.body.title || "",
    content: req.body.content || "",
  });
  res.redirect("/admin/notices");
});

app.post("/admin/notices/:id/delete", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await deleteNotice(id);
  res.redirect("/admin/notices");
});

// ------------------------- Public Pages -------------------------
app.get("/", async (_, res) => {
  const notices = await listNotices(5);
  res.render("main/main", { notices });
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

// ------------------------- Admin Edit Agency -------------------------
app.get("/admin/edit/agency", requireAdmin, async (_, res) => {
  const data = await getAgency();
  res.render("admin/edit_agency", { data });
});

app.post("/admin/edit/agency", requireAdmin, async (req, res) => {
  await setAgency({
    title: req.body.title || "",
    content: req.body.content || "",
  });
  res.redirect("/intro/agency");
});

// ------------------------- Admin Edit Department -------------------------
app.get("/admin/edit/department", requireAdmin, async (_, res) => {
  const data = await getDepartment();
  res.render("admin/edit_department", { data });
});

app.post("/admin/edit/department", requireAdmin, async (req, res) => {
  const teams = Object.values(req.body.teams || {}).map((t) => ({
    name: t.name || "",
    desc: t.desc || "",
  }));

  await setDepartment({
    title: req.body.title || "부서 소개",
    teams,
  });

  res.redirect("/intro/department");
});

// ------------------------- Admin Edit Rank -------------------------
app.get("/admin/edit/rank", requireAdmin, async (_, res) => {
  const data = await getRank();
  res.render("admin/edit_rank", { data });
});

app.post("/admin/edit/rank", requireAdmin, async (req, res) => {
  const origin = await getRank();

  Object.keys(origin.high || {}).forEach((k) => {
    origin.high[k] = req.body[`high_${k}`] || "";
  });

  Object.keys(origin.mid || {}).forEach((k) => {
    origin.mid[k] = req.body[`mid_${k}`] || "";
  });

  Object.keys(origin.normal || {}).forEach((rank) => {
    origin.normal[rank] = [1, 2, 3, 4, 5].map((i) =>
      req.body[`normal_${rank}_${i}`] || ""
    );
  });

  origin.probation = [1, 2, 3, 4, 5].map((i) => req.body[`probation_${i}`] || "");

  await setRank(origin);
  res.redirect("/intro/rank");
});

// ------------------------- Admin Edit Apply Conditions -------------------------
app.get("/admin/edit/apply/conditions", requireAdmin, async (_, res) => {
  const data = await getApplyConditions();
  res.render("admin/edit_apply_conditions", { data });
});

app.post("/admin/edit/apply/conditions", requireAdmin, async (req, res) => {
  const next = {
    title: req.body.title || "젤리 경찰청 채용 안내",
    cards: {
      eligibility: {
        title: req.body.eligibility_title || "지원 자격 안내",
        content: req.body.eligibility_content || "",
      },
      disqualify: {
        title: req.body.disqualify_title || "지원 불가 사유",
        content: req.body.disqualify_content || "",
      },
      preference: {
        title: req.body.preference_title || "지원 우대 사항",
        content: req.body.preference_content || "",
      },
    },
    side: {
      linkText: req.body.side_linkText || "링크1",
      linkUrl: req.body.side_linkUrl || "#",
    },
  };

  await setApplyConditions(next);
  return res.redirect("/apply/conditions");
});

// -------------------- Citizen Pages --------------------
app.get("/inquiry", requireLogin, (_, res) => res.render("inquiry/index"));
app.get("/suggest", requireLogin, (_, res) => res.render("suggest/suggest"));
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

// -------------------- Admin Inquiry / Suggest --------------------
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

// -------------------- Citizen Submit (민원/건의) --------------------
app.get("/inquiry/success", (_, res) => res.render("inquiry/success"));
app.get("/suggest/success", (_, res) => res.render("suggest/success"));

// 민원 제출 (로그인 필수 + userId 저장)
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
      identity: req.body.identity || "",
      content: req.body.content || "",
      created,
      fileName,
      fileKey,
    });

    return res.redirect("/inquiry/success");
  } catch (err) {
    console.error("❌ 민원 제출 오류:", err);
    return res.status(500).send("민원 제출 중 오류가 발생했습니다.");
  }
});

// 건의 제출 (로그인 필수 + userId 저장)
app.post("/suggest", requireLogin, async (req, res) => {
  try {
    const created = new Date().toISOString();

    await addSuggestion({
      userId: req.session.user.id,
      name: req.body.name || "",
      identity: req.body.identity || "",
      content: req.body.content || "",
      created,
    });

    return res.redirect("/suggest/success");
  } catch (err) {
    console.error("❌ 건의 제출 오류:", err);
    return res.status(500).send("건의 제출 중 오류가 발생했습니다.");
  }
});
// -------------------- My Pages (내 글만 보기) --------------------

// 주소: /my/inquiry, /my/suggest

// 나의 민원 목록
app.get("/my/inquiry", requireLogin, async (req, res) => {
  try {
    const userId = String(req.session.user.id);

    const all = await listComplaints();
    // 디버그(필요하면 잠깐 켜고 나중에 지워도 됨)
    console.log("SESSION USER ID:", userId);
    console.log("COMPLAINT TOTAL:", (all || []).length, "SAMPLE:", (all || [])[0]);

    const mine = (all || []).filter((c) => String(c.userId) === userId);

    return res.render("my/complaints", { complaints: mine });
  } catch (e) {
    console.error("❌ /my/inquiry error:", e);
    return res.status(500).send("나의 민원 목록을 불러오지 못했습니다.");
  }
});

// 나의 민원 상세
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

// 나의 건의 목록
app.get("/my/suggest", requireLogin, async (req, res) => {
  try {
    const userId = String(req.session.user.id);

    const all = await listSuggestions();
    console.log("SUGGEST TOTAL:", (all || []).length, "SAMPLE:", (all || [])[0]);

    const mine = (all || []).filter((s) => String(s.userId) === userId);

    return res.render("my/suggestions", { suggestions: mine });
  } catch (e) {
    console.error("❌ /my/suggest error:", e);
    return res.status(500).send("나의 건의 목록을 불러오지 못했습니다.");
  }
});

// 나의 건의 상세
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

// ---- (선택) 예전 주소 호환: /my/complaints, /my/suggestions 로 와도 같은 페이지로 보내기 ----
app.get("/my/complaints", (req, res) => res.redirect("/my/inquiry"));
app.get("/my/complaints/:id", (req, res) => res.redirect(`/my/inquiry/${req.params.id}`));
app.get("/my/suggestions", (req, res) => res.redirect("/my/suggest"));
app.get("/my/suggestions/:id", (req, res) => res.redirect(`/my/suggest/${req.params.id}`));

// -------------------- Server --------------------
app.listen(PORT, () => console.log(`✅ Server running on ${PORT}`));
