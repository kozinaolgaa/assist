import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function getUserFromToken(token) {
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export default async function handler(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });

  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid token' });

  const uid = user.id;
  const { action, table, data, id } = req.body || {};

  if (req.method === 'GET') {
    // Загрузить все данные пользователя
    const [events, tasks, backlog, reminders] = await Promise.all([
      supabase.from('events').select('*').eq('user_id', uid).order('created_at'),
      supabase.from('tasks').select('*').eq('user_id', uid).order('created_at'),
      supabase.from('backlog').select('*').eq('user_id', uid).order('created_at'),
      supabase.from('reminders').select('*').eq('user_id', uid).order('created_at')
    ]);

    return res.status(200).json({
      events: events.data || [],
      tasks: tasks.data || [],
      backlog: backlog.data || [],
      reminders: reminders.data || []
    });
  }

  if (req.method === 'POST') {
    if (action === 'save') {
      // Сохранить один элемент
      const row = { ...data, user_id: uid };
      const { error } = await supabase.from(table).upsert(row);
      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    if (action === 'delete') {
      const { error } = await supabase.from(table).delete().eq('id', id).eq('user_id', uid);
      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    if (action === 'save_all') {
      // Сохранить массив после анализа встречи
      const { events, tasks, backlog, reminders } = data;
      const promises = [];

      if (events?.length) promises.push(
        supabase.from('events').upsert(events.map(e => ({ ...e, user_id: uid })))
      );
      if (tasks?.length) promises.push(
        supabase.from('tasks').upsert(tasks.map(t => ({ ...t, user_id: uid, from_ai: t.fromAI })))
      );
      if (backlog?.length) promises.push(
        supabase.from('backlog').upsert(backlog.map(b => ({ ...b, user_id: uid })))
      );
      if (reminders?.length) promises.push(
        supabase.from('reminders').upsert(reminders.map(r => ({ ...r, user_id: uid, from_ai: r.fromAI })))
      );

      await Promise.all(promises);
      return res.status(200).json({ ok: true });
    }
  }

  res.status(400).json({ error: 'Unknown action' });
}
