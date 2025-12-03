const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");
const multer = require("multer");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const fs = require("fs");
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand
} = require("@aws-sdk/client-s3");

const app = express();
const PORT = process.env.PORT || 3000;

// -------------------- Cloudflare R2 설정 --------------------
const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY,
    secretAccessKey: process.env.R2_SECRET_KEY
  }
});

const R2_BUCKET = process.env.R2_BUCKET_NAME;

// -------------------- DB 폴더 자동 생성 --------------------
const dbDir = "./database";
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir);

// -------------------- better-sqlite3 DB --------------------
const db = new Database("./database/complaints.db");

// 테이블 생성
db.prepare(`
  CREATE TABLE IF NOT EXISTS complaints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    identity TEXT,
    content TEXT,
    file TEXT,
    created DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

// -------------------- 미들웨어 --------------------
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static("public"));
app.set("view engine", "ejs");
app.set("views", "./public/views");

// multer 메모리 업로드 (R2 저장 방식)
const upload = multer({ storage: multer.memoryStorage() });

// -------------------- 관리자 인증 --------------------
const ADMIN_PASSWORD = "jellypolice1234";

function requireAdmin(req, res, next) {
  if (req.cookies.admin === "loggedin") return next();
  return res.redirect("/login");
}

// -------------------- 라우팅 --------------------

// 메인 페이지
app.get("/", (req, res) => {
  res.render("main/main");
});

// -------------------- 민원 --------------------

// 민원 소개 페이지
app.get("/inquiry", (req, res) => {
  res.render("inquiry/index");
});

// 민원 제출 페이지
app.get("/submit", (req, res) => {
  res.render("inquiry/submit");
});

// 민원 제출 처리
app.post("/submit", upload.single("file"), async (req, res) => {
  const { name, identity, content } = req.body;
  let fileKey = null;

  // 첨부파일 R2 업로드
  if (req.file) {
    fileKey = Date.now() + "_" + req.file.originalname;

    await r2.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: fileKey,
        Body: req.file.buffer,
        ContentType: req.file.mimetype
      })
    );
  }

  // DB 저장
  const stmt = db.prepare(
    "INSERT INTO complaints (name, identity, content, file) VALUES (?, ?, ?, ?)"
  );
  stmt.run(name, identity, content, fileKey);

  // 성공 페이지로 이동
  res.render("inquiry/success", { name });
});

// -------------------- 건의 --------------------
app.get("/suggest", (req, res) => {
  res.render("suggest/suggest");
});

// -------------------- 관리자 --------------------

// 로그인 페이지
app.get("/login", (req, res) => {
  res.render("admin/login");
});

app.post("/login", (req, res) => {
  const { password } = req.body;

  if (password === ADMIN_PASSWORD) {
    res.cookie("admin", "loggedin");
    return res.redirect("/admin");
  }
  return res.render("admin/login", { error: "비밀번호가 틀렸습니다." });
});

// 관리자 메인
app.get("/admin", requireAdmin, (req, res) => {
  const rows = db.prepare("SELECT * FROM complaints ORDER BY id DESC").all();
  res.render("admin/admin", { complaints: rows });
});

// 민원 상세 보기
app.get("/view/:id", requireAdmin, (req, res) => {
  const id = req.params.id;
  const row = db.prepare("SELECT * FROM complaints WHERE id = ?").get(id);

  if (!row) return res.send("NOT FOUND");
  res.render("admin/view", { c: row });
});

// 첨부파일 다운로드 (R2)
app.get("/file/:key", requireAdmin, async (req, res) => {
  const key = req.params.key;

  try {
    const data = await r2.send(
      new GetObjectCommand({
        Bucket: R2_BUCKET,
        Key: key
      })
    );

    res.setHeader("Content-Disposition", `attachment; filename="${key}"`);
    data.Body.pipe(res);
  } catch (e) {
    console.error(e);
    res.send("파일을 찾을 수 없습니다.");
  }
});

// 민원 삭제
app.get("/delete/:id", requireAdmin, (req, res) => {
  const id = req.params.id;
  db.prepare("DELETE FROM complaints WHERE id = ?").run(id);
  res.redirect("/admin");
});

// -------------------- 소개 페이지 --------------------
app.get("/intro/agency", (req, res) => {
  res.render("intro/intro_agency");
});

app.get("/intro/rank", (req, res) => {
  res.render("intro/intro_rank");
});

app.get("/intro/department", (req, res) => {
  res.render("intro/intro_department");
});

// -------------------- 채용 페이지 --------------------
app.get("/apply/conditions", (req, res) => {
  res.render("apply/apply_conditions");
});

app.get("/apply/apply", (req, res) => {
  res.render("apply/apply_apply");
});

// -------------------- 서버 실행 --------------------
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
