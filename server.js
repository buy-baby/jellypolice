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

// -------------------- JSON DB 설정 --------------------
const DB_PATH = "./database/complaints.json";

// DB 없으면 자동 생성
if (!fs.existsSync("./database")) fs.mkdirSync("./database");
if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify([]));

// DB 읽기
function readDB() {
  const data = fs.readFileSync(DB_PATH, "utf8");
  return JSON.parse(data);
}

// DB 저장
function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

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
  return res.redirect("/login");
}

// -------------------- 라우팅 --------------------

// 메인 페이지
app.get("/", (req, res) => {
  res.render("main/main");
});

// 민원 안내 페이지
app.get("/inquiry", (req, res) => {
  res.render("inquiry/index");
});

// 민원 제출 페이지
app.get("/submit", (req, res) => {
  res.render("inquiry/submit");
});

// 민원 제출 처리(JSON DB 저장)
app.post("/submit", upload.single("file"), async (req, res) => {
  const { name, identity, content } = req.body;
  let fileKey = null;

  // 파일 업로드가 있는 경우 R2로 전송
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

  const db = readDB();

  const newComplaint = {
    id: Date.now(), // JSON DB라서 시간 기반 ID 사용
    name,
    identity,
    content,
    file: fileKey,
    created: new Date().toISOString(),
  };

  db.push(newComplaint);
  writeDB(db);

  res.render("inquiry/success", { name });
});

// 로그인
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

// 관리자 메인(JSON DB 조회)
app.get("/admin", requireAdmin, (req, res) => {
  const db = readDB();
  const list = db.sort((a, b) => b.id - a.id);
  res.render("admin/admin", { complaints: list });
});

// 민원 상세 페이지
app.get("/view/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const db = readDB();
  const complaint = db.find((x) => x.id === id);

  if (!complaint) return res.send("NOT FOUND");

  res.render("admin/view", { c: complaint });
});

// R2 파일 다운로드
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

// 삭제
app.get("/delete/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  let db = readDB();

  db = db.filter((x) => x.id !== id);

  writeDB(db);
  res.redirect("/admin");
});

// 소개 페이지
app.get("/intro/agency", (req, res) => res.render("intro/intro_agency"));
app.get("/intro/rank", (req, res) => res.render("intro/intro_rank"));
app.get("/intro/department", (req, res) => res.render("intro/intro_department"));

// 채용 페이지
app.get("/apply/conditions", (req, res) => res.render("apply/apply_conditions"));
app.get("/apply/apply", (req, res) => res.render("apply/apply_apply"));

// 서버 실행
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// 건의 작성 페이지
app.get("/suggest", (req, res) => {
  res.render("suggest/suggest");
});

// 건의 제출 처리
app.post("/suggest", (req, res) => {
  const { name, identity, content } = req.body;

  const suggestions = JSON.parse(
    fs.readFileSync("./database/suggest.json", "utf8")
  );

  suggestions.push({
    name,
    identity,
    content,
    created: new Date().toISOString()
  });

  fs.writeFileSync(
    "./database/suggest.json",
    JSON.stringify(suggestions, null, 2)
  );

  res.render("suggest/success");
});

// 건의 관리자 메인
app.get("/admin/suggest", requireAdmin, (req, res) => {
  const suggestions = JSON.parse(
    fs.readFileSync("./database/suggest.json", "utf8")
  );

  // 최신순 정렬
  suggestions.reverse();

  res.render("admin/suggest_list", { suggestions });
});

app.get("/admin/suggest/view/:id", requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);

  const suggestions = JSON.parse(
    fs.readFileSync("./database/suggest.json", "utf8")
  );

  const item = suggestions[id];
  if (!item) return res.send("존재하지 않는 건의입니다.");

  res.render("admin/suggest_view", { id, item });
});

app.get("/admin/suggest/delete/:id", requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);

  const suggestions = JSON.parse(
    fs.readFileSync("./database/suggest.json", "utf8")
  );

  // 삭제
  suggestions.splice(id, 1);

  // 저장
  fs.writeFileSync(
    "./database/suggest.json",
    JSON.stringify(suggestions, null, 2)
  );

  res.redirect("/admin/suggest");
});
