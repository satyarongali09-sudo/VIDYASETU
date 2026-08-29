import { Router } from "express";
import { z } from "zod";
import { getClassroomAccess, getSessionAccess } from "../services/access.js";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../services/supabase.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();

const sessionIdSchema = z.string().uuid();
const sessionSchema = z.object({
  classroom_id: z.string().uuid(),
  title: z.string().trim().min(2),
  scheduled_at: z.string().datetime().optional()
});
const sessionUpdateSchema = z
  .object({
    title: z.string().trim().min(2).optional(),
    status: z.enum(["scheduled", "live", "ended", "cancelled"]).optional(),
    scheduled_at: z.string().datetime().nullable().optional(),
    started_at: z.string().datetime().nullable().optional(),
    ended_at: z.string().datetime().nullable().optional()
  })
  .refine((input) => Object.keys(input).length > 0, "At least one session field is required.");

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const classroomId = typeof req.query.classroom_id === "string" ? sessionIdSchema.parse(req.query.classroom_id) : undefined;

    if (classroomId) {
      const access = await getClassroomAccess(classroomId, req.user!.id);
      if (!access.exists) {
        return res.status(404).json({ error: "Classroom not found." });
      }
      if (!access.isTeacher && !access.isMember) {
        return res.status(403).json({ error: "You do not have access to this classroom." });
      }

      const { data, error } = await supabaseAdmin
        .from("sessions")
        .select("*")
        .eq("classroom_id", classroomId)
        .order("created_at", { ascending: false });

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      return res.json({ sessions: data ?? [] });
    }

    const [{ data: ownedClasses, error: ownedError }, { data: memberships, error: membershipError }] = await Promise.all([
      supabaseAdmin.from("classrooms").select("id").eq("teacher_id", req.user!.id),
      supabaseAdmin.from("classroom_members").select("classroom_id").eq("student_id", req.user!.id)
    ]);
    const accessError = ownedError ?? membershipError;
    if (accessError) {
      return res.status(400).json({ error: accessError.message });
    }

    const classroomIds = [
      ...(ownedClasses ?? []).map((classroom) => classroom.id),
      ...(memberships ?? []).map((membership) => membership.classroom_id)
    ];
    if (classroomIds.length === 0) {
      return res.json({ sessions: [] });
    }

    const { data, error } = await supabaseAdmin
      .from("sessions")
      .select("*")
      .in("classroom_id", classroomIds)
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ sessions: data ?? [] });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = sessionSchema.parse(req.body);
    const access = await getClassroomAccess(input.classroom_id, req.user!.id);

    if (!access.exists) {
      return res.status(404).json({ error: "Classroom not found." });
    }
    if (!access.isTeacher) {
      return res.status(403).json({ error: "Only the classroom teacher can create sessions." });
    }

    const { data, error } = await supabaseAdmin.from("sessions").insert(input).select("*").single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json({ session: data });
  })
);

router.get(
  "/:sessionId",
  asyncHandler(async (req, res) => {
    const sessionId = sessionIdSchema.parse(req.params.sessionId);
    const access = await getSessionAccess(sessionId, req.user!.id);

    if (!access.exists) {
      return res.status(404).json({ error: "Session not found." });
    }
    if (!access.isTeacher && !access.isMember) {
      return res.status(403).json({ error: "You do not have access to this session." });
    }

    const { data, error } = await supabaseAdmin.from("sessions").select("*").eq("id", sessionId).single();
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ session: data });
  })
);

router.patch(
  "/:sessionId",
  asyncHandler(async (req, res) => {
    const sessionId = sessionIdSchema.parse(req.params.sessionId);
    const access = await getSessionAccess(sessionId, req.user!.id);

    if (!access.exists) {
      return res.status(404).json({ error: "Session not found." });
    }
    if (!access.isTeacher) {
      return res.status(403).json({ error: "Only the classroom teacher can update this session." });
    }

    const input = sessionUpdateSchema.parse(req.body);
    const now = new Date().toISOString();
    if (input.status === "live" && input.started_at === undefined) {
      input.started_at = now;
    }
    if (input.status === "ended" && input.ended_at === undefined) {
      input.ended_at = now;
    }

    const { data, error } = await supabaseAdmin
      .from("sessions")
      .update(input)
      .eq("id", sessionId)
      .select("*")
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ session: data });
  })
);

export default router;
