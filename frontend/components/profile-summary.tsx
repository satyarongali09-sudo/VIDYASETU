"use client";

import { useAuth } from "@/components/auth-provider";

export function ProfileSummary() {
  const { profile, user } = useAuth();

  return (
    <section className="panel profile-summary">
      <div><span className="eyebrow">Account</span><h2>{profile?.full_name ?? user?.user_metadata.full_name ?? "VIDYASETU user"}</h2></div>
      <dl>
        <div><dt>Email</dt><dd>{profile?.email ?? user?.email ?? "Not available"}</dd></div>
        <div><dt>Role</dt><dd>{profile?.role === "teacher" ? "Teacher" : "Student"}</dd></div>
      </dl>
    </section>
  );
}
