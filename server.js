const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const {
  getAgency,
  setAgency,
  getRank,
  setRank,
  getDepartment,
  setDepartment,
  listComplaints,
  listSuggestions,
  addComplaint,
  addSuggestion,
} = require("./src/storage");

const app = express();
const PORT = process.env.PORT || 3000;

// -------------------- Cloudflare R2 (파일 저장용) --------------------
const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY,
    secretAccessKey: process.env.R2_SECRET_KEY,
  },
});
const R2_BUCKET = process.env.R2_BUCKET_NAME;

// -------------------- Middleware --------------------
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static("public"));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "public", "views"));

const upload = multer({ storage: multer.memoryStorage() });

// -------------------- Admin Auth --------------------
// Render/서버에서 환경변수로 바꾸는 걸 추천 (없으면 기존 값으로 동작)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "jellypolice1234";
const requireAdmin = (req, res, next) =>
  req.cookies.admin === "loggedin" ? next() : res.redirect("/login");

// -------------------- Admin Login --------------------
app.get("/login", (_, res) => res.render("admin/admin_login"));
app.post("/login", (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) {
    res.cookie("admin", "loggedin", {
      httpOnly: true,
      sameSite: "lax",
    });
    return res.redirect("/admin");
  }
  return res.render("admin/admin_login", { error: "비밀번호가 틀렸습니다." });
});

// -------------------- Admin Main --------------------
app.get("/admin", requireAdmin, (_, res) => res.render("admin/admin_main"));

// -------------------- Public Pages --------------------
app.get("/", (_, res) => res.render("main/main"));

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

// -------------------- Admin Edit Agency --------------------
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

// -------------------- Admin Edit Department --------------------
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

// -------------------- Admin Edit Rank --------------------
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

// -------------------- Citizen Pages --------------------
app.get("/inquiry", (_, res) => res.render("inquiry/index"));
app.get("/suggest", (_, res) => res.render("suggest/suggest"));
app.get("/apply", (_, res) => res.render("apply/index"));
app.get("/apply/conditions", (_, res) => res.render("apply/apply_conditions"));
app.get("/apply/apply", (_, res) => res.render("apply/apply_apply"));
app.get("/customer", (_, res) => res.render("customer/index"));

// -------------------- Admin Inquiry / Suggest --------------------
app.get("/admin/inquiry", requireAdmin, async (_, res) => {
  const complaints = await listComplaints();
  res.render("admin/inquiry_list", { complaints });
});

app.get("/admin/suggest", requireAdmin, async (_, res) => {
  const suggestions = await listSuggestions();
  res.render("admin/suggest_list", { suggestions });
});

// -------------------- Citizen Submit (민원/건의) --------------------
app.get("/inquiry/success", (_, res) => res.render("inquiry/success"));
app.get("/suggest/success", (_, res) => res.render("suggest/success"));

// 민원 제출 (form action="/submit")
app.post("/submit", upload.single("file"), async (req, res) => {
  try {
    const created = new Date().toISOString();

    // 파일 업로드(선택)
    let fileKey = "";
    let fileName = "";

    if (req.file) {
      fileName = req.file.originalname || "";

      // R2 환경변수 다 있으면 업로드 시도
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

// 건의 제출 (form action="/suggest")
app.post("/suggest", async (req, res) => {
  try {
    const created = new Date().toISOString();

    await addSuggestion({
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

// -------------------- Server --------------------
app.listen(PORT, () => console.log(`✅ Server running on ${PORT}`));
