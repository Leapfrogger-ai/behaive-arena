import { z } from "zod";

const ServerSchema = z.object({
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(10),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://127.0.0.1:3000"),
});

export function serverEnv() {
  return ServerSchema.parse(process.env);
}
