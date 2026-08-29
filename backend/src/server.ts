import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { supabaseAdmin } from "./services/supabase.js";
import attendanceRoutes from "./routes/attendance.js";
import classroomRoutes from "./routes/classrooms.js";
import materialRoutes from "./routes/materials.js";
import mediaRoutes from "./routes/media.js";
import pollRoutes from "./routes/polls.js";
import questionRoutes from "./routes/questions.js";
import sessionRoutes from "./routes/sessions.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("tiny"));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "vidyasetu-api" });
});

app.get("/health/supabase", async (_req, res) => {
  const { error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });

  if (error) {
    return res.status(503).json({ ok: false, service: "vidyasetu-api", supabase: "unavailable" });
  }

  return res.json({ ok: true, service: "vidyasetu-api", supabase: "connected" });
});

app.use("/classrooms", classroomRoutes);
app.use("/sessions", sessionRoutes);
app.use("/materials", materialRoutes);
app.use("/polls", pollRoutes);
app.use("/questions", questionRoutes);
app.use("/attendance", attendanceRoutes);
app.use("/media", mediaRoutes);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : "Unexpected server error.";
  res.status(500).json({ error: message });
});

if (process.env.NODE_ENV !== "test") {
  app.listen(env.PORT, () => {
    console.log(`VIDYASETU API listening on port ${env.PORT}`);
  });
}

export default app;
