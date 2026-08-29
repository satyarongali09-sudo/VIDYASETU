"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api/client";
import { getApiAccessToken } from "@/lib/api/session";

type Session = { id: string; classroom_id: string; title: string; status: string; scheduled_at: string | null };
type Poll = { id: string; question: string; options: string[]; is_active: boolean; selected_option?: string | null };
type Question = { id: string; question: string; body: string; answer: string | null; is_answered: boolean };
type Attendance = { id: string; student_id: string; status: string };
type Classroom = { members: Array<{ student_id: string; profile: { full_name: string } | null }> };

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Not scheduled";
}

function SessionSelector({ sessions, selectedId, onChange }: { sessions: Session[]; selectedId: string; onChange: (value: string) => void }) {
  return (
    <div className="field">
      <label htmlFor="session">Session</label>
      <select id="session" value={selectedId} onChange={(event) => onChange(event.target.value)}>
        <option value="">Choose a session</option>
        {sessions.map((session) => <option key={session.id} value={session.id}>{session.title} · {session.status}</option>)}
      </select>
    </div>
  );
}

function useSessions() {
  const searchParams = useSearchParams();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState<string>();

  useEffect(() => {
    async function load() {
      try {
        const token = await getApiAccessToken();
        const response = await apiFetch<{ sessions: Session[] }>("/sessions", { token });
        setSessions(response.sessions);
        const requestedId = searchParams.get("sessionId");
        setSelectedId(response.sessions.some((session) => session.id === requestedId) ? requestedId ?? "" : response.sessions[0]?.id ?? "");
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load sessions.");
      }
    }
    void load();
  }, [searchParams]);

  return { sessions, selectedId, setSelectedId, error };
}

export function TeacherLiveWorkspace() {
  const { sessions, selectedId, setSelectedId, error: sessionError } = useSessions();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [pollResponses, setPollResponses] = useState<Record<string, string[]>>({});
  const [classroom, setClassroom] = useState<Classroom>();
  const [error, setError] = useState<string>();
  const selectedSession = sessions.find((session) => session.id === selectedId);

  async function refreshSessionData(sessionId = selectedId) {
    if (!sessionId) return;
    try {
      const token = await getApiAccessToken();
      const session = sessions.find((item) => item.id === sessionId);
      const [pollResult, questionResult, attendanceResult, classroomResult] = await Promise.all([
        apiFetch<{ polls: Poll[] }>(`/polls?session_id=${sessionId}`, { token }),
        apiFetch<{ questions: Question[] }>(`/questions?session_id=${sessionId}`, { token }),
        apiFetch<{ attendance: Attendance[] }>(`/attendance?session_id=${sessionId}`, { token }),
        session ? apiFetch<Classroom>(`/classrooms/${session.classroom_id}`, { token }) : Promise.resolve(undefined)
      ]);
      setPolls(pollResult.polls);
      setQuestions(questionResult.questions);
      setAttendance(attendanceResult.attendance);
      setClassroom(classroomResult);
      const responseEntries = await Promise.all(
        pollResult.polls.map(async (poll) => {
          const response = await apiFetch<{ responses: Array<{ selected_option: string }> }>(`/polls/${poll.id}/responses`, { token });
          return [poll.id, response.responses.map((item) => item.selected_option)] as const;
        })
      );
      setPollResponses(Object.fromEntries(responseEntries));
      setError(undefined);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load this session.");
    }
  }

  useEffect(() => { void refreshSessionData(); }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function updateSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId) return;
    const form = new FormData(event.currentTarget);
    try {
      const token = await getApiAccessToken();
      await apiFetch(`/sessions/${selectedId}`, { method: "PATCH", token, body: JSON.stringify({ status: form.get("status") }) });
      await refreshSessionData();
    } catch (updateError) { setError(updateError instanceof Error ? updateError.message : "Unable to update the session."); }
  }

  async function createPoll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId) return;
    const form = new FormData(event.currentTarget);
    const options = String(form.get("options") ?? "").split(/[\n,]/).map((option) => option.trim()).filter(Boolean);
    try {
      const token = await getApiAccessToken();
      await apiFetch("/polls", { method: "POST", token, body: JSON.stringify({ session_id: selectedId, question: form.get("question"), options }) });
      event.currentTarget.reset();
      await refreshSessionData();
    } catch (createError) { setError(createError instanceof Error ? createError.message : "Unable to create the poll."); }
  }

  async function closePoll(pollId: string) {
    try {
      const token = await getApiAccessToken();
      await apiFetch(`/polls/${pollId}`, { method: "PATCH", token, body: JSON.stringify({ is_active: false }) });
      await refreshSessionData();
    } catch (closeError) { setError(closeError instanceof Error ? closeError.message : "Unable to close the poll."); }
  }

  async function answerQuestion(event: FormEvent<HTMLFormElement>, questionId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const token = await getApiAccessToken();
      await apiFetch(`/questions/${questionId}`, { method: "PATCH", token, body: JSON.stringify({ answer: form.get("answer"), is_answered: true }) });
      event.currentTarget.reset();
      await refreshSessionData();
    } catch (answerError) { setError(answerError instanceof Error ? answerError.message : "Unable to answer the question."); }
  }

  async function markAttendance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId) return;
    const form = new FormData(event.currentTarget);
    const studentId = String(form.get("student_id") ?? "");
    try {
      const token = await getApiAccessToken();
      await apiFetch(`/attendance/${selectedId}/${studentId}`, { method: "PUT", token, body: JSON.stringify({ status: form.get("status") }) });
      await refreshSessionData();
    } catch (attendanceError) { setError(attendanceError instanceof Error ? attendanceError.message : "Unable to record attendance."); }
  }

  if (sessionError) return <p className="form-error">{sessionError}</p>;
  return (
    <section className="grid">
      <article className="card"><h2>Session control</h2><SessionSelector sessions={sessions} selectedId={selectedId} onChange={setSelectedId} />{selectedSession ? <p>{formatDate(selectedSession.scheduled_at)}</p> : <p>Create a session from its classroom details page.</p>}
        {selectedId ? <form className="form" onSubmit={updateSession}><div className="field"><label htmlFor="status">Status</label><select defaultValue={selectedSession?.status} id="status" name="status"><option value="scheduled">Scheduled</option><option value="live">Live</option><option value="ended">Ended</option><option value="cancelled">Cancelled</option></select></div><button className="button" type="submit">Update session</button></form> : null}
      </article>
      <article className="card"><h2>Create poll</h2>{selectedId ? <form className="form" onSubmit={createPoll}><div className="field"><label htmlFor="poll-question">Question</label><input id="poll-question" name="question" required /></div><div className="field"><label htmlFor="poll-options">Options</label><textarea id="poll-options" name="options" placeholder="One option per line" required rows={3} /></div><button className="button" type="submit">Create poll</button></form> : <p>Select a session first.</p>}</article>
      <article className="card"><h2>Polls</h2>{polls.length ? polls.map((poll) => <div key={poll.id}><p>{poll.question}</p><p>{poll.is_active ? "Active" : "Closed"}</p><p>Responses: {pollResponses[poll.id]?.length ?? 0}{pollResponses[poll.id]?.length ? ` · ${pollResponses[poll.id].join(", ")}` : ""}</p>{poll.is_active ? <button className="button-secondary" onClick={() => void closePoll(poll.id)} type="button">Close poll</button> : null}</div>) : <p>No polls for this session.</p>}</article>
      <article className="card"><h2>Questions</h2>{questions.length ? questions.map((question) => <div key={question.id}><p>{question.question || question.body}</p>{question.answer ? <p>Answer: {question.answer}</p> : <form className="form" onSubmit={(event) => void answerQuestion(event, question.id)}><div className="field"><label htmlFor={`answer-${question.id}`}>Answer</label><textarea id={`answer-${question.id}`} name="answer" required rows={2} /></div><button className="button-secondary" type="submit">Answer</button></form>}</div>) : <p>No student questions yet.</p>}</article>
      <article className="card"><h2>Attendance</h2>{selectedId && classroom?.members.length ? <form className="form" onSubmit={markAttendance}><div className="field"><label htmlFor="student-id">Student</label><select id="student-id" name="student_id">{classroom.members.map((member) => <option key={member.student_id} value={member.student_id}>{member.profile?.full_name ?? "Student"}</option>)}</select></div><div className="field"><label htmlFor="attendance-status">Status</label><select id="attendance-status" name="status"><option value="present">Present</option><option value="late">Late</option><option value="absent">Absent</option></select></div><button className="button" type="submit">Record attendance</button></form> : <p>Select a session with enrolled students.</p>}<p>Recorded: {attendance.length}</p></article>
      {error ? <p className="form-error">{error}</p> : null}
    </section>
  );
}

export function StudentLiveWorkspace() {
  const { sessions, selectedId, setSelectedId, error: sessionError } = useSessions();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [error, setError] = useState<string>();

  async function refreshSessionData(sessionId = selectedId) {
    if (!sessionId) return;
    try {
      const token = await getApiAccessToken();
      const [pollResult, questionResult, attendanceResult] = await Promise.all([
        apiFetch<{ polls: Poll[] }>(`/polls?session_id=${sessionId}`, { token }),
        apiFetch<{ questions: Question[] }>(`/questions?session_id=${sessionId}`, { token }),
        apiFetch<{ attendance: Attendance[] }>(`/attendance?session_id=${sessionId}`, { token })
      ]);
      setPolls(pollResult.polls);
      setQuestions(questionResult.questions);
      setAttendance(attendanceResult.attendance);
      setError(undefined);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Unable to load this session."); }
  }

  useEffect(() => { void refreshSessionData(); }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submitResponse(pollId: string, selectedOption: string) {
    try {
      const token = await getApiAccessToken();
      await apiFetch(`/polls/${pollId}/responses`, { method: "POST", token, body: JSON.stringify({ selected_option: selectedOption }) });
      await refreshSessionData();
    } catch (responseError) { setError(responseError instanceof Error ? responseError.message : "Unable to submit your response."); }
  }

  async function askQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId) return;
    const form = new FormData(event.currentTarget);
    try {
      const token = await getApiAccessToken();
      await apiFetch("/questions", { method: "POST", token, body: JSON.stringify({ session_id: selectedId, question: form.get("question") }) });
      event.currentTarget.reset();
      await refreshSessionData();
    } catch (questionError) { setError(questionError instanceof Error ? questionError.message : "Unable to submit your question."); }
  }

  async function updateQuestion(event: FormEvent<HTMLFormElement>, questionId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const token = await getApiAccessToken();
      await apiFetch(`/questions/${questionId}`, { method: "PATCH", token, body: JSON.stringify({ question: form.get("question") }) });
      await refreshSessionData();
    } catch (questionError) { setError(questionError instanceof Error ? questionError.message : "Unable to update your question."); }
  }

  async function markAttendance() {
    if (!selectedId) return;
    try {
      const token = await getApiAccessToken();
      await apiFetch("/attendance", { method: "POST", token, body: JSON.stringify({ session_id: selectedId, status: "present" }) });
      await refreshSessionData();
    } catch (attendanceError) { setError(attendanceError instanceof Error ? attendanceError.message : "Unable to mark attendance."); }
  }

  if (sessionError) return <p className="form-error">{sessionError}</p>;
  return (
    <section className="grid">
      <article className="card"><h2>Class session</h2><SessionSelector sessions={sessions} selectedId={selectedId} onChange={setSelectedId} /><button className="button" disabled={!selectedId} onClick={() => void markAttendance()} type="button">Mark present</button><p>{attendance.length ? `Attendance: ${attendance[0]?.status}` : "Attendance not recorded"}</p></article>
      <article className="card"><h2>Current polls</h2>{polls.length ? polls.map((poll) => <div key={poll.id}><p>{poll.question}</p>{poll.selected_option ? <p>Your answer: {poll.selected_option}</p> : poll.is_active ? <div className="actions">{poll.options.map((option) => <button className="button-secondary" key={option} onClick={() => void submitResponse(poll.id, option)} type="button">{option}</button>)}</div> : <p>Poll closed</p>}</div>) : <p>No polls for this session.</p>}</article>
      <article className="card"><h2>Ask a question</h2>{selectedId ? <form className="form" onSubmit={askQuestion}><div className="field"><label htmlFor="student-question">Question</label><textarea id="student-question" name="question" required rows={3} /></div><button className="button" type="submit">Submit question</button></form> : <p>Select a session first.</p>}</article>
      <article className="card"><h2>Your questions</h2>{questions.length ? questions.map((question) => <div key={question.id}>{question.answer ? <><p>{question.question || question.body}</p><p>Answer: {question.answer}</p></> : <form className="form" onSubmit={(event) => void updateQuestion(event, question.id)}><div className="field"><label htmlFor={`question-${question.id}`}>Question</label><textarea defaultValue={question.question || question.body} id={`question-${question.id}`} name="question" required rows={2} /></div><button className="button-secondary" type="submit">Update question</button></form>}</div>) : <p>No questions submitted.</p>}</article>
      {error ? <p className="form-error">{error}</p> : null}
    </section>
  );
}
