import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "./config";
export async function sessionClient() {
  const config = getSupabaseConfig();
  if (!config) return null;
  const store = await cookies();
  return createServerClient(config.url, config.key, {
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) =>
            store.set(name, value, options),
          );
        } catch {
          /* Le proxy rafraîchit les cookies avant les composants serveur. */
        }
      },
    },
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        }),
    },
  });
}
