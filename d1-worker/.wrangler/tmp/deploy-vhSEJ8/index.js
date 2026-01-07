var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// node_modules/itty-router/index.mjs
var e = /* @__PURE__ */ __name(({ base: e2 = "", routes: t = [], ...o2 } = {}) => ({ __proto__: new Proxy({}, { get: /* @__PURE__ */ __name((o3, s2, r, n) => "handle" == s2 ? r.fetch : (o4, ...a) => t.push([s2.toUpperCase?.(), RegExp(`^${(n = (e2 + o4).replace(/\/+(\/|$)/g, "$1")).replace(/(\/?\.?):(\w+)\+/g, "($1(?<$2>*))").replace(/(\/?\.?):(\w+)/g, "($1(?<$2>[^$1/]+?))").replace(/\./g, "\\.").replace(/(\/?)\*/g, "($1.*)?")}/*$`), a, n]) && r, "get") }), routes: t, ...o2, async fetch(e3, ...o3) {
  let s2, r, n = new URL(e3.url), a = e3.query = { __proto__: null };
  for (let [e4, t2] of n.searchParams) a[e4] = a[e4] ? [].concat(a[e4], t2) : t2;
  for (let [a2, c2, i2, l2] of t) if ((a2 == e3.method || "ALL" == a2) && (r = n.pathname.match(c2))) {
    e3.params = r.groups || {}, e3.route = l2;
    for (let t2 of i2) if (null != (s2 = await t2(e3.proxy ?? e3, ...o3))) return s2;
  }
} }), "e");
var o = /* @__PURE__ */ __name((e2 = "text/plain; charset=utf-8", t) => (o2, { headers: s2 = {}, ...r } = {}) => void 0 === o2 || "Response" === o2?.constructor.name ? o2 : new Response(t ? t(o2) : o2, { headers: { "content-type": e2, ...s2.entries ? Object.fromEntries(s2) : s2 }, ...r }), "o");
var s = o("application/json; charset=utf-8", JSON.stringify);
var c = o("text/plain; charset=utf-8", String);
var i = o("text/html");
var l = o("image/jpeg");
var p = o("image/png");
var d = o("image/webp");

// src/index.js
var router = e();
function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json; charset=utf-8" },
    ...init
  });
}
__name(json, "json");
function ok() {
  return new Response(null, { status: 204 });
}
__name(ok, "ok");
function unauthorized() {
  return json({ error: "unauthorized" }, { status: 401 });
}
__name(unauthorized, "unauthorized");
async function readBody(request) {
  const text = await request.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}
__name(readBody, "readBody");
function isAdmin(request, env) {
  const token = env.API_TOKEN || "";
  if (!token) return true;
  const auth = request.headers.get("authorization") || "";
  return auth === `Bearer ${token}`;
}
__name(isAdmin, "isAdmin");
var DEFAULT_PAGES = {
  agency: {
    title: "\uC824\uB9AC\uACBD\uCC30\uCCAD \uAE30\uAD00 \uC18C\uAC1C",
    content: "\uC824\uB9AC \uACBD\uCC30\uCCAD\uC740 \uC2DC\uBBFC\uC758 \uC548\uC804\uACFC \uC9C8\uC11C\uB97C \uC704\uD574 \uC874\uC7AC\uD569\uB2C8\uB2E4."
  },
  rank: {
    title: "\uC824\uB9AC\uACBD\uCC30\uCCAD \uC9C1\uAE09\uD45C",
    high: { \uCE58\uC548\uCD1D\uAC10: "", \uCE58\uC548\uC815\uAC10: "", \uCE58\uC548\uAC10: "" },
    mid: { \uACBD\uBB34\uAD00: "", \uCD1D\uACBD: "", \uACBD\uC815: "", \uACBD\uAC10: "" },
    normal: {
      \uACBD\uC704: ["", "", "", "", ""],
      \uACBD\uC0AC: ["", "", "", "", ""],
      \uACBD\uC7A5: ["", "", "", "", ""],
      \uC21C\uACBD: ["", "", "", "", ""]
    },
    probation: ["", "", "", "", ""]
  },
  department: {
    title: "\uBD80\uC11C \uC18C\uAC1C",
    teams: [
      { name: "\uAC10\uC0AC\uD300", desc: "\u203B \uC138\uBD80 \uB0B4\uC6A9\uC740 \uAD00\uB9AC\uC790 \uD398\uC774\uC9C0\uC5D0\uC11C \uC218\uC815 \uAC00\uB2A5\uD569\uB2C8\uB2E4." },
      { name: "\uC778\uC0AC\uD300", desc: "\u203B \uC138\uBD80 \uB0B4\uC6A9\uC740 \uAD00\uB9AC\uC790 \uD398\uC774\uC9C0\uC5D0\uC11C \uC218\uC815 \uAC00\uB2A5\uD569\uB2C8\uB2E4." },
      { name: "\uD2B9\uC218 \uAC80\uAC70 \uAE30\uB3D9\uB300(SCP)", desc: "\u203B \uC138\uBD80 \uB0B4\uC6A9\uC740 \uAD00\uB9AC\uC790 \uD398\uC774\uC9C0\uC5D0\uC11C \uC218\uC815 \uAC00\uB2A5\uD569\uB2C8\uB2E4." },
      { name: "\uD2B9\uACF5\uB300(SOU)", desc: "\u203B \uC138\uBD80 \uB0B4\uC6A9\uC740 \uAD00\uB9AC\uC790 \uD398\uC774\uC9C0\uC5D0\uC11C \uC218\uC815 \uAC00\uB2A5\uD569\uB2C8\uB2E4." },
      { name: "\uD56D\uACF5\uD300(ASD)", desc: "\u203B \uC138\uBD80 \uB0B4\uC6A9\uC740 \uAD00\uB9AC\uC790 \uD398\uC774\uC9C0\uC5D0\uC11C \uC218\uC815 \uAC00\uB2A5\uD569\uB2C8\uB2E4." }
    ]
  },
  apply_conditions: {
    title: "\uC824\uB9AC \uACBD\uCC30\uCCAD \uCC44\uC6A9 \uC548\uB0B4",
    cards: {
      eligibility: {
        title: "\uC9C0\uC6D0 \uC790\uACA9 \uC548\uB0B4",
        content: "\u203B \uC138\uBD80 \uB0B4\uC6A9\uC740 \uAD00\uB9AC\uC790 \uD398\uC774\uC9C0\uC5D0\uC11C \uC218\uC815 \uAC00\uB2A5\uD569\uB2C8\uB2E4."
      },
      disqualify: {
        title: "\uC9C0\uC6D0 \uBD88\uAC00 \uC0AC\uC720",
        content: "\u203B \uC138\uBD80 \uB0B4\uC6A9\uC740 \uAD00\uB9AC\uC790 \uD398\uC774\uC9C0\uC5D0\uC11C \uC218\uC815 \uAC00\uB2A5\uD569\uB2C8\uB2E4."
      },
      preference: {
        title: "\uC9C0\uC6D0 \uC6B0\uB300 \uC0AC\uD56D",
        content: "\u203B \uC138\uBD80 \uB0B4\uC6A9\uC740 \uAD00\uB9AC\uC790 \uD398\uC774\uC9C0\uC5D0\uC11C \uC218\uC815 \uAC00\uB2A5\uD569\uB2C8\uB2E4."
      }
    },
    side: {
      linkText: "\uB9C1\uD06C1",
      linkUrl: "#"
    }
  }
};
async function getOrSeedPage(env, key) {
  const row = await env.DB.prepare("SELECT page_json FROM pages WHERE page_key = ?").bind(key).first();
  if (row && row.page_json) {
    try {
      return JSON.parse(row.page_json);
    } catch {
      return DEFAULT_PAGES[key] || {};
    }
  }
  const data = DEFAULT_PAGES[key] || {};
  await env.DB.prepare(
    "INSERT OR REPLACE INTO pages(page_key, page_json, updated) VALUES(?, ?, ?)"
  ).bind(key, JSON.stringify(data), (/* @__PURE__ */ new Date()).toISOString()).run();
  return data;
}
__name(getOrSeedPage, "getOrSeedPage");
async function setPage(env, key, data) {
  await env.DB.prepare(
    "INSERT OR REPLACE INTO pages(page_key, page_json, updated) VALUES(?, ?, ?)"
  ).bind(key, JSON.stringify(data || {}), (/* @__PURE__ */ new Date()).toISOString()).run();
}
__name(setPage, "setPage");
router.get(
  "/",
  () => new Response("Jelly Police D1 API is running", {
    headers: { "Content-Type": "text/plain; charset=utf-8" }
  })
);
router.get("/api/health", () => json({ ok: true }));
router.get("/api/agency", async (req, env) => json(await getOrSeedPage(env, "agency")));
router.get("/api/rank", async (req, env) => json(await getOrSeedPage(env, "rank")));
router.get("/api/department", async (req, env) => json(await getOrSeedPage(env, "department")));
router.get(
  "/api/apply/conditions",
  async (req, env) => json(await getOrSeedPage(env, "apply_conditions"))
);
router.put("/api/agency", async (req, env) => {
  if (!isAdmin(req, env)) return unauthorized();
  await setPage(env, "agency", await readBody(req));
  return ok();
});
router.put("/api/rank", async (req, env) => {
  if (!isAdmin(req, env)) return unauthorized();
  await setPage(env, "rank", await readBody(req));
  return ok();
});
router.put("/api/department", async (req, env) => {
  if (!isAdmin(req, env)) return unauthorized();
  await setPage(env, "department", await readBody(req));
  return ok();
});
router.put("/api/apply/conditions", async (req, env) => {
  if (!isAdmin(req, env)) return unauthorized();
  await setPage(env, "apply_conditions", await readBody(req));
  return ok();
});
router.get("/api/notices", async (req, env) => {
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") || 5), 20);
  const { results } = await env.DB.prepare(
    "SELECT id, title, content, created FROM notices ORDER BY id DESC LIMIT ?"
  ).bind(limit).all();
  return json(results || []);
});
router.post("/api/notices", async (req, env) => {
  if (!isAdmin(req, env)) return unauthorized();
  const body = await readBody(req);
  const title = (body.title || "").trim();
  const content = (body.content || "").trim();
  if (!title || !content) return json({ error: "title/content required" }, { status: 400 });
  const created = (/* @__PURE__ */ new Date()).toISOString();
  const r = await env.DB.prepare(
    "INSERT INTO notices(title, content, created) VALUES(?, ?, ?)"
  ).bind(title, content, created).run();
  return json({ ok: true, id: r.meta?.last_row_id ?? null });
});
router.delete("/api/notices/:id", async (req, env) => {
  if (!isAdmin(req, env)) return unauthorized();
  const id = Number(req.params.id);
  if (!id) return json({ error: "bad_id" }, { status: 400 });
  await env.DB.prepare("DELETE FROM notices WHERE id = ?").bind(id).run();
  return ok();
});
router.get("/api/complaints", async (req, env) => {
  if (!isAdmin(req, env)) return unauthorized();
  const { results } = await env.DB.prepare(
    "SELECT id, name, identity, content, created, fileName, fileKey FROM complaints ORDER BY id DESC"
  ).all();
  return json(results || []);
});
router.post("/api/complaints", async (req, env) => {
  const body = await readBody(req);
  const created = body.created || (/* @__PURE__ */ new Date()).toISOString();
  const r = await env.DB.prepare(
    "INSERT INTO complaints(name, identity, content, created, fileName, fileKey) VALUES(?, ?, ?, ?, ?, ?)"
  ).bind(
    body.name || "",
    body.identity || "",
    body.content || "",
    created,
    body.fileName || "",
    body.fileKey || ""
  ).run();
  return json({ ok: true, id: r.meta?.last_row_id ?? null });
});
router.get("/api/suggestions", async (req, env) => {
  if (!isAdmin(req, env)) return unauthorized();
  const { results } = await env.DB.prepare(
    "SELECT id, name, identity, content, created FROM suggestions ORDER BY id DESC"
  ).all();
  return json(results || []);
});
router.post("/api/suggestions", async (req, env) => {
  const body = await readBody(req);
  const created = body.created || (/* @__PURE__ */ new Date()).toISOString();
  const r = await env.DB.prepare(
    "INSERT INTO suggestions(name, identity, content, created) VALUES(?, ?, ?, ?)"
  ).bind(body.name || "", body.identity || "", body.content || "", created).run();
  return json({ ok: true, id: r.meta?.last_row_id ?? null });
});
router.all("*", () => json({ error: "not_found" }, { status: 404 }));
var index_default = {
  async fetch(request, env, ctx) {
    return router.handle(request, env, ctx);
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
