import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

import { isSupabaseConfigured } from '@/lib/env';
import { supabase } from '@/lib/supabase';

/** Aktuelle Supabase-Session; `loading` bis die gespeicherte Session geladen ist. */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured());

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  return { session, loading };
}
