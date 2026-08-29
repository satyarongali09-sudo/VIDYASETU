"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { setSessionPreference } from "@/lib/auth/session-preference";
import { createClient } from "@/lib/supabase/browser";
import type { UserRole } from "@/lib/supabase/profile";

type AuthFormProps = {
  initialError?: string;
  initialMode?: "sign-in" | "create-account";
};

function getAuthErrorMessage(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "The email address or password is incorrect.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Confirm your email address before signing in.";
  }

  if (normalized.includes("already registered")) {
    return "An account already exists for this email. Sign in instead.";
  }

  return message || "We could not complete your request. Please try again.";
}

export function AuthForm({ initialError, initialMode = "sign-in" }: AuthFormProps) {
  const router = useRouter();
  const { loading, role: authenticatedRole, user } = useAuth();
  const [mode, setMode] = useState<"sign-in" | "create-account">(initialMode);
  const [role, setRole] = useState<UserRole>("student");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberSession, setRememberSession] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState(initialError ?? null);
  const [success, setSuccess] = useState<string | null>(null);
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");

  useEffect(() => {
    if (!loading && user && authenticatedRole) {
      router.replace(`/${authenticatedRole}/dashboard`);
    }
  }, [authenticatedRole, loading, router, user]);

  useEffect(() => {
    if (resendCooldown === 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setResendCooldown((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  async function prepareRoleHandoff() {
    const contextResponse = await fetch("/auth/oauth-context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role })
    }).catch(() => null);

    return contextResponse?.ok ?? false;
  }

  async function handleGoogleSignIn() {
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    if (!(await prepareRoleHandoff())) {
      setError("Google Sign-In could not be prepared. Please try again.");
      setIsSubmitting(false);
      return;
    }

    const { data, error: oauthError } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/auth/callback",
        skipBrowserRedirect: true
      }
    });

    if (oauthError || !data.url) {
      setError("Google Sign-In could not start. Check the provider and callback URL configuration, then try again.");
      setIsSubmitting(false);
      return;
    }

    // Explicit navigation avoids embedded preview browsers swallowing the OAuth redirect.
    window.location.assign(data.url);
  }

  function showVerificationRequired(address: string) {
    setVerificationEmail(address.trim());
    setVerificationRequired(true);
    setError(null);
    setSuccess(null);
  }

  async function handleResendVerification() {
    if (!verificationEmail) {
      setError("Enter your email address to resend verification.");
      return;
    }

    setIsResendingVerification(true);
    setError(null);
    const { error: resendError } = await createClient().auth.resend({
      type: "signup",
      email: verificationEmail,
      options: {
        emailRedirectTo: window.location.origin + "/auth/callback"
      }
    });

    if (resendError) {
      setError("We could not resend the verification email yet. Please wait a moment and try again.");
      setIsResendingVerification(false);
      return;
    }

    setSuccess("Verification email sent. Check your inbox, then return to sign in.");
    setResendCooldown(60);
    setIsResendingVerification(false);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim() || !password) {
      setError("Enter your email address and password.");
      return;
    }

    if (mode === "create-account") {
      if (!fullName.trim()) {
        setError("Enter your full name.");
        return;
      }

      if (password.length < 8) {
        setError("Use a password with at least 8 characters.");
        return;
      }

      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setIsSubmitting(true);
    const supabase = createClient();

    if (mode === "sign-in") {
      setSessionPreference(rememberSession);
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (signInError) {
        if (signInError.message.toLowerCase().includes("email not confirmed")) {
          showVerificationRequired(email);
          setIsSubmitting(false);
          return;
        }

        setError(getAuthErrorMessage(signInError.message));
        setIsSubmitting(false);
        return;
      }

      router.replace("/dashboard");
      router.refresh();
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          vidyasetu_role: role
        },
        emailRedirectTo: window.location.origin + "/auth/callback"
      }
    });

    if (signUpError) {
      setError(getAuthErrorMessage(signUpError.message));
      setIsSubmitting(false);
      return;
    }

    if (!data.session) {
      showVerificationRequired(email);
      setSuccess("Verification email sent. Check your inbox, then return to sign in.");
      setIsSubmitting(false);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  if (!loading && user) {
    const dashboardPath = authenticatedRole ? `/${authenticatedRole}/dashboard` : "/dashboard";

    return (
      <section className="panel form" aria-label="Signed in account">
        <p>You are already signed in. Opening your dashboard...</p>
        <Link className="button google-button" href={dashboardPath}>Open dashboard</Link>
      </section>
    );
  }

  if (verificationRequired) {
    return (
      <section className="auth-card form" aria-label="Email verification required">
        <div className="verification-copy">
          <span className="eyebrow">Email verification required</span>
          <h2>Verify your email before signing in</h2>
          <p>Your account needs to be verified before you can sign in.</p>
        </div>
        <button className="button" type="button" onClick={handleResendVerification} disabled={isResendingVerification || resendCooldown > 0}>
          {isResendingVerification ? "Sending verification email..." : resendCooldown > 0 ? `Resend available in ${resendCooldown}s` : "Resend verification email"}
        </button>
        <button className="button-secondary" type="button" onClick={() => { setVerificationRequired(false); setError(null); setSuccess(null); }}>
          Back to sign in
        </button>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        {success ? <p className="form-success" role="status">{success}</p> : null}
      </section>
    );
  }

  return (
    <section className="auth-card" aria-label="Authentication">
      <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
        <button className={mode === "sign-in" ? "auth-tab active" : "auth-tab"} type="button" role="tab" aria-selected={mode === "sign-in"} onClick={() => { setMode("sign-in"); setError(null); setSuccess(null); }}>
          Sign In
        </button>
        <button className={mode === "create-account" ? "auth-tab active" : "auth-tab"} type="button" role="tab" aria-selected={mode === "create-account"} onClick={() => { setMode("create-account"); setError(null); setSuccess(null); }}>
          Create Account
        </button>
      </div>
      <div className="role-toggle" aria-label="VIDYASETU role">
        <button className={role === "teacher" ? "role-option active" : "role-option"} type="button" aria-pressed={role === "teacher"} onClick={() => setRole("teacher")}>Teacher</button>
        <button className={role === "student" ? "role-option active" : "role-option"} type="button" aria-pressed={role === "student"} onClick={() => setRole("student")}>Student</button>
      </div>
      <form className="form" onSubmit={handleSubmit} noValidate>
        {mode === "create-account" ? (
          <div className="field">
            <label htmlFor="full-name">Full name</label>
            <input id="full-name" name="fullName" autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} required />
          </div>
        ) : null}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </div>
        <div className="field">
          <div className="field-label-row">
            <label htmlFor="password">Password</label>
            {mode === "sign-in" ? <Link href="/forgot-password">Forgot password?</Link> : null}
          </div>
          <div className="password-field">
            <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete={mode === "sign-in" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} required />
            <button className="password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "Hide" : "Show"}</button>
          </div>
        </div>
        {mode === "create-account" ? (
          <div className="field">
            <label htmlFor="confirm-password">Confirm password</label>
            <input id="confirm-password" name="confirmPassword" type={showPassword ? "text" : "password"} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
          </div>
        ) : (
          <label className="remember-choice"><input type="checkbox" checked={rememberSession} onChange={(event) => setRememberSession(event.target.checked)} /> Remember session on this browser</label>
        )}
        <button className="button google-button" type="submit" disabled={isSubmitting || loading}>
          {isSubmitting ? "Please wait..." : mode === "sign-in" ? "Sign In" : "Create Account"}
        </button>
      </form>
      <div className="auth-divider"><span>or</span></div>
      <button className="button-secondary google-button" type="button" onClick={handleGoogleSignIn} disabled={isSubmitting || loading}>
        Continue with Google
      </button>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {success ? <p className="form-success" role="status">{success}</p> : null}
    </section>
  );
}
