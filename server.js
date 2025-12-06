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

// -------------------- JSON DB 함수 --------------------
function ensureDB(file, defaultData = []) {
  if (!fs.existsSync("./database")) fs.mkdirSync("./database");
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(defaultData, null, 2));
}

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// -------------------- DB 파일 경로 --------------------
const COMPLAINT_DB = "./database/complaints.json";
const SUGGEST_DB = "./database/suggest.json";
const AGENCY_DB = "./database/agency.json";
const RANK_DB = "./database/rank.json";
const DEPT_DB = "./database/department.json";

// -------------------- DB 자동 생성 --------------------
ensureDB(COMPLAINT_DB, []);
ensureDB(SUGGEST_DB, []);

ensureDB(AGENCY_DB, {
  title: "젤리경찰청 기관 소개",
  content: "젤리 경찰청은 시민의 안전과 질서를 위해 존재합니다."
});

ensureDB(RANK_DB, {
  title: "젤리경찰청 직급표",
  ranks: [
    { group: "고위직", items: ["치안총감 : 디오", "치안정감 : 찬란", "치안감 : 빡표 철이"] },
    { group: "간부직", items: ["경무관 :", "총경 :", "경정 : 재윤 단", "경감 : "] },
    { group: "일반직", items: ["경위 :", "경사 :", "경장 :", "순경 :"] }
  ]
});

ensureDB(DEPT_DB, {
  title: "부서 소개",
  teams: [
    { name: "인사팀", desc: "인력 관리 및 인사 업무를 총괄하는 핵심 부서입니다." },
    { name: "감사팀", desc: "조직 운영 전반의 문제를 감사하고 개선하는 역할을 합니다." },
    { name: "S.F 타격대", desc: "차량 기반 RP 임무에 특화된 기동 전문 부대입니다." },
    { name: "특공대", desc: "전술적 상황에서 지휘 및 고난도 작전을 실행하는 부대입니다." },
    { name: "항공팀", desc: "헬기를 통한 공중 지원 및 추적 임무 수행 부서입니다." }
  ]
});

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

// -------------------- 메인 화면 --------------------
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
app.get("/intro/agency", (req, res) => {
  res.render("intro/intro_agency", { data: readJSON(AGENCY_DB) });
});

app.get("/intro/rank", (req, res) => {
  res.render("intro/intro_rank", { data: readJSON(RANK_DB) });
});

app.get("/intro/department", (req, res) => {
  res.render("intro/intro_department", { data: readJSON(DEPT_DB) });
});

// -------------------- 지원 페이지 --------------------
app.get("/apply/conditions", (req, res) => {
  res.render("apply/apply_conditions");
});

app.get("/apply/apply", (req, res) => {
  res.render("apply/apply_apply");
});


// -------------------- 소개 페이지 수정 (JSON 전체 수정 방식) --------------------
app.get("/admin/edit/agency", requireAdmin, (req, res) => {
  res.render("admin/edit_agency", { data: readJSON(AGENCY_DB) });
});

app.post("/admin/edit/agency", requireAdmin, (req, res) => {
  writeJSON(AGENCY_DB, {
    title: req.body.title,
    content: req.body.content
  });
  res.redirect("/intro/agency");
});

app.get("/admin/edit/rank", requireAdmin, (req, res) => {
  res.render("admin/edit_rank", { data: readJSON(RANK_DB) });
});

app.post("/admin/edit/rank", requireAdmin, (req, res) => {
  const data = readJSON(RANK_DB);

  data.groups.forEach((group, gi) => {
    if (group.type === "simple") {
      group.ranks.forEach((r, ri) => {
        r.people = req.body[`g${gi}r${ri}`] || "";
      });
    } else {
      group.ranks.forEach((r, ri) => {
        r.grades.forEach((g, gi2) => {
          g.people = req.body[`g${gi}r${ri}h${gi2}`] || "";
        });
      });
    }
  });

  writeJSON(RANK_DB, data);
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
