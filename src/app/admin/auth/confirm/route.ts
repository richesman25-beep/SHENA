import type { NextRequest } from "next/server";
import { finishRecovery } from "@/lib/admin/recovery-route";
export async function GET(request: NextRequest) {
  return finishRecovery(request, "hash");
}
