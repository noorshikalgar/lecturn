import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { env } from "../config/env.js";

const dataRoot = resolve(process.cwd(), env.DB_PATH, "..");

export const coversDir = resolve(dataRoot, "covers");
export const certificatesDir = resolve(dataRoot, "certificates");
export const subtitlesCacheDir = resolve(dataRoot, "subtitles-cache");
export const remuxCacheDir = resolve(dataRoot, "remux-cache");

for (const dir of [coversDir, certificatesDir, subtitlesCacheDir, remuxCacheDir]) {
  mkdirSync(dir, { recursive: true });
}
