"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getAuthenticatedUser } from "@/lib/supabase/profile";
import { useAuth } from "@/components/auth-provider";
import type { UserRole } from "@/lib/supabase/profile";

type AuthenticatedShellProps = {
  children: React.ReactNode;
  requiredRole?: UserRole;
  redirectToRoleDashboard?: boolean;
};

export function AuthenticatedShell({ children, requiredRole, redirectToRoleDashboard }: AuthenticatedShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, role, loading, error } = useAuth();

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    if (redirectToRoleDashboard && role) {
      router.replace(`/${role}/dashboard`);
      return;
    }

    if (requiredRole && role && requiredRole !== role) {
      router.replace(`/${role}/dashboard`);
    }
  }, [loading, pathname, redirectToRoleDashboard, requiredRole, role, router, user]);

  if (loading) {
    return <AppShell><p>Restoring your session...</p></AppShell>;
  }

  if (!user) {
    return <AppShell><p>Redirecting to sign in...</p></AppShell>;
  }

  if (error || !role) {
    return <AppShell user={getAuthenticatedUser(user)}><p>{error ?? "Your VIDYASETU profile is unavailable."}</p></AppShell>;
  }

  if (redirectToRoleDashboard || (requiredRole && requiredRole !== role)) {
    return <AppShell user={getAuthenticatedUser(user)} role={role}><p>Opening your workspace...</p></AppShell>;
  }

  return <AppShell user={getAuthenticatedUser(user)} role={role}>{children}</AppShell>;
}
