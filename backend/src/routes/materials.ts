import { Router } from "express";
import { z } from "zod";
import { getClassroomAccess } from "../services/access.js";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../services/supabase.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();
const classroomIdSchema = z.string().uuid();
const materialSchema = z.object({
  classroom_id: classroomIdSchema,
  title: z.string().trim().min(2),
  description: z.string().trim().optional(),
  file_url: z.string().url(),
  file_type: z.string().trim().min(1),
  file_size: z.number().int().min(0)
});
const materialUpdateSchema = materialSchema.omit({ classroom_id: true }).partial().refine(
  (input) => Object.keys(input).length > 0,
  "At least one material field is required."
);

async function getMaterialAccess(materialId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("materials")
    .select("id, classroom_id, uploaded_by")
    .eq("id", materialId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    return { exists: false, isTeacher: false, material: null };
  }

  const classroomAccess = await getClassroomAccess(data.classroom_id, userId);
  return { exists: true, isTeacher: classroomAccess.isTeacher, material: data };
}

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const classroomId = typeof req.query.classroom_id === "string" ? classroomIdSchema.parse(req.query.classroom_id) : undefined;
    if (!classroomId) {
      return res.status(400).json({ error: "A classroom_id query parameter is required." });
    }

    const access = await getClassroomAccess(classroomId, req.user!.id);
    if (!access.exists) {
      return res.status(404).json({ error: "Classroom not found." });
    }
    if (!access.isTeacher && !access.isMember) {
      return res.status(403).json({ error: "You do not have access to this classroom." });
    }

    const { data, error } = await supabaseAdmin
      .from("materials")
      .select("*")
      .eq("classroom_id", classroomId)
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ materials: data ?? [] });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = materialSchema.parse(req.body);
    const access = await getClassroomAccess(input.classroom_id, req.user!.id);

    if (!access.exists) {
      return res.status(404).json({ error: "Classroom not found." });
    }
    if (!access.isTeacher) {
      return res.status(403).json({ error: "Only the classroom teacher can add materials." });
    }

    const { data, error } = await supabaseAdmin
      .from("materials")
      .insert({ ...input, uploaded_by: req.user!.id })
      .select("*")
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json({ material: data });
  })
);

router.patch(
  "/:materialId",
  asyncHandler(async (req, res) => {
    const materialId = z.string().uuid().parse(req.params.materialId);
    const materialAccess = await getMaterialAccess(materialId, req.user!.id);

    if (!materialAccess.exists) {
      return res.status(404).json({ error: "Material not found." });
    }
    if (!materialAccess.isTeacher) {
      return res.status(403).json({ error: "Only the classroom teacher can update materials." });
    }

    const input = materialUpdateSchema.parse(req.body);
    const { data, error } = await supabaseAdmin
      .from("materials")
      .update(input)
      .eq("id", materialId)
      .select("*")
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ material: data });
  })
);

router.delete(
  "/:materialId",
  asyncHandler(async (req, res) => {
    const materialId = z.string().uuid().parse(req.params.materialId);
    const materialAccess = await getMaterialAccess(materialId, req.user!.id);

    if (!materialAccess.exists) {
      return res.status(404).json({ error: "Material not found." });
    }
    if (!materialAccess.isTeacher) {
      return res.status(403).json({ error: "Only the classroom teacher can remove materials." });
    }

    const { error } = await supabaseAdmin.from("materials").delete().eq("id", materialId);
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(204).send();
  })
);

export default router;
