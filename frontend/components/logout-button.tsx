"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

export function LogoutButton() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    setIsSigningOut(true);
    setError(null);

    const signOutError = await signOut();

    if (signOutError) {
      setError("Could not sign out. Please try again.");
      setIsSigningOut(false);
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="logout-control">
      <button className="nav-button" type="button" onClick={handleSignOut} disabled={isSigningOut}>
        {isSigningOut ? "Signing out..." : "Sign out"}
      </button>
      {error ? <span className="logout-error" role="alert">{error}</span> : null}
    </div>
  );
}
