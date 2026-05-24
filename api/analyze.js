export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'No text provided' });

  const prompt = `Ты — AI-ассистент для корпоративных сотрудников. Проанализируй текст встречи.
Верни ТОЛЬКО валидный JSON без markdown и пояснений.

{
  "events": [{
    "id": "уникальный id",
    "title": "название встречи",
    "date": "YYYY-MM-DD",
    "time": "HH:MM",
    "endTime": "HH:MM или null",
    "participants": "список участников или null",
    "link": "ссылка или null",
    "summary": "краткое резюме 2-3 предложения",
    "notes": "дополнительные заметки или null"
  }],
  "tasks": [{
    "id": "уникальный id",
    "title": "что сделать",
    "description": "детали или null",
    "priority": "high|medium|low",
    "deadline": "YYYY-MM-DD или null",
    "assignee": "кто делает или null",
    "status": "todo",
    "fromAI": true
  }],
  "backlog": [{
    "id": "уникальный id",
    "title": "задача без срока",
    "category": "работа|личное|прочее",
    "notes": "заметки или null"
  }],
  "reminders": [{
    "id": "уникальный id",
    "title": "о чём напомнить",
    "date": "YYYY-MM-DD",
    "time": "HH:MM",
    "context": "краткий контекст или null",
    "fromAI": true,
    "sent": false
  }]
}

Сегодня: ${new Date().toISOString().split('T')[0]}
Правила:
- tasks: конкретные рабочие задачи с ответственным или дедлайном
- backlog: размытые идеи, задачи без срока
- reminders: что нужно не забыть в конкретное время
- events: встречи, созвоны с датой и временем
- Пустые категории — пустой массив []

Текст:
${text}`;

  try {
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

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    const raw = data.content[0].text.trim().replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(raw);

    res.status(200).json(parsed);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
