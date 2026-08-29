import { Router } from "express";
import { z } from "zod";
import { getSessionAccess } from "../services/access.js";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../services/supabase.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();
const sessionIdSchema = z.string().uuid();
const questionInputSchema = z
  .object({
    session_id: sessionIdSchema,
    question: z.string().trim().min(2).optional(),
    body: z.string().trim().min(2).optional()
  })
  .refine((input) => input.question || input.body, "A question is required.");
const studentQuestionUpdateSchema = z
  .object({
    question: z.string().trim().min(2).optional(),
    body: z.string().trim().min(2).optional()
  })
  .refine((input) => input.question || input.body, "A question is required.");
const teacherQuestionUpdateSchema = z.object({
  answer: z.string().trim().min(1),
  is_answered: z.literal(true).default(true)
});

async function getQuestionAccess(questionId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("questions")
    .select("id, session_id, student_id, is_answered")
    .eq("id", questionId)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    return { exists: false, isTeacher: false, isMember: false, question: null };
  }

  const sessionAccess = await getSessionAccess(data.session_id, userId);
  return { exists: true, isTeacher: sessionAccess.isTeacher, isMember: sessionAccess.isMember, question: data };
}

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

    let query = supabaseAdmin.from("questions").select("*").eq("session_id", sessionId).order("created_at", { ascending: false });
    if (!access.isTeacher) {
      query = query.eq("student_id", req.user!.id);
    }

    const { data, error } = await query;
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ questions: data ?? [] });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = questionInputSchema.parse(req.body);
    const question = input.question ?? input.body;
    if (!question) {
      return res.status(400).json({ error: "A question is required." });
    }

    const access = await getSessionAccess(input.session_id, req.user!.id);
    if (!access.exists) {
      return res.status(404).json({ error: "Session not found." });
    }
    if (!access.isMember) {
      return res.status(403).json({ error: "Only enrolled students can ask questions." });
    }

    const { data, error } = await supabaseAdmin
      .from("questions")
      .insert({ session_id: input.session_id, question, body: question, student_id: req.user!.id })
      .select("*")
      .single();
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json({ question: data });
  })
);

router.patch(
  "/:questionId",
  asyncHandler(async (req, res) => {
    const questionId = z.string().uuid().parse(req.params.questionId);
    const access = await getQuestionAccess(questionId, req.user!.id);
    if (!access.exists || !access.question) {
      return res.status(404).json({ error: "Question not found." });
    }

    if (access.isTeacher) {
      const input = teacherQuestionUpdateSchema.parse(req.body);
      const { data, error } = await supabaseAdmin
        .from("questions")
        .update({ ...input, answered_by: req.user!.id, answered_at: new Date().toISOString() })
        .eq("id", questionId)
        .select("*")
        .single();
      if (error) {
        return res.status(400).json({ error: error.message });
      }

      return res.json({ question: data });
    }

    if (!access.isMember || access.question.student_id !== req.user!.id || access.question.is_answered) {
      return res.status(403).json({ error: "You can only edit your own unanswered questions." });
    }

    const input = studentQuestionUpdateSchema.parse(req.body);
    const question = input.question ?? input.body;
    if (!question) {
      return res.status(400).json({ error: "A question is required." });
    }

    const { data, error } = await supabaseAdmin
      .from("questions")
      .update({ question, body: question })
      .eq("id", questionId)
      .select("*")
      .single();
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ question: data });
  })
);

export default router;
