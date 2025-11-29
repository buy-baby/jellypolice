const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const multer = require("multer");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const fs = require("fs");

const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");

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

// -------------------- 폴더 자동 생성 --------------------
const dbDir = "./database";
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir);

// -------------------- DB --------------------
const db = new sqlite3.Database("./database/complaints.db", (err) => {
  if (err) console.error("DB ERROR:", err);
  else {
    db.run(
      `CREATE TABLE IF NOT EXISTS complaints (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         name TEXT,
         identity TEXT,
         content TEXT,
         file TEXT,
         created DATETIME DEFAULT CURRENT_TIMESTAMP
       )`
    );
  }
});

// -------------------- 미들웨어 --------------------
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static("public"));
app.set("view engine", "ejs");
app.set("views", "./public/views");

// multer 메모리 업로드 (R2로 바로 업로드)
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

  db.run(
    `INSERT INTO complaints (name, identity, content, file) VALUES (?, ?, ?, ?)`,
    [name, identity, content, fileKey],
    () => {
      res.render("inquiry/index", { message: "민원이 성공적으로 접수되었습니다!" });
    }
  );
});

// 건의 사항
app.get("/suggest", (req, res) => {
  res.render("suggest/suggest");
});

// FAQ
app.get("/faq", (req, res) => {
  res.render("faq/faq");
});

// 로그인 페이지
app.get("/login", (req, res) => {
  res.render("admin/login");
});

// 로그인 처리
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
  db.all(`SELECT * FROM complaints ORDER BY id DESC`, (err, rows) => {
    res.render("admin/admin", { complaints: rows });
  });
});

// 민원 상세 페이지
app.get("/view/:id", requireAdmin, (req, res) => {
  const id = req.params.id;

  db.get(`SELECT * FROM complaints WHERE id = ?`, [id], (err, row) => {
    if (!row) return res.send("NOT FOUND");
    res.render("admin/view", { c: row });
  });
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

// 삭제
app.get("/delete/:id", requireAdmin, (req, res) => {
  const id = req.params.id;

  db.run(`DELETE FROM complaints WHERE id = ?`, id, () => {
    res.redirect("/admin");
  });
});

// -------------------- 서버 실행 --------------------
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
