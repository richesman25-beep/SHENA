import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { sessionClient } from "../supabase/server";
import { trustedRecoveryOrigin } from "./recovery";
import { hasAdminRole } from "./policy";
export async function finishRecovery(
  request: NextRequest,
  mode: "hash" | "code",
) {
  const trusted = trustedRecoveryOrigin(process.env);
  const base = trusted || request.url;
  const failure = () => {
    const response = NextResponse.redirect(
      new URL("/admin/connexion?recovery=failed", base),
    );
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  };
  try {
    if (!trusted) return failure();
    const client = await sessionClient();
    if (!client) return failure();
    const query = request.nextUrl.searchParams;
    const token = mode === "hash" ? query.get("token_hash") : query.get("code");
    if (
      !token ||
      token.length > 4096 ||
      (mode === "hash" && query.get("type") !== "recovery")
    )
      return failure();
    const result =
      mode === "hash"
        ? await client.auth.verifyOtp({ token_hash: token, type: "recovery" })
        : await client.auth.exchangeCodeForSession(token);
    if (result.error) return failure();
    const verified = await client.auth.getUser();
    if (verified.error || !hasAdminRole(verified.data.user)) {
      await client.auth.signOut();
      return failure();
    }
    const response = NextResponse.redirect(
      new URL("/admin/mot-de-passe", base),
    );
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch {
    return failure();
  }
}
