import { Router } from "express";
import { z } from "zod";
import { getSessionAccess } from "../services/access.js";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../services/supabase.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();
const sessionIdSchema = z.string().uuid();
const pollSchema = z.object({
  session_id: sessionIdSchema,
  question: z.string().trim().min(2),
  options: z.array(z.string().trim().min(1)).min(2)
});
const pollUpdateSchema = z
  .object({
    question: z.string().trim().min(2).optional(),
    options: z.array(z.string().trim().min(1)).min(2).optional(),
    is_active: z.boolean().optional()
  })
  .refine((input) => Object.keys(input).length > 0, "At least one poll field is required.");

async function getPollAccess(pollId: string, userId: string) {
  const { data, error } = await supabaseAdmin.from("polls").select("id, session_id, options, is_active").eq("id", pollId).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    return { exists: false, isTeacher: false, isMember: false, poll: null };
  }

  const sessionAccess = await getSessionAccess(data.session_id, userId);
  return { exists: true, isTeacher: sessionAccess.isTeacher, isMember: sessionAccess.isMember, poll: data };
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

    const { data: polls, error } = await supabaseAdmin
      .from("polls")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false });
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (access.isTeacher) {
      return res.json({ polls: polls ?? [] });
    }

    const pollIds = (polls ?? []).map((poll) => poll.id);
    const { data: responses, error: responseError } = pollIds.length
      ? await supabaseAdmin.from("poll_responses").select("poll_id, selected_option").in("poll_id", pollIds).eq("student_id", req.user!.id)
      : { data: [], error: null };
    if (responseError) {
      return res.status(400).json({ error: responseError.message });
    }

    const responseByPoll = new Map((responses ?? []).map((response) => [response.poll_id, response.selected_option]));
    return res.json({
      polls: (polls ?? []).map((poll) => ({ ...poll, selected_option: responseByPoll.get(poll.id) ?? null }))
    });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = pollSchema.parse(req.body);
    const access = await getSessionAccess(input.session_id, req.user!.id);
    if (!access.exists) {
      return res.status(404).json({ error: "Session not found." });
    }
    if (!access.isTeacher) {
      return res.status(403).json({ error: "Only the classroom teacher can create polls." });
    }

    const { data, error } = await supabaseAdmin.from("polls").insert(input).select("*").single();
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json({ poll: data });
  })
);

router.patch(
  "/:pollId",
  asyncHandler(async (req, res) => {
    const pollId = z.string().uuid().parse(req.params.pollId);
    const access = await getPollAccess(pollId, req.user!.id);
    if (!access.exists) {
      return res.status(404).json({ error: "Poll not found." });
    }
    if (!access.isTeacher) {
      return res.status(403).json({ error: "Only the classroom teacher can update polls." });
    }

    const input = pollUpdateSchema.parse(req.body);
    const { data, error } = await supabaseAdmin.from("polls").update(input).eq("id", pollId).select("*").single();
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ poll: data });
  })
);

router.post(
  "/:pollId/responses",
  asyncHandler(async (req, res) => {
    const pollId = z.string().uuid().parse(req.params.pollId);
    const selectedOption = z.object({ selected_option: z.string().trim().min(1) }).parse(req.body).selected_option;
    const access = await getPollAccess(pollId, req.user!.id);
    if (!access.exists || !access.poll) {
      return res.status(404).json({ error: "Poll not found." });
    }
    if (!access.isMember) {
      return res.status(403).json({ error: "Only enrolled students can answer polls." });
    }
    if (!access.poll.is_active) {
      return res.status(409).json({ error: "This poll is no longer active." });
    }

    const options = Array.isArray(access.poll.options) ? access.poll.options : [];
    if (!options.includes(selectedOption)) {
      return res.status(400).json({ error: "The selected option is not valid for this poll." });
    }

    const { data, error } = await supabaseAdmin
      .from("poll_responses")
      .insert({ poll_id: pollId, student_id: req.user!.id, selected_option: selectedOption })
      .select("*")
      .single();
    if (error) {
      return res.status(error.code === "23505" ? 409 : 400).json({
        error: error.code === "23505" ? "You have already answered this poll." : error.message
      });
    }

    return res.status(201).json({ response: data });
  })
);

router.get(
  "/:pollId/responses",
  asyncHandler(async (req, res) => {
    const pollId = z.string().uuid().parse(req.params.pollId);
    const access = await getPollAccess(pollId, req.user!.id);
    if (!access.exists) {
      return res.status(404).json({ error: "Poll not found." });
    }
    if (!access.isTeacher) {
      return res.status(403).json({ error: "Only the classroom teacher can view poll responses." });
    }

    const { data, error } = await supabaseAdmin
      .from("poll_responses")
      .select("*")
      .eq("poll_id", pollId)
      .order("created_at");
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ responses: data ?? [] });
  })
);

export default router;
