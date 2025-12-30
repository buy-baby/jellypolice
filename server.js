const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const app = express();
const PORT = process.env.PORT || 3000;

// -------------------- Cloudflare R2 --------------------
const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY,
    secretAccessKey: process.env.R2_SECRET_KEY,
  },
});
const R2_BUCKET = process.env.R2_BUCKET_NAME;

// -------------------- JSON Utils --------------------
function ensureDB(file, defaultData) {
  if (!fs.existsSync("./database")) fs.mkdirSync("./database");
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(defaultData, null, 2));
  }
}
const readJSON = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const writeJSON = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2));

// -------------------- DB Paths --------------------
const COMPLAINT_DB = "./database/complaints.json";
const SUGGEST_DB = "./database/suggest.json";
const AGENCY_DB = "./database/agency.json";
const RANK_DB = "./database/rank.json";
const DEPT_DB = "./database/department.json";

// -------------------- DB Init --------------------
ensureDB(COMPLAINT_DB, []);
ensureDB(SUGGEST_DB, []);

ensureDB(AGENCY_DB, {
  title: "젤리경찰청 기관 소개",
  content: "젤리 경찰청은 시민의 안전과 질서를 위해 존재합니다."
});

ensureDB(RANK_DB, {
  title: "젤리경찰청 직급표",
  high: {
    "치안총감": "",
    "치안정감": "",
    "치안감": ""
  },
  mid: {
    "경무관": "",
    "총경": "",
    "경정": "",
    "경감": ""
  },
  normal: {
    "경위": ["", "", "", "", ""],
    "경사": ["", "", "", "", ""],
    "경장": ["", "", "", "", ""],
    "순경": ["", "", "", "", ""]
  },
  probation: ["", "", "", "", ""]
});

ensureDB(DEPT_DB, {
  title: "부서 소개",
  teams: []
});

// -------------------- Middleware --------------------
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static("public"));
app.set("view engine", "ejs");
app.set("views", "./public/views");

const upload = multer({ storage: multer.memoryStorage() });

// -------------------- Admin Auth --------------------
const ADMIN_PASSWORD = "jellypolice1234";
const requireAdmin = (req, res, next) =>
  req.cookies.admin === "loggedin" ? next() : res.redirect("/login");

// -------------------- Admin Login --------------------
app.get("/login", (_, res) => res.render("admin/admin_login"));
app.post("/login", (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) {
    res.cookie("admin", "loggedin");
    return res.redirect("/admin");
  }
  res.render("admin/admin_login", { error: "비밀번호가 틀렸습니다." });
});

// -------------------- Admin Main --------------------
app.get("/admin", requireAdmin, (_, res) =>
  res.render("admin/admin_main")
);

// -------------------- Public Pages --------------------
app.get("/", (_, res) => res.render("main/main"));

app.get("/intro/agency", (_, res) =>
  res.render("intro/intro_agency", { data: readJSON(AGENCY_DB) })
);

app.get("/intro/rank", (_, res) =>
  res.render("intro/intro_rank", { data: readJSON(RANK_DB) })
);

app.get("/intro/department", (_, res) =>
  res.render("intro/intro_department", { data: readJSON(DEPT_DB) })
);

// -------------------- Admin Edit Agency --------------------
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

// -------------------- Admin Edit Department --------------------
app.get("/admin/edit/department", requireAdmin, (req, res) => {
  res.render("admin/edit_department", { data: readJSON(DEPT_DB) });
});

app.post("/admin/edit/department", requireAdmin, (req, res) => {
  const teams = Object.values(req.body.teams || {}).map(t => ({
    name: t.name,
    desc: t.desc
  }));

  writeJSON(DEPT_DB, {
    title: "부서 소개",
    teams
  });

  res.redirect("/intro/department");
});

// -------------------- Admin Edit Rank --------------------
app.get("/admin/edit/rank", requireAdmin, (_, res) => {
  res.render("admin/edit_rank", { data: readJSON(RANK_DB) });
});

app.post("/admin/edit/rank", requireAdmin, (req, res) => {
  const origin = readJSON(RANK_DB);

  Object.keys(origin.high).forEach(k => {
    origin.high[k] = req.body[`high_${k}`] || "";
  });

  Object.keys(origin.mid).forEach(k => {
    origin.mid[k] = req.body[`mid_${k}`] || "";
  });

  Object.keys(origin.normal).forEach(rank => {
    origin.normal[rank] = [1,2,3,4,5].map(i =>
      req.body[`normal_${rank}_${i}`] || ""
    );
  });

  origin.probation = [1,2,3,4,5].map(i =>
    req.body[`probation_${i}`] || ""
  );

  writeJSON(RANK_DB, origin);
  res.redirect("/intro/rank");
});

// -------------------- Citizen Pages --------------------
app.get("/inquiry", (_, res) => res.render("inquiry/index"));
app.get("/suggest", (_, res) => res.render("suggest/suggest"));
app.get("/apply", (_, res) => res.render("apply/index"));
app.get("/apply/conditions", (_, res) => res.render("apply/apply_conditions"));
app.get("/apply/apply", (_, res) => res.render("apply/apply_apply"));
app.get("/customer", (_, res) => res.render("customer/index"));

// -------------------- Admin Inquiry / Suggest --------------------
app.get("/admin/inquiry", requireAdmin, (req, res) => {
  const complaints = readJSON(COMPLAINT_DB);
  res.render("admin/inquiry_list", { complaints });
});

app.get("/admin/suggest", requireAdmin, (req, res) => {
  const suggestions = readJSON(SUGGEST_DB);
  res.render("admin/suggest_list", { suggestions });
});


// -------------------- Citizen Submit (민원/건의) --------------------

//  민원 접수 완료 페이지
app.get("/inquiry/success", (req, res) => {
  res.render("inquiry/success");
});

//  건의 접수 완료 페이지
app.get("/suggest/success", (req, res) => {
  res.render("suggest/success");
});

//  민원 제출 (form action="/submit")
app.post("/submit", upload.single("file"), async (req, res) => {
  try {
    const complaints = readJSON(COMPLAINT_DB);

    // id 만들기(증가형)
    const nextId =
      Array.isArray(complaints) && complaints.length
        ? Math.max(...complaints.map(c => Number(c.id) || 0)) + 1
        : 1;

    const created = new Date().toISOString();

    // 파일 업로드(선택): R2 설정이 없으면 그냥 저장만
    let fileKey = "";
    let fileName = "";

    if (req.file) {
      fileName = req.file.originalname || "";

      // R2 환경변수 다 있으면 업로드 시도
      if (process.env.R2_ENDPOINT && process.env.R2_ACCESS_KEY && process.env.R2_SECRET_KEY && R2_BUCKET) {
        fileKey = `complaints/${nextId}-${Date.now()}-${fileName}`.replace(/\s+/g, "_");

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

    // DB에 저장
    const newItem = {
      id: nextId,
      name: req.body.name || "",
      identity: req.body.identity || "",
      content: req.body.content || "",
      created,
      fileName,
      fileKey, // R2 업로드 성공 시 key 저장 (없으면 "")
    };

    const next = Array.isArray(complaints) ? [...complaints, newItem] : [newItem];
    writeJSON(COMPLAINT_DB, next);

    return res.redirect("/inquiry/success");
  } catch (err) {
    console.error("❌ 민원 제출 오류:", err);
    return res.status(500).send("민원 제출 중 오류가 발생했습니다.");
  }
});

//  건의 제출 (form action="/suggest")
app.post("/suggest", (req, res) => {
  try {
    const suggestions = readJSON(SUGGEST_DB);

    const nextId =
      Array.isArray(suggestions) && suggestions.length
        ? Math.max(...suggestions.map(s => Number(s.id) || 0)) + 1
        : 1;

    const created = new Date().toISOString();

    const newItem = {
      id: nextId,
      name: req.body.name || "",
      identity: req.body.identity || "",
      content: req.body.content || "",
      created,
    };

    const next = Array.isArray(suggestions) ? [...suggestions, newItem] : [newItem];
    writeJSON(SUGGEST_DB, next);

    return res.redirect("/suggest/success");
  } catch (err) {
    console.error("❌ 건의 제출 오류:", err);
    return res.status(500).send("건의 제출 중 오류가 발생했습니다.");
  }
});


// -------------------- Server --------------------
app.listen(PORT, () =>
  console.log(`✅ Server running on ${PORT}`)
);
