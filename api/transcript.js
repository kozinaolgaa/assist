import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid token' });

  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'No text' });

  // Анализируем через Claude
  const prompt = `Ты — AI-ассистент для корпоративных сотрудников. Проанализируй текст встречи.
Верни ТОЛЬКО валидный JSON без markdown и пояснений.

{
  "events": [{"id":"uid","title":"","date":"YYYY-MM-DD","time":"HH:MM","endTime":null,"participants":null,"link":null,"summary":"","notes":null}],
  "tasks": [{"id":"uid","title":"","description":null,"priority":"high|medium|low","deadline":"YYYY-MM-DD|null","assignee":null,"status":"todo","fromAI":true}],
  "backlog": [{"id":"uid","title":"","category":"работа|личное|прочее","notes":null}],
  "reminders": [{"id":"uid","title":"","date":"YYYY-MM-DD","time":"HH:MM","context":null,"fromAI":true,"sent":false}]
}

Сегодня: ${new Date().toISOString().split('T')[0]}
Пустые категории — пустой массив [].

Текст: ${text}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const aiData = await response.json();
  if (aiData.error) return res.status(500).json({ error: aiData.error.message });

  const raw = aiData.content[0].text.trim().replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(raw);

  // Возвращаем результат - фронтенд сам покажет экран подтверждения
  res.status(200).json({ ...parsed, user_id: user.id });
}
