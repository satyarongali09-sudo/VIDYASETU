"use client";

import { useEffect, useState } from "react";
import { ActionPanel } from "@/components/action-panel";
import { ClassroomList } from "@/components/classroom-list";
import { apiFetch } from "@/lib/api/client";
import { getApiAccessToken } from "@/lib/api/session";

type Classroom = {
  id: string;
  name: string;
  subject: string;
  description: string | null;
};

export function StudentClassrooms() {
  const [classrooms, setClassrooms] = useState<Classroom[] | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;

    async function loadClassrooms() {
      try {
        const token = await getApiAccessToken();
        const response = await apiFetch<{ classrooms: Classroom[] }>("/classrooms/joined", { token });
        if (active) {
          setClassrooms(response.classrooms);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load classrooms.");
        }
      }
    }

    void loadClassrooms();
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return <p className="form-error">{error}</p>;
  }

  if (!classrooms) {
    return <p>Loading classrooms...</p>;
  }

  if (classrooms.length === 0) {
    return (
      <ActionPanel
        title="No classes joined"
        description="Enter a class code to join your first classroom."
        primaryHref="/student/join"
        primaryLabel="Join class"
      />
    );
  }

  return <ClassroomList classrooms={classrooms} detailsBasePath="/student/classrooms" />;
}
