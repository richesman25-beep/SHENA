import Link from "next/link";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { isApprovedDigitalDelivery } from "@/lib/supabase/deployment";
import { sessionClient } from "@/lib/supabase/server";
export async function DigitalOrderDownloads({
  status,
  productIds,
}: {
  status: string;
  productIds: string[];
}) {
  if (
    !["paid", "processing", "shipped", "delivered"].includes(status) ||
    !productIds.length
  )
    return null;
  let files: { id: string; display_name: string }[] = [];
  try {
    const config = getSupabaseConfig();
    if (!config || !isApprovedDigitalDelivery(config.url, process.env))
      return null;
    const client = await sessionClient();
    if (!client) return null;
    const features = await client.rpc("shena_digital_delivery_features");
    if (
      features.error ||
      features.data?.version !== 1 ||
      features.data.enabled !== true
    )
      return null;
    const releases = await client
      .from("digital_releases")
      .select("id,display_name")
      .in("product_id", productIds.slice(0, 50))
      .eq("status", "approved")
      .limit(100);
    if (releases.error || !releases.data.length) return null;
    files = releases.data;
  } catch {
    return null;
  }
  return (
    <section className="checkout-panel">
      <h2>Vos fichiers numériques</h2>
      <p>Chaque lien est vérifié à nouveau et expire après une minute.</p>
      {files.map((r) => (
        <p key={r.id}>
          <Link
            className="button button-secondary"
            href={`/api/digital/${r.id}/download`}
            prefetch={false}
          >
            {r.display_name}
          </Link>
        </p>
      ))}
    </section>
  );
}
