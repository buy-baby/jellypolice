import { Router } from 'itty-router';

const router = Router();

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
    ...init,
  });
}

function ok() {
  return new Response(null, { status: 204 });
}

function unauthorized() {
  return json({ error: 'unauthorized' }, { status: 401 });
}

async function readBody(request) {
  const text = await request.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function isAdmin(request, env) {
  const token = env.API_TOKEN || '';
  if (!token) return true; // 토큰을 안 쓰면(빈값이면) 검증 스킵
  const auth = request.headers.get('authorization') || '';
  return auth === `Bearer ${token}`;
}

// ---- page helpers ----
const DEFAULT_PAGES = {
  agency: {
    title: '젤리경찰청 기관 소개',
    content: '젤리 경찰청은 시민의 안전과 질서를 위해 존재합니다.',
  },
  rank: {
    title: '젤리경찰청 직급표',
    high: { '치안총감': '', '치안정감': '', '치안감': '' },
    mid: { '경무관': '', '총경': '', '경정': '', '경감': '' },
    normal: {
      '경위': ['', '', '', '', ''],
      '경사': ['', '', '', '', ''],
      '경장': ['', '', '', '', ''],
      '순경': ['', '', '', '', ''],
    },
    probation: ['', '', '', '', ''],
  },
  department: {
    title: '부서 소개',
    teams: [],
  },
};

async function getOrSeedPage(env, key) {
  const row = await env.DB
    .prepare('SELECT page_json FROM pages WHERE page_key = ?')
    .bind(key)
    .first();

  if (row && row.page_json) {
    try {
      return JSON.parse(row.page_json);
    } catch {
      return DEFAULT_PAGES[key] || {};
    }
  }

  const data = DEFAULT_PAGES[key] || {};
  await env.DB
    .prepare('INSERT OR REPLACE INTO pages(page_key, page_json, updated) VALUES(?, ?, ?)')
    .bind(key, JSON.stringify(data), new Date().toISOString())
    .run();

  return data;
}

async function setPage(env, key, data) {
  await env.DB
    .prepare('INSERT OR REPLACE INTO pages(page_key, page_json, updated) VALUES(?, ?, ?)')
    .bind(key, JSON.stringify(data || {}), new Date().toISOString())
    .run();
}

// ---- Root ----
router.get('/', () =>
  new Response('Jelly Police D1 API is running', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
);

// ---- Health ----
router.get('/api/health', () => json({ ok: true }));

// ---- Pages ----
router.get('/api/agency', async (req, env) => json(await getOrSeedPage(env, 'agency')));
router.get('/api/rank', async (req, env) => json(await getOrSeedPage(env, 'rank')));
router.get('/api/department', async (req, env) => json(await getOrSeedPage(env, 'department')));

router.put('/api/agency', async (req, env) => {
  if (!isAdmin(req, env)) return unauthorized();
  const body = await readBody(req);
  await setPage(env, 'agency', body);
  return ok();
});

router.put('/api/rank', async (req, env) => {
  if (!isAdmin(req, env)) return unauthorized();
  const body = await readBody(req);
  await setPage(env, 'rank', body);
  return ok();
});

router.put('/api/department', async (req, env) => {
  if (!isAdmin(req, env)) return unauthorized();
  const body = await readBody(req);
  await setPage(env, 'department', body);
  return ok();
});

// ---- Complaints ----
router.get('/api/complaints', async (req, env) => {
  if (!isAdmin(req, env)) return unauthorized();
  const { results } = await env.DB
    .prepare('SELECT id, name, identity, content, created, fileName, fileKey FROM complaints ORDER BY id DESC')
    .all();
  return json(results || []);
});

router.post('/api/complaints', async (req, env) => {
  const body = await readBody(req);
  const created = body.created || new Date().toISOString();

  const r = await env.DB
    .prepare('INSERT INTO complaints(name, identity, content, created, fileName, fileKey) VALUES(?, ?, ?, ?, ?, ?)')
    .bind(
      body.name || '',
      body.identity || '',
      body.content || '',
      created,
      body.fileName || '',
      body.fileKey || ''
    )
    .run();

  return json({ ok: true, id: r.meta?.last_row_id || null });
});

// ---- Suggestions ----
router.get('/api/suggestions', async (req, env) => {
  if (!isAdmin(req, env)) return unauthorized();
  const { results } = await env.DB
    .prepare('SELECT id, name, identity, content, created FROM suggestions ORDER BY id DESC')
    .all();
  return json(results || []);
});

router.post('/api/suggestions', async (req, env) => {
  const body = await readBody(req);
  const created = body.created || new Date().toISOString();

  const r = await env.DB
    .prepare('INSERT INTO suggestions(name, identity, content, created) VALUES(?, ?, ?, ?)')
    .bind(body.name || '', body.identity || '', body.content || '', created)
    .run();

  return json({ ok: true, id: r.meta?.last_row_id || null });
});

router.all('*', () => json({ error: 'not_found' }, { status: 404 }));

export default {
  async fetch(request, env, ctx) {
    return router.handle(request, env, ctx);
  },
};
