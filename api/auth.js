import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { action, access_token } = req.body;

    if (action === 'google') {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${process.env.APP_URL}/auth/callback` }
      });
      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json({ url: data.url });
    }

    if (action === 'verify') {
      const { data: { user }, error } = await supabase.auth.getUser(access_token);
      if (error || !user) return res.status(401).json({ error: 'Invalid token' });

      // Создаём профиль если первый раз
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!profile) {
        await supabase.from('profiles').insert({
          id: user.id,
          email: user.email,
          name: user.user_metadata?.full_name || user.email
        });
      }

      return res.status(200).json({ user: { id: user.id, email: user.email, name: user.user_metadata?.full_name } });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
}
