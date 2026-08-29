import { AuthenticatedShell } from "@/components/authenticated-shell";
import { StudentClassroomDetails } from "@/components/classroom-details";
import { PageHeader } from "@/components/page-header";

export default async function StudentClassroomDetailsPage({ params }: { params: Promise<{ classroomId: string }> }) {
  const { classroomId } = await params;
  return (
    <AuthenticatedShell requiredRole="student">
      <PageHeader eyebrow="Student" title="Classroom details" description="Review your teacher, classmates, schedule, and materials." />
      <StudentClassroomDetails classroomId={classroomId} />
    </AuthenticatedShell>
  );
}
