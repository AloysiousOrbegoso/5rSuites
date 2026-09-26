import { purgeSite } from '../../lib/content.js';
import { cleanString, json, readJson } from '../../lib/http.js';

export function cleanFaq(body) {
  return {
    question: cleanString(body.question, { max: 300, required: true, label: 'Question' }),
    answer: cleanString(body.answer, { max: 5000, required: true, label: 'Answer' }),
    category: cleanString(body.category, { max: 80, label: 'Category' }),
  };
}

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare('SELECT * FROM faq_items ORDER BY position, id').all();
  return json({ items: results });
}

export async function onRequestPost({ request, env }) {
  const f = cleanFaq(await readJson(request));
  const row = await env.DB.prepare(
    `INSERT INTO faq_items (question, answer, category, position)
     VALUES (?, ?, ?, (SELECT COALESCE(MAX(position), -1) + 1 FROM faq_items)) RETURNING *`,
  )
    .bind(f.question, f.answer, f.category)
    .first();
  const purge = await purgeSite(env, ['faq']);
  return json({ item: row, ...purge }, { status: 201 });
}
