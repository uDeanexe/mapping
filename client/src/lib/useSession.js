import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';

export function useSession() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) throw error;
        setSession(data.session || null);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setSession(null);
        setLoading(false);
      }); 

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession || null);
      setLoading(false);
    });

    return () => {
      alive = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  return { session, loading };
}

