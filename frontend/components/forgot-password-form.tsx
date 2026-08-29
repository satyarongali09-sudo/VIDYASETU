"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/browser";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }

    setIsSubmitting(true);
    const { error: resetError } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin + "/auth/callback?next=/reset-password"
    });

    if (resetError) {
      setError("We could not send a reset link. Check the email address and try again.");
      setIsSubmitting(false);
      return;
    }

    setSuccess(true);
    setIsSubmitting(false);
  }

  return (
    <section className="auth-card form" aria-label="Password reset request">
      {success ? (
        <>
          <p className="form-success" role="status">Check your email for a password reset link.</p>
          <Link className="button-secondary" href="/login">Return to sign in</Link>
        </>
      ) : (
        <form className="form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="reset-email">Email</label>
            <input id="reset-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>
          <button className="button" type="submit" disabled={isSubmitting}>{isSubmitting ? "Sending..." : "Send reset link"}</button>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
        </form>
      )}
    </section>
  );
}
