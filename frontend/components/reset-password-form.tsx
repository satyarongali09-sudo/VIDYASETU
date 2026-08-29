"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { createClient } from "@/lib/supabase/browser";

export function ResetPasswordForm() {
  const router = useRouter();
  const { loading, user } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    const { error: updateError } = await createClient().auth.updateUser({ password });

    if (updateError) {
      setError("This reset link is invalid or has expired. Request a new link and try again.");
      setIsSubmitting(false);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  if (loading) {
    return <section className="auth-card"><p>Checking your reset link...</p></section>;
  }

  if (!user) {
    return (
      <section className="auth-card form">
        <p className="form-error" role="alert">This reset link is invalid or has expired.</p>
        <Link className="button-secondary" href="/forgot-password">Request a new reset link</Link>
      </section>
    );
  }

  return (
    <section className="auth-card form" aria-label="Set new password">
      <form className="form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="new-password">New password</label>
          <div className="password-field">
            <input id="new-password" type={showPassword ? "text" : "password"} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            <button className="password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "Hide" : "Show"}</button>
          </div>
        </div>
        <div className="field">
          <label htmlFor="new-password-confirm">Confirm new password</label>
          <input id="new-password-confirm" type={showPassword ? "text" : "password"} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
        </div>
        <button className="button" type="submit" disabled={isSubmitting}>{isSubmitting ? "Updating..." : "Set new password"}</button>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
      </form>
    </section>
  );
}
