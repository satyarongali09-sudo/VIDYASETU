import { AuthenticatedShell } from "@/components/authenticated-shell";
import { PageHeader } from "@/components/page-header";
import { StudentClassrooms } from "@/components/student-classrooms";

export default function StudentClassroomsPage() {
  return (
    <AuthenticatedShell requiredRole="student">
      <PageHeader
        eyebrow="Student"
        title="Classrooms"
        description="View enrolled classrooms and available sessions."
      />
      <StudentClassrooms />
    </AuthenticatedShell>
  );
}
