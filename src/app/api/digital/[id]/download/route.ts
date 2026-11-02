import { getSupabaseConfig } from "@/lib/supabase/config";
import { sessionClient } from "@/lib/supabase/server";
import { isApprovedDigitalDelivery } from "@/lib/supabase/deployment";
import {
  DigitalDeliveryError,
  resolveDigitalDownload,
  type DigitalRelease,
} from "@/lib/commerce/digital-delivery";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const headers = {
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
  };
  try {
    const config = getSupabaseConfig();
    if (!config || !isApprovedDigitalDelivery(config.url, process.env))
      return Response.json(
        { error: "Les téléchargements payants ne sont pas activés." },
        { status: 404, headers },
      );
    const client = await sessionClient();
    if (!client)
      return Response.json(
        { error: "Service indisponible." },
        { status: 503, headers },
      );
    const { id } = await params;
    const url = await resolveDigitalDownload(id, true, config.url, {
      async user() {
        const r = await client.auth.getUser();
        return r.error || !r.data.user
          ? null
          : { id: r.data.user.id, verified: !!r.data.user.email_confirmed_at };
      },
      async features() {
        const r = await client.rpc("shena_digital_delivery_features");
        return r.error ? null : r.data;
      },
      async release(releaseId) {
        const r = await client
          .from("digital_releases")
          .select("bucket,object_path,display_name,status")
          .eq("id", releaseId)
          .eq("status", "approved")
          .maybeSingle();
        return r.error ? null : (r.data as DigitalRelease | null);
      },
      async sign(path, expiresIn, downloadName) {
        const r = await client.storage
          .from("digital-products")
          .createSignedUrl(path, expiresIn, { download: downloadName });
        return r.error ? null : r.data.signedUrl;
      },
    });
    return new Response(null, {
      status: 303,
      headers: { ...headers, Location: url },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof DigitalDeliveryError
            ? error.message
            : "Le téléchargement sécurisé est indisponible.",
      },
      {
        status: error instanceof DigitalDeliveryError ? error.status : 503,
        headers,
      },
    );
  }
}
