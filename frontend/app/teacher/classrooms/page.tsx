import { AuthenticatedShell } from "@/components/authenticated-shell";
import { PageHeader } from "@/components/page-header";
import { TeacherClassrooms } from "@/components/teacher-classrooms";

export default function TeacherClassroomsPage() {
  return (
    <AuthenticatedShell requiredRole="teacher">
      <PageHeader
        eyebrow="Teacher"
        title="Classrooms"
        description="Create, update, and monitor your classrooms."
      />
      <TeacherClassrooms />
    </AuthenticatedShell>
  );
}
