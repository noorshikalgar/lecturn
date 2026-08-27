import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(8787),
  HOST: z.string().default("127.0.0.1"),
  DB_PATH: z.string().default("./data/lecturn.db"),
  // A blank value here would otherwise silently produce a CORS allow-list of
  // [""] — no origin would ever match, but the failure would look like a
  // generic network error instead of a clear startup config problem.
  FRONTEND_ORIGIN: z.string().min(1, "FRONTEND_ORIGIN must not be empty").default("http://localhost:5173"),
  ADMIN_USERNAME: z.string().default("admin"),
  ADMIN_PASSWORD: z.string().default("changeme123"),
  // Independent of NODE_ENV on purpose — the documented deployment
  // (DEPLOY.md) is plain HTTP on a LAN, where NODE_ENV is still
  // "production" (the Dockerfile hardcodes it), and a `Secure` cookie is
  // silently dropped by every browser over HTTP. Only set this once a
  // reverse proxy is terminating real TLS in front of the app.
  COOKIE_SECURE: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
