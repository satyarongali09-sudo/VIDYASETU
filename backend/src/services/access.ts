import { supabaseAdmin } from "./supabase.js";

export async function getClassroomAccess(classroomId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("classrooms")
    .select("id, teacher_id")
    .eq("id", classroomId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return { exists: false, isTeacher: false, isMember: false };
  }

  return {
    exists: true,
    isTeacher: data.teacher_id === userId,
    isMember: await isClassroomMember(classroomId, userId)
  };
}

export async function isClassroomTeacher(classroomId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("classrooms")
    .select("id")
    .eq("id", classroomId)
    .eq("teacher_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

export async function isClassroomMember(classroomId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("classroom_members")
    .select("classroom_id")
    .eq("classroom_id", classroomId)
    .eq("student_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

export async function getSessionAccess(sessionId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("sessions")
    .select("id, classroom_id, classrooms!inner(teacher_id)")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return { exists: false, isTeacher: false, isMember: false };
  }

  const classroomAccess = await getClassroomAccess(data.classroom_id, userId);

  return {
    exists: true,
    classroomId: data.classroom_id,
    isTeacher: classroomAccess.isTeacher,
    isMember: classroomAccess.isMember
  };
}
