import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(8787),
  HOST: z.string().default("127.0.0.1"),
  DB_PATH: z.string().default("./data/lecturn.db"),
  FRONTEND_ORIGIN: z.string().default("http://localhost:5173"),
  ADMIN_USERNAME: z.string().default("admin"),
  ADMIN_PASSWORD: z.string().default("changeme123"),
  COURSES_ROOT: z.string().default("./sample-courses"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
