import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { getSessionAccess } from "../services/access.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();

const tokenRequestSchema = z.object({
  session_id: z.string().uuid(),
  role: z.enum(["teacher", "student"])
});

router.use(requireAuth);

router.post(
  "/live-token",
  asyncHandler(async (req, res) => {
    const input = tokenRequestSchema.parse(req.body);
    const access = await getSessionAccess(input.session_id, req.user!.id);

    if (!access.exists) {
      return res.status(404).json({ error: "Session not found." });
    }

    if (input.role === "teacher" && !access.isTeacher) {
      return res.status(403).json({ error: "Only the classroom teacher can request a teacher media token." });
    }

    if (input.role === "student" && !access.isMember) {
      return res.status(403).json({ error: "Only enrolled students can request a student media token." });
    }

    return res.status(501).json({
      error: "Live media token generation is not configured yet.",
      media: {
        provider: "livekit",
        session_id: input.session_id,
        role: input.role
      }
    });
  })
);

export default router;
