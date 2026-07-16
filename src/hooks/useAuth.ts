import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { clearStoredAuthSession } from "@/utils/authCleanup";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const finishSignedOut = () => {
      if (!mounted) return;
      setSession(null);
      setUser(null);
      setLoading(false);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      if (!mounted || event === "INITIAL_SESSION") return;
      setSession(sess);
      setUser(sess?.user ?? null);
      setLoading(false);
    });

    supabase.auth
      .getUser()
      .then(({ data, error }) => {
        if (error || !data.user) {
          clearStoredAuthSession();
          finishSignedOut();
          return;
        }

        if (!mounted) return;
        setUser(data.user);
        setSession(null);
        setLoading(false);
      })
      .catch(() => {
        clearStoredAuthSession();
        finishSignedOut();
      });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { user, session, loading, signOut };
}
