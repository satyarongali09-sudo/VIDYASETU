import { AuthenticatedShell } from "@/components/authenticated-shell";
import { StudentLiveWorkspace } from "@/components/live-session-workspaces";
import { PageHeader } from "@/components/page-header";

export default function StudentLivePage() {
  return (
    <AuthenticatedShell requiredRole="student">
      <PageHeader
        eyebrow="Student"
        title="Live class"
        description="Watch the teacher stream, answer polls, and submit questions."
      />
      <StudentLiveWorkspace />
    </AuthenticatedShell>
  );
}
