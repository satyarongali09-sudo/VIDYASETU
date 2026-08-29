import { ActionPanel } from "@/components/action-panel";
import { AuthenticatedShell } from "@/components/authenticated-shell";
import { MetricGrid } from "@/components/metric-grid";
import { PageHeader } from "@/components/page-header";

export default function DashboardPage() {
  return (
    <AuthenticatedShell redirectToRoleDashboard>
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description="A role-aware starting point for classes, live sessions, and student activity."
      />
      <MetricGrid
        metrics={[
          { label: "Active classes", value: "0", detail: "Create or join a classroom to begin." },
          { label: "Live sessions", value: "0", detail: "Upcoming and active sessions appear here." },
          { label: "Questions", value: "0", detail: "Open classroom questions will be tracked here." }
        ]}
      />
      <div className="section-gap">
        <ActionPanel
          title="Choose workspace"
          description="Continue as a teacher or student."
          primaryHref="/teacher/dashboard"
          primaryLabel="Teacher"
          secondaryHref="/student/dashboard"
          secondaryLabel="Student"
        />
      </div>
    </AuthenticatedShell>
  );
}
