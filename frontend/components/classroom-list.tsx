type Classroom = {
  id: string;
  name: string;
  subject: string;
  description: string | null;
  invite_code?: string;
};

type ClassroomListProps = {
  classrooms: Classroom[];
  showInviteCode?: boolean;
  detailsBasePath?: string;
};

export function ClassroomList({ classrooms, showInviteCode = false, detailsBasePath }: ClassroomListProps) {
  return (
    <div className="grid">
      {classrooms.map((classroom) => (
        <article className="card" key={classroom.id}>
          <p className="eyebrow">{classroom.subject}</p>
          <h2>{classroom.name}</h2>
          {classroom.description ? <p>{classroom.description}</p> : null}
          {showInviteCode && classroom.invite_code ? <p>Invite code: {classroom.invite_code}</p> : null}
          {detailsBasePath ? (
            <Link className="button-secondary" href={`${detailsBasePath}/${classroom.id}`}>
              Open classroom
            </Link>
          ) : null}
        </article>
      ))}
    </div>
  );
}
import Link from "next/link";
