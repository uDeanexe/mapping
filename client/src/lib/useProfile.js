import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';

export function useProfile(session) {
  const userId = session?.user?.id || null;
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(Boolean(userId));

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);

    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id,email,name,role,is_active,created_at,updated_at')
        .eq('id', userId)
        .maybeSingle();
      if (!alive) return;
      if (!error && data) {
        setProfile(data);
        setLoading(false);
        return;
      }

      // Auto-create minimal profile on first login.
      const fallback = {
        id: userId,
        email: session?.user?.email || null,
        name: session?.user?.email || 'User',
        role: 'teknisi',
        is_active: 1
      };
      const { error: upsertErr } = await supabase.from('profiles').upsert(fallback);
      if (!alive) return;
      if (upsertErr) {
        setProfile(fallback);
        setLoading(false);
        return;
      }
      setProfile(fallback);
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

  return { profile, loading };
}

