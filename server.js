const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const multer = require("multer");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// -------------------- 폴더 자동 생성 --------------------
const dbDir = "./database";
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir);

const uploadDir = "./uploads";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

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

// 파일 업로드 설정
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "_" + file.originalname);
  },
});
const upload = multer({ storage: storage });

// -------------------- 관리자 인증 --------------------
const ADMIN_PASSWORD = "jellypolice1234";

function requireAdmin(req, res, next) {
  if (req.cookies.admin === "loggedin") return next();
  return res.redirect("/login");
}

// -------------------- 라우팅 --------------------

// 메인 페이지 (고객센터 홈)
app.get("/", (req, res) => {
  res.render("main/main");
});

// 민원 안내 페이지
app.get("/inquiry", (req, res) => {
  res.render("inquiry/index");
});

// 민원 접수 페이지
app.get("/submit", (req, res) => {
  res.render("inquiry/submit");
});

// 민원 제출 처리
app.post("/submit", upload.single("file"), (req, res) => {
  const { name, identity, content } = req.body;
  const file = req.file ? req.file.filename : null;

  db.run(
    `INSERT INTO complaints (name, identity, content, file) VALUES (?, ?, ?, ?)`,
    [name, identity, content, file],
    function () {
      res.render("inquiry/index", { message: "민원이 성공적으로 접수되었습니다!" });
    }
  );
});

// 건의 사항 페이지
app.get("/suggest", (req, res) => {
  res.render("suggest/suggest");
});

// 고객센터 안내 / FAQ
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
    return res.render("admin/admin", { complaints: rows });
  });
});

// 민원 상세 보기
app.get("/view/:id", requireAdmin, (req, res) => {
  const id = req.params.id;

  db.get(`SELECT * FROM complaints WHERE id = ?`, [id], (err, row) => {
    if (!row) return res.send("NOT FOUND");
    res.render("admin/view", { c: row });
  });
});

// 민원 삭제
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
