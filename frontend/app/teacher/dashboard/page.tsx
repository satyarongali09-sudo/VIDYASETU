import { ActionPanel } from "@/components/action-panel";
import { AuthenticatedShell } from "@/components/authenticated-shell";
import { MetricGrid } from "@/components/metric-grid";
import { PageHeader } from "@/components/page-header";

export default function TeacherDashboardPage() {
  return (
    <AuthenticatedShell requiredRole="teacher">
      <PageHeader
        eyebrow="Teacher"
        title="Teacher dashboard"
        description="Manage classrooms, prepare live sessions, and review participation."
      />
      <MetricGrid
        metrics={[
          { label: "Classrooms", value: "0", detail: "Owned classrooms will be listed here." },
          { label: "Students", value: "0", detail: "Enrollment totals across your classes." },
          { label: "Attendance", value: "0%", detail: "Session attendance summary." }
        ]}
      />
      <div className="section-gap">
        <ActionPanel
          title="Create a classroom"
          description="Set up a class, invite students, and start a live session."
          primaryHref="/teacher/create-class"
          primaryLabel="Create class"
          secondaryHref="/teacher/live"
          secondaryLabel="Open live room"
        />
      </div>
    </AuthenticatedShell>
  );
}
