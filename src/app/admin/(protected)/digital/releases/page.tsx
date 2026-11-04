import { adminView } from "@/lib/admin/auth";
import {
  PrepareDigitalReleaseForm,
  ReviewDigitalReleaseForm,
} from "@/components/admin-digital-release-forms";
type Release = {
  id: string;
  display_name: string;
  sha256: string;
  security_report: string;
  submitted_by: string;
  status: string;
};
export default async function DigitalReleases() {
  const context = await adminView();
  if (!context) return null;
  if (!context.capabilities?.digital)
    return (
      <div className="workspace-panel">
        <h1>Versions numériques indisponibles</h1>
        <p>Les autorisations de fichiers privés ne sont pas activées.</p>
      </div>
    );
  const [assets, releases] = await Promise.all([
    context.client
      .from("digital_assets")
      .select("id,original_name")
      .eq("status", "quarantine")
      .order("created_at", { ascending: false })
      .limit(100),
    context.client.rpc("shena_admin_digital_releases"),
  ]);
  if (assets.error || releases.error || !Array.isArray(releases.data))
    return (
      <div className="workspace-panel">
        <h1>Préparation numérique indisponible</h1>
        <p>
          Les structures et autorisations nécessaires ne sont pas installées.
          Aucun fichier ni paiement n’est modifié.
        </p>
      </div>
    );
  return (
    <>
      <div className="workspace-page-heading">
        <h1>Versions privées des produits numériques</h1>
        <p>
          La validation du fichier et celle du paiement sont deux contrôles
          indépendants. Aucun mode de livraison n’est activé par cet écran.
        </p>
      </div>
      <section className="workspace-panel">
        <PrepareDigitalReleaseForm assets={assets.data} />
      </section>
      {(releases.data as Release[]).map((r) => (
        <section className="workspace-panel" key={r.id}>
          <h2>{r.display_name}</h2>
          <p>
            État : {r.status} · Proposé par : {r.submitted_by}
          </p>
          <p>
            SHA256 :{" "}
            <code style={{ overflowWrap: "anywhere" }}>{r.sha256}</code>
          </p>
          <p>{r.security_report}</p>
          <ReviewDigitalReleaseForm
            id={r.id}
            self={r.submitted_by === context.userId}
            status={r.status}
          />
        </section>
      ))}
    </>
  );
}
