import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { getClassroomAccess } from "../services/access.js";
import { getProfileRole } from "../services/profiles.js";
import { supabaseAdmin } from "../services/supabase.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();

const classroomIdSchema = z.string().uuid();
const createClassroomSchema = z.object({
  name: z.string().trim().min(2),
  subject: z.string().trim().min(2),
  description: z.string().trim().optional()
});
const updateClassroomSchema = createClassroomSchema.partial().refine(
  (input) => Object.keys(input).length > 0,
  "At least one classroom field is required."
);

async function getClassroomDetails(classroomId: string, userId: string) {
  const access = await getClassroomAccess(classroomId, userId);

  if (!access.exists) {
    return { status: 404 as const, body: { error: "Classroom not found." } };
  }
  if (!access.isTeacher && !access.isMember) {
    return { status: 403 as const, body: { error: "You do not have access to this classroom." } };
  }

  const [classroomResult, membershipResult, sessionResult, materialResult] = await Promise.all([
    supabaseAdmin.from("classrooms").select("*").eq("id", classroomId).single(),
    supabaseAdmin.from("classroom_members").select("student_id, joined_at").eq("classroom_id", classroomId).order("joined_at"),
    supabaseAdmin.from("sessions").select("*").eq("classroom_id", classroomId).order("created_at", { ascending: false }),
    supabaseAdmin.from("materials").select("*").eq("classroom_id", classroomId).order("created_at", { ascending: false })
  ]);
  const error = classroomResult.error ?? membershipResult.error ?? sessionResult.error ?? materialResult.error;

  if (error || !classroomResult.data) {
    throw new Error(error?.message ?? "Classroom not found.");
  }

  const classroom = classroomResult.data;
  const memberships = membershipResult.data ?? [];
  const profileIds = [classroom.teacher_id, ...memberships.map((membership) => membership.student_id)];
  const { data: profiles, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email, avatar_url, role")
    .in("id", profileIds);

  if (profileError) {
    throw new Error(profileError.message);
  }

  const profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const { invite_code: inviteCode, ...classroomFields } = classroom;

  return {
    status: 200 as const,
    body: {
      classroom: access.isTeacher ? classroom : classroomFields,
      teacher: profilesById.get(classroom.teacher_id) ?? null,
      members: memberships.map((membership) => ({
        ...membership,
        profile: profilesById.get(membership.student_id) ?? null
      })),
      sessions: sessionResult.data ?? [],
      materials: materialResult.data ?? []
    }
  };
}

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    if ((await getProfileRole(req.user!.id)) !== "teacher") {
      return res.status(403).json({ error: "Only teacher profiles can view owned classrooms." });
    }

    const { data, error } = await supabaseAdmin
      .from("classrooms")
      .select("*")
      .eq("teacher_id", req.user!.id)
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ classrooms: data ?? [] });
  })
);

router.get(
  "/joined",
  asyncHandler(async (req, res) => {
    if ((await getProfileRole(req.user!.id)) !== "student") {
      return res.status(403).json({ error: "Only student profiles can view joined classrooms." });
    }

    const { data: memberships, error: membershipError } = await supabaseAdmin
      .from("classroom_members")
      .select("classroom_id")
      .eq("student_id", req.user!.id);

    if (membershipError) {
      return res.status(400).json({ error: membershipError.message });
    }

    const classroomIds = (memberships ?? []).map((membership) => membership.classroom_id);
    if (classroomIds.length === 0) {
      return res.json({ classrooms: [] });
    }

    const { data, error } = await supabaseAdmin
      .from("classrooms")
      .select("id, teacher_id, name, subject, description, created_at, updated_at")
      .in("id", classroomIds)
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ classrooms: data ?? [] });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    if ((await getProfileRole(req.user!.id)) !== "teacher") {
      return res.status(403).json({ error: "Only teacher profiles can create classrooms." });
    }

    const input = createClassroomSchema.parse(req.body);
    const { data, error } = await supabaseAdmin
      .from("classrooms")
      .insert({ ...input, teacher_id: req.user!.id })
      .select("*")
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json({ classroom: data });
  })
);

router.get(
  "/:classroomId",
  asyncHandler(async (req, res) => {
    const classroomId = classroomIdSchema.parse(req.params.classroomId);
    const result = await getClassroomDetails(classroomId, req.user!.id);
    return res.status(result.status).json(result.body);
  })
);

router.patch(
  "/:classroomId",
  asyncHandler(async (req, res) => {
    const classroomId = classroomIdSchema.parse(req.params.classroomId);
    const access = await getClassroomAccess(classroomId, req.user!.id);

    if (!access.exists) {
      return res.status(404).json({ error: "Classroom not found." });
    }
    if (!access.isTeacher) {
      return res.status(403).json({ error: "Only the classroom teacher can update this classroom." });
    }

    const input = updateClassroomSchema.parse(req.body);
    const { data, error } = await supabaseAdmin
      .from("classrooms")
      .update(input)
      .eq("id", classroomId)
      .select("*")
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ classroom: data });
  })
);

export default router;
