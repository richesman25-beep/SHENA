import type { SupabaseClient } from "@supabase/supabase-js";
export async function ManualPaymentInstructions({
  client,
  enabled,
  status,
}: {
  client: SupabaseClient;
  enabled: boolean;
  status: string;
}) {
  if (!enabled || status !== "pending_payment") return null;
  const result = await client
    .from("commerce_payment_accounts")
    .select("provider,display_name,account_identifier")
    .eq("active", true);
  if (result.error || !result.data.length) return null;
  return (
    <section className="checkout-panel">
      <h2>Paiement à vérifier par la boutique</h2>
      <p>
        Conservez votre référence de transaction et communiquez-la lors de la
        vérification. Une capture ou une déclaration ne confirme pas le
        paiement.
      </p>
      {result.data.map((a) => (
        <p key={a.provider}>
          <strong>{a.provider === "moncash" ? "MonCash" : "NatCash"}</strong> ·{" "}
          {a.display_name}
          <br />
          Compte destinataire : {a.account_identifier}
        </p>
      ))}
      <p>
        Le statut change uniquement après contrôle indépendant par deux
        administrateurs. Ne payez pas après expiration de la réservation sans
        contacter la boutique.
      </p>
    </section>
  );
}
