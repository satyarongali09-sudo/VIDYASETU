"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api/client";
import { getApiAccessToken } from "@/lib/api/session";

export function CreateClassroomForm() {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setIsSubmitting(true);

    const form = new FormData(event.currentTarget);

    try {
      const token = await getApiAccessToken();
      await apiFetch("/classrooms", {
        method: "POST",
        token,
        body: JSON.stringify({
          name: String(form.get("name") ?? "").trim(),
          subject: String(form.get("subject") ?? "").trim(),
          description: String(form.get("description") ?? "").trim() || undefined
        })
      });
      router.push("/teacher/classrooms");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create the classroom.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="panel form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="name">Class name</label>
        <input id="name" name="name" required />
      </div>
      <div className="field">
        <label htmlFor="subject">Subject</label>
        <input id="subject" name="subject" required />
      </div>
      <div className="field">
        <label htmlFor="description">Description</label>
        <textarea id="description" name="description" rows={4} />
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <button className="button" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Saving..." : "Save classroom"}
      </button>
    </form>
  );
}
