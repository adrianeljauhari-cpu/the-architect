import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

/** Better Auth's catch-all handler: activation OTP, sign-in, sign-out, session. */
export const { GET, POST } = toNextJsHandler(auth);
