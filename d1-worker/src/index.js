import { Router } from 'itty-router';
const router = Router();

// (중간 함수들 그대로)

async function getOrSeedPage(env, key) {
  const row = await env.DB.prepare('SELECT page_json FROM pages WHERE page_key = ?')
    .bind(key)
    .first();
  // ...
}

async function setPage(env, key, data) {
  await env.DB.prepare('INSERT OR REPLACE INTO pages(page_key, page_json, updated) VALUES(?, ?, ?)')
    .bind(key, JSON.stringify(data || {}), new Date().toISOString())
    .run();
}

//  루트
router.get('/', () => new Response('Jelly Police D1 API is running', {
  headers: { 'Content-Type': 'text/plain; charset=utf-8' },
}));

// (아래 라우터들 그대로)

export default {
  async fetch(request, env, ctx) {
    return router.handle(request, env, ctx);
  },
};
