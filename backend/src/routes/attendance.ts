import { Router } from "express";
import { z } from "zod";
import { getSessionAccess, isClassroomMember } from "../services/access.js";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../services/supabase.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();
const sessionIdSchema = z.string().uuid();
const statusSchema = z.enum(["present", "late", "absent"]);
const attendanceSchema = z.object({
  session_id: sessionIdSchema,
  status: statusSchema.default("present")
});
const teacherAttendanceSchema = z.object({
  status: statusSchema,
  joined_at: z.string().datetime().nullable().optional(),
  left_at: z.string().datetime().nullable().optional(),
  duration_seconds: z.number().int().min(0).optional()
});

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const sessionId = typeof req.query.session_id === "string" ? sessionIdSchema.parse(req.query.session_id) : undefined;
    if (!sessionId) {
      return res.status(400).json({ error: "A session_id query parameter is required." });
    }

    const access = await getSessionAccess(sessionId, req.user!.id);
    if (!access.exists) {
      return res.status(404).json({ error: "Session not found." });
    }
    if (!access.isTeacher && !access.isMember) {
      return res.status(403).json({ error: "You do not have access to this session." });
    }

    let query = supabaseAdmin.from("attendance").select("*").eq("session_id", sessionId).order("created_at");
    if (!access.isTeacher) {
      query = query.eq("student_id", req.user!.id);
    }

    const { data, error } = await query;
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ attendance: data ?? [] });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = attendanceSchema.parse(req.body);
    const access = await getSessionAccess(input.session_id, req.user!.id);

    if (!access.exists) {
      return res.status(404).json({ error: "Session not found." });
    }
    if (!access.isMember) {
      return res.status(403).json({ error: "Only enrolled students can mark attendance." });
    }

    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("attendance")
      .upsert(
        {
          session_id: input.session_id,
          student_id: req.user!.id,
          status: input.status,
          marked_at: now,
          joined_at: now
        },
        { onConflict: "session_id,student_id" }
      )
      .select("*")
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ attendance: data });
  })
);

router.put(
  "/:sessionId/:studentId",
  asyncHandler(async (req, res) => {
    const sessionId = sessionIdSchema.parse(req.params.sessionId);
    const studentId = z.string().uuid().parse(req.params.studentId);
    const access = await getSessionAccess(sessionId, req.user!.id);

    if (!access.exists) {
      return res.status(404).json({ error: "Session not found." });
    }
    if (!access.isTeacher) {
      return res.status(403).json({ error: "Only the classroom teacher can manage attendance." });
    }
    if (!access.classroomId || !(await isClassroomMember(access.classroomId, studentId))) {
      return res.status(400).json({ error: "Attendance can only be managed for enrolled students." });
    }

    const input = teacherAttendanceSchema.parse(req.body);
    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("attendance")
      .upsert(
        {
          ...input,
          session_id: sessionId,
          student_id: studentId,
          marked_at: now,
          joined_at: input.joined_at ?? now
        },
        { onConflict: "session_id,student_id" }
      )
      .select("*")
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ attendance: data });
  })
);

export default router;
