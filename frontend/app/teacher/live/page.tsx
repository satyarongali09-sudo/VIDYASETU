import { AuthenticatedShell } from "@/components/authenticated-shell";
import { TeacherLiveWorkspace } from "@/components/live-session-workspaces";
import { PageHeader } from "@/components/page-header";

export default function TeacherLivePage() {
  return (
    <AuthenticatedShell requiredRole="teacher">
      <PageHeader
        eyebrow="Teacher"
        title="Live room"
        description="Run a class session with slides, audio, polls, Q&A, and attendance."
      />
      <TeacherLiveWorkspace />
    </AuthenticatedShell>
  );
}
