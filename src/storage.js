const fs = require("fs");

// 이 프로젝트는 "D1(진짜 DB)"를 쓰기 위해, 서버(Express)가 Cloudflare Worker API를 호출하는 구조야.
// - D1은 Worker 바인딩(DB)로만 접근 가능
// - Express는 D1에 직접 연결 못 해서, Worker API(D1 API)를 중간에 둬.
//
// ✅ 환경변수
// - D1_API_BASE: Worker 배포 주소 (예: https://jelly-d1-api.<your-subdomain>.workers.dev)
// - D1_API_TOKEN: (선택) Worker에서 검증하는 관리자 토큰

const D1_API_BASE = (process.env.D1_API_BASE || "").replace(/\/+$/, "");
const D1_API_TOKEN = process.env.D1_API_TOKEN || "";

const useD1 = () => Boolean(D1_API_BASE);

// -------------------- Fallback JSON (로컬 개발/테스트용) --------------------
function ensureDB(file, defaultData) {
  if (!fs.existsSync("./database")) fs.mkdirSync("./database");
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(defaultData, null, 2));
  }
}
const readJSON = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const writeJSON = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2));

const COMPLAINT_DB = "./database/complaints.json";
const SUGGEST_DB = "./database/suggest.json";
const AGENCY_DB = "./database/agency.json";
const RANK_DB = "./database/rank.json";
const DEPT_DB = "./database/department.json";
const APPLY_COND_DB = "./database/apply_conditions.json";


ensureDB(COMPLAINT_DB, []);
ensureDB(SUGGEST_DB, []);
ensureDB(AGENCY_DB, {
  title: "젤리경찰청 기관 소개",
  content: "젤리 경찰청은 시민의 안전과 질서를 위해 존재합니다.",
});
ensureDB(RANK_DB, {
  title: "젤리경찰청 직급표",
  high: { 치안총감: "", 치안정감: "", 치안감: "" },
  mid: { 경무관: "", 총경: "", 경정: "", 경감: "" },
  normal: {
    경위: ["", "", "", "", ""],
    경사: ["", "", "", "", ""],
    경장: ["", "", "", "", ""],
    순경: ["", "", "", "", ""],
  },
  probation: ["", "", "", "", ""],
});
ensureDB(DEPT_DB, { title: "부서 소개", teams: [] });
ensureDB(APPLY_COND_DB, {
  title: "젤리 경찰청 채용 안내",
  cards: {
    eligibility: { title: "지원 자격 안내", content: "※ 세부 내용은 관리자 페이지에서 수정 가능합니다." },
    disqualify: { title: "지원 불가 사유", content: "※ 세부 내용은 관리자 페이지에서 수정 가능합니다." },
    preference: { title: "지원 우대 사항", content: "※ 세부 내용은 관리자 페이지에서 수정 가능합니다." },
  },
  side: { linkText: "링크1", linkUrl: "#" },
});


// -------------------- Worker API helper --------------------
async function apiFetch(path, { method = "GET", body, admin = false } = {}) {
  const url = `${D1_API_BASE}${path}`;

  const headers = {
    "Content-Type": "application/json",
  };

  // admin=true 인 작업은 토큰이 있으면 붙여 줌(Worker에서 검증)
  if (admin && D1_API_TOKEN) {
    headers.Authorization = `Bearer ${D1_API_TOKEN}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`D1 API ${method} ${path} failed: ${res.status} ${text}`);
  }

  // 일부 응답은 빈 바디일 수 있음
  const txt = await res.text();
  if (!txt) return null;
  return JSON.parse(txt);
}

// -------------------- Intro pages (agency/rank/department) --------------------
async function getAgency() {
  if (useD1()) return apiFetch("/api/agency");
  return readJSON(AGENCY_DB);
}
async function setAgency(data) {
  if (useD1()) return apiFetch("/api/agency", { method: "PUT", body: data, admin: true });
  writeJSON(AGENCY_DB, data);
  return true;
}

async function getRank() {
  if (useD1()) return apiFetch("/api/rank");
  return readJSON(RANK_DB);
}
async function setRank(data) {
  if (useD1()) return apiFetch("/api/rank", { method: "PUT", body: data, admin: true });
  writeJSON(RANK_DB, data);
  return true;
}

async function getDepartment() {
  if (useD1()) return apiFetch("/api/department");
  return readJSON(DEPT_DB);
}
async function setDepartment(data) {
  if (useD1()) return apiFetch("/api/department", { method: "PUT", body: data, admin: true });
  writeJSON(DEPT_DB, data);
  return true;
}

//
async function getApplyConditions() {
  if (useD1()) return apiFetch("/api/apply/conditions");
  return readJSON(APPLY_COND_DB);
}

async function setApplyConditions(data) {
  if (useD1()) return apiFetch("/api/apply/conditions", { method: "PUT", body: data, admin: true });
  writeJSON(APPLY_COND_DB, data);
  return true;
}


// -------------------- Complaints / Suggestions --------------------
async function listComplaints() {
  if (useD1()) return apiFetch("/api/complaints", { admin: true });
  return readJSON(COMPLAINT_DB);
}

async function listSuggestions() {
  if (useD1()) return apiFetch("/api/suggestions", { admin: true });
  return readJSON(SUGGEST_DB);
}

async function addComplaint(data) {
  if (useD1()) return apiFetch("/api/complaints", { method: "POST", body: data });

  const complaints = readJSON(COMPLAINT_DB);
  const nextId =
    Array.isArray(complaints) && complaints.length
      ? Math.max(...complaints.map((c) => Number(c.id) || 0)) + 1
      : 1;

  const newItem = { id: nextId, ...data };
  const next = Array.isArray(complaints) ? [...complaints, newItem] : [newItem];
  writeJSON(COMPLAINT_DB, next);
  return newItem;
}

async function addSuggestion(data) {
  if (useD1()) return apiFetch("/api/suggestions", { method: "POST", body: data });

  const suggestions = readJSON(SUGGEST_DB);
  const nextId =
    Array.isArray(suggestions) && suggestions.length
      ? Math.max(...suggestions.map((s) => Number(s.id) || 0)) + 1
      : 1;

  const newItem = { id: nextId, ...data };
  const next = Array.isArray(suggestions) ? [...suggestions, newItem] : [newItem];
  writeJSON(SUGGEST_DB, next);
  return newItem;
}

// -------------------- Notices --------------------
async function listNotices(limit = 5) {
  if (useD1()) return apiFetch(`/api/notices?limit=${encodeURIComponent(limit)}`);
  return [];
}

async function addNotice(data) {
  if (useD1()) return apiFetch("/api/notices", { method: "POST", body: data, admin: true });
  return true;
}

async function deleteNotice(id) {
  if (useD1()) return apiFetch(`/api/notices/${id}`, { method: "DELETE", admin: true });
  return true;
}

async function getNotice(id) {
  if (useD1()) return apiFetch(`/api/notices/${id}`);
  return null;
}



module.exports = {
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
  getApplyConditions,
  setApplyConditions,
  listNotices,
  addNotice,
  deleteNotice,
  getNotice,
};
