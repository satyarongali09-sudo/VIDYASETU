"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/browser";
import { clearSessionPreference, shouldExpireSessionOnly } from "@/lib/auth/session-preference";
import { getRequestedRole, initializeUserProfile, type UserRole } from "@/lib/supabase/profile";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: UserRole;
};

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: UserRole | null;
  loading: boolean;
  error: string | null;
  signOut: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function isUserRole(value: unknown): value is UserRole {
  return value === "teacher" || value === "student";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    let requestId = 0;

    async function syncSession(nextSession: Session | null) {
      const currentRequest = ++requestId;

      if (!active) {
        return;
      }

      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setProfile(null);
      setError(null);

      if (!nextSession?.user) {
        setLoading(false);
        return;
      }

      let { data, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url, role")
        .eq("id", nextSession.user.id)
        .maybeSingle();

      if (!active || currentRequest !== requestId) {
        return;
      }

      if (!profileError && !data) {
        // This only initializes the signed-in user's own profile. Existing profile roles are never overwritten.
        try {
          await initializeUserProfile(supabase, nextSession.user, getRequestedRole(nextSession.user));
        } catch {
          if (active && currentRequest === requestId) {
            setError("Your account session is active, but your VIDYASETU profile could not be prepared.");
            setLoading(false);
          }
          return;
        }

        const profileResult = await supabase
          .from("profiles")
          .select("id, full_name, email, avatar_url, role")
          .eq("id", nextSession.user.id)
          .maybeSingle();
        data = profileResult.data;
        profileError = profileResult.error;
      }

      if (!active || currentRequest !== requestId) {
        return;
      }

      if (profileError) {
        setError("Your account session is active, but your VIDYASETU profile could not be loaded.");
        setLoading(false);
        return;
      }

      if (!data || !isUserRole(data.role)) {
        setError("Your account is signed in, but it does not have a valid VIDYASETU role.");
        setLoading(false);
        return;
      }

      setProfile(data);
      setLoading(false);
    }

    async function initialize() {
      if (shouldExpireSessionOnly()) {
        await supabase.auth.signOut({ scope: "local" });
        clearSessionPreference();

        if (active) {
          setSession(null);
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
        return;
      }

      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!active) {
        return;
      }

      if (sessionError) {
        setError("Your session could not be restored. Please sign in again.");
        setLoading(false);
        return;
      }

      void syncSession(data.session);
    }

    void initialize();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void syncSession(nextSession);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      profile,
      role: profile?.role ?? null,
      loading,
      error,
      async signOut() {
        const { error: signOutError } = await createClient().auth.signOut();
        if (!signOutError) {
          clearSessionPreference();
        }
        return signOutError ? "Could not sign out. Please try again." : null;
      }
    }),
    [error, loading, profile, session, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
