const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");

const app = express();
const PORT = process.env.PORT || 3000;

// -------------------- Cloudflare R2 설정 --------------------
const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY,
    secretAccessKey: process.env.R2_SECRET_KEY,
  },
});
const R2_BUCKET = process.env.R2_BUCKET_NAME;

// -------------------- JSON DB 공통 함수 --------------------
function ensureDB(file) {
  if (!fs.existsSync("./database")) fs.mkdirSync("./database");
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify([]));
}

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// DB 파일 경로
const COMPLAINT_DB = "./database/complaints.json";
const SUGGEST_DB = "./database/suggest.json";

// DB 자동 생성
ensureDB(COMPLAINT_DB);
ensureDB(SUGGEST_DB);

// -------------------- 미들웨어 --------------------
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static("public"));
app.set("view engine", "ejs");
app.set("views", "./public/views");

const upload = multer({ storage: multer.memoryStorage() });

// -------------------- 관리자 인증 --------------------
const ADMIN_PASSWORD = "jellypolice1234";

function requireAdmin(req, res, next) {
  if (req.cookies.admin === "loggedin") return next();
  res.redirect("/login");
}

// -------------------- 메인 메뉴 --------------------
app.get("/", (req, res) => res.render("main/main"));

// -------------------- 민원 제출 --------------------
app.get("/inquiry", (req, res) => res.render("inquiry/index"));
app.get("/submit", (req, res) => res.render("inquiry/submit"));

app.post("/submit", upload.single("file"), async (req, res) => {
  const { name, identity, content } = req.body;

  let fileKey = null;
  if (req.file) {
    fileKey = Date.now() + "_" + req.file.originalname;

    await r2.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: fileKey,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      })
    );
  }

  const list = readJSON(COMPLAINT_DB);

  list.push({
    id: Date.now(),
    name,
    identity,
    content,
    file: fileKey,
    created: new Date().toISOString(),
  });

  writeJSON(COMPLAINT_DB, list);
  res.render("inquiry/success", { name });
});

// -------------------- 건의 제출 --------------------
app.get("/suggest", (req, res) => res.render("suggest/suggest"));

app.post("/suggest", (req, res) => {
  const { identity, content } = req.body;

  const list = readJSON(SUGGEST_DB);

  list.push({
    id: Date.now(),
    identity,
    content,
    created: new Date().toISOString(),
  });

  writeJSON(SUGGEST_DB, list);
  res.render("suggest/success");
});

// -------------------- 소개 페이지 --------------------
app.get("/intro/agency", (req, res) => res.render("intro/intro_agency"));
app.get("/intro/rank", (req, res) => res.render("intro/intro_rank"));
app.get("/intro/department", (req, res) => res.render("intro/intro_department"));

// -------------------- 채용 --------------------
app.get("/apply/conditions", (req, res) =>
  res.render("apply/apply_conditions")
);
app.get("/apply/apply", (req, res) => res.render("apply/apply_apply"));

// -------------------- 관리자 로그인 --------------------
app.get("/login", (req, res) => res.render("admin/admin_login"));

app.post("/login", (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) {
    res.cookie("admin", "loggedin");
    return res.redirect("/admin");
  }
  res.render("admin/admin_login", { error: "비밀번호가 틀렸습니다." });
});

// -------------------- 관리자 메인 --------------------
app.get("/admin", requireAdmin, (req, res) => {
  res.render("admin/admin_main");
});

// ------------------------------------------------------
// -------------------- 민원 관리자 ---------------------
// ------------------------------------------------------
app.get("/admin/inquiry", requireAdmin, (req, res) => {
  const list = readJSON(COMPLAINT_DB).sort((a, b) => b.id - a.id);
  res.render("admin/inquiry_list", { complaints: list });
});

app.get("/admin/inquiry/view/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const item = readJSON(COMPLAINT_DB).find((x) => x.id === id);
  if (!item) return res.send("존재하지 않는 민원입니다.");

  res.render("admin/inquiry_view", { c: item });
});

app.get("/admin/inquiry/delete/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const list = readJSON(COMPLAINT_DB);

  writeJSON(COMPLAINT_DB, list.filter((x) => x.id !== id));
  res.redirect("/admin/inquiry");
});

// 파일 다운로드
app.get("/file/:key", requireAdmin, async (req, res) => {
  try {
    const key = req.params.key;

    const data = await r2.send(
      new GetObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
      })
    );

    res.setHeader("Content-Disposition", `attachment; filename="${key}"`);
    data.Body.pipe(res);
  } catch (e) {
    res.send("파일을 찾을 수 없습니다.");
  }
});

// ------------------------------------------------------
// -------------------- 건의 관리자 ----------------------
// ------------------------------------------------------
app.get("/admin/suggest", requireAdmin, (req, res) => {
  const list = readJSON(SUGGEST_DB).sort((a, b) => b.id - a.id);
  res.render("admin/suggest_list", { suggestions: list });
});

app.get("/admin/suggest/view/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const item = readJSON(SUGGEST_DB).find((x) => x.id === id);

  if (!item) return res.send("존재하지 않는 건의입니다.");
  res.render("admin/suggest_view", { item });
});

app.get("/admin/suggest/delete/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const list = readJSON(SUGGEST_DB);

  writeJSON(SUGGEST_DB, list.filter((x) => x.id !== id));
  res.redirect("/admin/suggest");
});

// -------------------- 서버 실행 --------------------
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
