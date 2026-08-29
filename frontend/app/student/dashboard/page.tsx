import { ActionPanel } from "@/components/action-panel";
import { AuthenticatedShell } from "@/components/authenticated-shell";
import { MetricGrid } from "@/components/metric-grid";
import { PageHeader } from "@/components/page-header";

export default function StudentDashboardPage() {
  return (
    <AuthenticatedShell requiredRole="student">
      <PageHeader
        eyebrow="Student"
        title="Student dashboard"
        description="Join classes, enter live sessions, answer polls, and ask questions."
      />
      <MetricGrid
        metrics={[
          { label: "Joined classes", value: "0", detail: "Your enrolled classrooms." },
          { label: "Live now", value: "0", detail: "Sessions ready to join." },
          { label: "Polls answered", value: "0", detail: "Participation history." }
        ]}
      />
      <div className="section-gap">
        <ActionPanel
          title="Join a classroom"
          description="Use an invite code from your teacher."
          primaryHref="/student/join"
          primaryLabel="Join class"
          secondaryHref="/student/live"
          secondaryLabel="Open live room"
        />
      </div>
    </AuthenticatedShell>
  );
}
