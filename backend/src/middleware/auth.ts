import type { NextFunction, Request, Response } from "express";
import { supabaseAdmin } from "../services/supabase.js";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
      };
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing bearer token." });
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    return res.status(401).json({ error: "Invalid session." });
  }

  req.user = {
    id: data.user.id,
    email: data.user.email ?? undefined
  };

  return next();
}
