import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// The app has no sign-in yet, so changes made with the server's secret key sit behind one shared passcode (STUDIO_KEY).
// The cookie holds an HMAC derived from it, never the passcode. ponytail: one shared secret; per-user Supabase Auth replaces it.
export const ACCESS_COOKIE = "studio_access";
export const accessToken = (key: string) => createHmac("sha256", key).update("creator-studio:asset-write:v1").digest("hex");

const same = (a: string, b: string) => {
  const x = createHash("sha256").update(a).digest(), y = createHash("sha256").update(b).digest(); // equal length, constant time
  return timingSafeEqual(x, y);
};
export const passcodeOk = (input: string, key: string | undefined) => !!key && same(input, key);
export const cookieOk = (cookie: string | undefined, key: string | undefined) => !!key && !!cookie && same(cookie, accessToken(key));
