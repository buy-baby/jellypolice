const express = require("express");
const fs = require("fs");
const path = require("path");
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

// -------------------- JSON DB --------------------
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

const COMPLAINT_DB = "./database/complaints.json";
const SUGGEST_DB = "./database/suggest.json";
const AGENCY_DB = "./database/agency.json";
const RANK_DB = "./database/rank.json";
const DEPT_DB = "./database/department.json";

ensureDB(COMPLAINT_DB);
ensureDB(SUGGEST_DB);

// 소개 JSON 파일은 기본값 생성
if (!fs.existsSync(AGENCY_DB)) {
  fs.writeFileSync(
    AGENCY_DB,
    JSON.stringify({
      title: "젤리경찰청 기관 소개",
      content: "젤리 경찰청은 시민의 안전과 질서를 위해 존재합니다."
    }, null, 2)
  );
}

if (!fs.existsSync(RANK_DB)) {
  fs.writeFileSync(
    RANK_DB,
    JSON.stringify({
      title: "젤리 경찰청 직급표",
      ranks: [
        { group: "고위직", items: ["치안총감 : 디오", "치안정감 : 찬란", "치안감 : 빡표 철이"] },
        { group: "간부직", items: ["경무관 :", "총경 :", "경정 : 재윤 단", "경감 : "] },
        { group: "일반직", items: ["경위 1~5호봉 :", "경사 1~5호봉 :", "경장 1~5호봉 :", "순경 1~5호봉 :"] }
      ]
    }, null, 2)
  );
}

if (!fs.existsSync(DEPT_DB)) {
  fs.writeFileSync(
    DEPT_DB,
    JSON.stringify({
      title: "부서 소개",
      teams: [
        { name: "인사팀", desc: "인력 관리 및 인사 업무를 총괄하는 핵심 부서입니다." },
        { name: "감사팀", desc: "조직 운영 전반의 문제를 감사하고 개선하는 역할을 합니다." },
        { name: "S.F 타격대", desc: "차량 기반 RP(수배·도주)에 특화된 기동 전문 유닛입니다." },
        { name: "특공대", desc: "전 RP 상황에서 팀을 지휘하고 전술적 대응을 담당하는 최정예 부대입니다." },
        { name: "항공팀", desc: "헬기를 활용해 공중 지원, 추적, 구조 등을 수행하는 항공 전문팀입니다." }
      ]
    }, null, 2)
  );
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
  res.redirect("/login");
}

// -------------------- 메인 메뉴 --------------------
app.get("/", (req, res) => res.render("main/main"));

// -------------------- 민원 --------------------
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
        ContentType: req.file.mimetype
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

// -------------------- 건의 --------------------
app.get("/suggest", (req, res) => res.render("suggest/suggest"));

app.post("/suggest", (req, res) => {
  const { name, identity, content } = req.body;

  const list = readJSON(SUGGEST_DB);
  list.push({
    id: Date.now(),
    name,
    identity,
    content,
    created: new Date().toISOString(),
  });

  writeJSON(SUGGEST_DB, list);
  res.render("suggest/success");
});

// -------------------- 소개 페이지 --------------------
app.get("/intro/agency", (req, res) => {
  const data = readJSON(AGENCY_DB);
  res.render("intro/intro_agency", { data });
});

app.get("/intro/rank", (req, res) => {
  const data = readJSON(RANK_DB);
  res.render("intro/intro_rank", { data });
});

app.get("/intro/department", (req, res) => {
  const data = readJSON(DEPT_DB);
  res.render("intro/intro_department", { data });
});

// -------------------- 소개 페이지 관리자 수정 --------------------
app.get("/admin/edit/agency", requireAdmin, (req, res) => {
  res.render("admin/edit_agency", { data: readJSON(AGENCY_DB) });
});
app.post("/admin/edit/agency", requireAdmin, (req, res) => {
  writeJSON(AGENCY_DB, { title: req.body.title, content: req.body.content });
  res.redirect("/intro/agency");
});

app.get("/admin/edit/rank", requireAdmin, (req, res) => {
  res.render("admin/edit_rank", { data: readJSON(RANK_DB) });
});
app.post("/admin/edit/rank", requireAdmin, (req, res) => {
  writeJSON(RANK_DB, JSON.parse(req.body.json));
  res.redirect("/intro/rank");
});

app.get("/admin/edit/department", requireAdmin, (req, res) => {
  res.render("admin/edit_department", { data: readJSON(DEPT_DB) });
});
app.post("/admin/edit/department", requireAdmin, (req, res) => {
  writeJSON(DEPT_DB, JSON.parse(req.body.json));
  res.redirect("/intro/department");
});

// -------------------- 서버 실행 --------------------
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
