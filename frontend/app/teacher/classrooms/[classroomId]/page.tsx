import { AuthenticatedShell } from "@/components/authenticated-shell";
import { TeacherClassroomDetails } from "@/components/classroom-details";
import { PageHeader } from "@/components/page-header";

export default async function TeacherClassroomDetailsPage({ params }: { params: Promise<{ classroomId: string }> }) {
  const { classroomId } = await params;
  return (
    <AuthenticatedShell requiredRole="teacher">
      <PageHeader eyebrow="Teacher" title="Classroom details" description="Manage students, sessions, invite access, and learning materials." />
      <TeacherClassroomDetails classroomId={classroomId} />
    </AuthenticatedShell>
  );
}
