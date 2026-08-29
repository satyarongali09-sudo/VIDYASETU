"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export function JoinClassroomForm() {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setIsSubmitting(true);

    const form = new FormData(event.currentTarget);
    const inviteCode = String(form.get("code") ?? "").trim().toUpperCase();

    try {
      const supabase = createClient();
      const { error: joinError } = await supabase.rpc("join_classroom_by_invite", {
        p_invite_code: inviteCode
      });

      if (joinError) {
        throw joinError;
      }

      router.push("/student/classrooms");
      router.refresh();
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "Unable to join the classroom.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="panel form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="code">Class code</label>
        <input autoCapitalize="characters" id="code" name="code" required />
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <button className="button" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Joining..." : "Join classroom"}
      </button>
    </form>
  );
}
