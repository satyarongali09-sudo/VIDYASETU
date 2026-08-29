"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/api/client";
import { getApiAccessToken } from "@/lib/api/session";

type ClassroomDetails = {
  classroom: {
    id: string;
    name: string;
    subject: string;
    description: string | null;
    invite_code?: string;
  };
  teacher: { full_name: string; email: string | null } | null;
  members: Array<{ student_id: string; joined_at: string; profile: { full_name: string; email: string | null } | null }>;
  sessions: Array<{ id: string; title: string; status: string; scheduled_at: string | null }>;
  materials: Array<{ id: string; title: string; description: string | null; file_url: string; file_type: string; file_size: number }>;
};

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Not scheduled";
}

function useClassroomDetails(classroomId: string) {
  const [details, setDetails] = useState<ClassroomDetails>();
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    try {
      const token = await getApiAccessToken();
      const response = await apiFetch<ClassroomDetails>(`/classrooms/${classroomId}`, { token });
      setDetails(response);
      setError(undefined);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load this classroom.");
    }
  }, [classroomId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { details, error, refresh };
}

function ClassroomOverview({ details, liveBasePath }: { details: ClassroomDetails; liveBasePath: string }) {
  return (
    <section className="grid">
      <article className="card">
        <p className="eyebrow">{details.classroom.subject}</p>
        <h2>{details.classroom.name}</h2>
        {details.classroom.description ? <p>{details.classroom.description}</p> : null}
        <p>Teacher: {details.teacher?.full_name ?? "Unavailable"}</p>
        {details.classroom.invite_code ? <p>Invite code: {details.classroom.invite_code}</p> : null}
      </article>
      <article className="card">
        <h2>Students</h2>
        {details.members.length ? (
          details.members.map((member) => <p key={member.student_id}>{member.profile?.full_name ?? "Student"}</p>)
        ) : (
          <p>No students have joined yet.</p>
        )}
      </article>
      <article className="card">
        <h2>Sessions</h2>
        {details.sessions.length ? (
          details.sessions.map((session) => (
            <div key={session.id}>
              <p>{session.title}</p>
              <p>{session.status} · {formatDate(session.scheduled_at)}</p>
              <Link className="button-secondary" href={`${liveBasePath}?sessionId=${session.id}`}>
                Open session
              </Link>
            </div>
          ))
        ) : (
          <p>No sessions are scheduled.</p>
        )}
      </article>
      <article className="card">
        <h2>Materials</h2>
        {details.materials.length ? (
          details.materials.map((material) => (
            <div key={material.id}>
              <p>{material.title}</p>
              {material.description ? <p>{material.description}</p> : null}
              <a className="button-secondary" href={material.file_url} rel="noreferrer" target="_blank">
                Open material
              </a>
            </div>
          ))
        ) : (
          <p>No materials have been added.</p>
        )}
      </article>
    </section>
  );
}

function CreateSessionForm({ classroomId, onCreated }: { classroomId: string; onCreated: () => Promise<void> }) {
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(undefined);
    const form = new FormData(event.currentTarget);

    try {
      const token = await getApiAccessToken();
      const scheduledAt = String(form.get("scheduled_at") ?? "");
      await apiFetch("/sessions", {
        method: "POST",
        token,
        body: JSON.stringify({
          classroom_id: classroomId,
          title: String(form.get("title") ?? "").trim(),
          scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : undefined
        })
      });
      event.currentTarget.reset();
      await onCreated();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create the session.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="panel form" onSubmit={submit}>
      <h2>Schedule session</h2>
      <div className="field"><label htmlFor="title">Title</label><input id="title" name="title" required /></div>
      <div className="field"><label htmlFor="scheduled_at">Start time</label><input id="scheduled_at" name="scheduled_at" type="datetime-local" /></div>
      {error ? <p className="form-error">{error}</p> : null}
      <button className="button" disabled={submitting} type="submit">{submitting ? "Scheduling..." : "Schedule session"}</button>
    </form>
  );
}

function MaterialManager({ classroomId, details, onChanged }: { classroomId: string; details: ClassroomDetails; onChanged: () => Promise<void> }) {
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(undefined);
    const form = new FormData(event.currentTarget);

    try {
      const token = await getApiAccessToken();
      await apiFetch("/materials", {
        method: "POST",
        token,
        body: JSON.stringify({
          classroom_id: classroomId,
          title: String(form.get("title") ?? "").trim(),
          description: String(form.get("description") ?? "").trim() || undefined,
          file_url: String(form.get("file_url") ?? "").trim(),
          file_type: String(form.get("file_type") ?? "").trim(),
          file_size: Number(form.get("file_size") ?? 0)
        })
      });
      event.currentTarget.reset();
      await onChanged();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to add the material.");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(materialId: string) {
    setError(undefined);
    try {
      const token = await getApiAccessToken();
      await apiFetch(`/materials/${materialId}`, { method: "DELETE", token });
      await onChanged();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Unable to remove the material.");
    }
  }

  return (
    <section className="section-gap">
      <form className="panel form" onSubmit={submit}>
        <h2>Add material</h2>
        <div className="field"><label htmlFor="material-title">Title</label><input id="material-title" name="title" required /></div>
        <div className="field"><label htmlFor="material-url">File URL</label><input id="material-url" name="file_url" type="url" required /></div>
        <div className="field"><label htmlFor="material-type">File type</label><input id="material-type" name="file_type" required /></div>
        <div className="field"><label htmlFor="material-size">File size (bytes)</label><input id="material-size" min="0" name="file_size" type="number" required /></div>
        <div className="field"><label htmlFor="material-description">Description</label><textarea id="material-description" name="description" rows={3} /></div>
        {error ? <p className="form-error">{error}</p> : null}
        <button className="button" disabled={submitting} type="submit">{submitting ? "Adding..." : "Add material"}</button>
      </form>
      {details.materials.length ? (
        <div className="section-gap actions">
          {details.materials.map((material) => (
            <button className="button-secondary" key={material.id} onClick={() => void remove(material.id)} type="button">
              Remove {material.title}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function TeacherClassroomDetails({ classroomId }: { classroomId: string }) {
  const { details, error, refresh } = useClassroomDetails(classroomId);
  if (error) return <p className="form-error">{error}</p>;
  if (!details) return <p>Loading classroom...</p>;

  return (
    <>
      <ClassroomOverview details={details} liveBasePath="/teacher/live" />
      <div className="section-gap"><CreateSessionForm classroomId={classroomId} onCreated={refresh} /></div>
      <MaterialManager classroomId={classroomId} details={details} onChanged={refresh} />
    </>
  );
}

export function StudentClassroomDetails({ classroomId }: { classroomId: string }) {
  const { details, error } = useClassroomDetails(classroomId);
  if (error) return <p className="form-error">{error}</p>;
  if (!details) return <p>Loading classroom...</p>;
  return <ClassroomOverview details={details} liveBasePath="/student/live" />;
}
