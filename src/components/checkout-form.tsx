"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { useCart } from "./cart-provider";
import { CatalogStatus } from "./catalog-status";
import { useCatalog } from "./catalog-provider";
import { communes, departments } from "@/lib/geography";
import { money } from "@/lib/catalog";
import type { DeliveryZone, ServerQuote } from "@/lib/commerce/quote";
import { placeOrderAction } from "@/app/commander/actions";
export function CheckoutForm({
  zones,
  orderingEnabled,
  signedIn,
  draftId,
}: {
  zones: DeliveryZone[];
  orderingEnabled: boolean;
  signedIn: boolean;
  draftId: string;
}) {
  const { lines, ready } = useCart();
  const [idempotencyKey] = useState(draftId);
  const { mode, status } = useCatalog();
  const [departmentId, setDepartment] = useState("");
  const [communeId, setCommune] = useState("");
  const [zoneId, setZone] = useState("");
  const [state, action, pending] = useActionState(placeOrderAction, {});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [calculated, setCalculated] = useState<{
    key: string;
    quote: ServerQuote;
  } | null>(null);
  const basket = {
    lines,
    location: communeId ? { departmentId, communeId } : null,
    zoneId: zoneId || null,
  };
  const signature = JSON.stringify(basket);
  const quote = calculated?.key === signature ? calculated.quote : null;
  const eligible = zones.filter(
    (z) =>
      z.department_id === departmentId &&
      (!z.commune_id || z.commune_id === communeId),
  );
  async function calculate() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/cart/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: signature,
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok || !data.quote) {
        setError(data.error || "Le panier ne peut pas être vérifié.");
        return;
      }
      setCalculated({ key: signature, quote: data.quote });
    } catch {
      setError("Connexion interrompue. Réessayez avant de poursuivre.");
    } finally {
      setLoading(false);
    }
  }
  if (status !== "ready") return <CatalogStatus />;
  if (!ready) return <p role="status">Chargement du panier…</p>;
  if (!lines.length)
    return (
      <div className="empty">
        <h2>Votre panier est vide.</h2>
        <Link className="button" href="/boutique">
          Découvrir les produits
        </Link>
      </div>
    );
  if (mode === "demo")
    return (
      <div className="catalog-status">
        Le catalogue de démonstration ne permet pas de commander.{" "}
        <Link href="/panier">Revenir au panier</Link>
      </div>
    );
  return (
    <div className="checkout-layout">
      <section className="checkout-panel">
        <h2>1. Destination et récapitulatif</h2>
        <div className="checkout-fields">
          <label>
            Département
            <select
              aria-label="Département"
              value={departmentId}
              onChange={(e) => {
                setDepartment(e.target.value);
                setCommune("");
                setZone("");
              }}
            >
              <option value="">Sélectionner</option>
              {departments.map((d) => (
                <option value={d.id} key={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Commune prise en charge
            <select
              aria-label="Commune prise en charge"
              value={communeId}
              disabled={!departmentId}
              onChange={(e) => {
                setCommune(e.target.value);
                setZone("");
              }}
            >
              <option value="">Sélectionner</option>
              {communes
                .filter((c) => c.departmentId === departmentId)
                .map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Zone de livraison
            <select
              aria-label="Zone de livraison"
              value={zoneId}
              disabled={!communeId || !eligible.length}
              onChange={(e) => setZone(e.target.value)}
            >
              <option value="">Sélectionner une zone</option>
              {eligible.map((z) => (
                <option value={z.id} key={z.id}>
                  {z.name} · {money(z.fee_minor / 100)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!zones.length && (
          <p className="info-box">
            Aucun tarif de livraison n’est confirmé. Les ressources numériques
            ne nécessitent pas de livraison physique.
          </p>
        )}
        <button
          className="button button-secondary"
          onClick={calculate}
          disabled={loading}
        >
          {loading
            ? "Vérification des prix et stocks…"
            : "Vérifier les prix côté serveur"}
        </button>
        {error && (
          <p role="alert" className="admin-error">
            {error}
          </p>
        )}
        {quote && (
          <div className="checkout-quote" role="status">
            <ul>
              {quote.items.map((i) => (
                <li key={i.id}>
                  <span>
                    {i.name} × {i.quantity}
                  </span>
                  <strong>{money(i.totalMinor / 100)}</strong>
                </li>
              ))}
            </ul>
            <dl>
              <div>
                <dt>Sous-total vérifié</dt>
                <dd>{money(quote.subtotalMinor / 100)}</dd>
              </div>
              <div>
                <dt>Livraison</dt>
                <dd>
                  {quote.deliveryMinor === null
                    ? "À configurer"
                    : money(quote.deliveryMinor / 100)}
                </dd>
              </div>
              <div>
                <dt>Total vérifié</dt>
                <dd>
                  {quote.totalMinor === null
                    ? "Non déterminé"
                    : money(quote.totalMinor / 100)}
                </dd>
              </div>
            </dl>
            {quote.message && <p>{quote.message}</p>}
            <small>
              Les prix et disponibilités seront contrôlés à nouveau au moment de
              l’enregistrement.
            </small>
          </div>
        )}
      </section>
      <section className="checkout-panel">
        <h2>2. Vos coordonnées</h2>
        {!orderingEnabled && (
          <p className="catalog-status">
            L’enregistrement des commandes est désactivé. Aucun paiement ni
            réservation ne sera déclenché.
          </p>
        )}
        {orderingEnabled && !signedIn && (
          <p className="info-box">
            <Link href="/compte/connexion">
              Connectez-vous avec votre compte client
            </Link>{" "}
            pour enregistrer une commande.
          </p>
        )}
        <form action={action} className="admin-form checkout-contact">
          <input type="hidden" name="basket" value={signature} />
          <input type="hidden" name="idempotency_key" value={idempotencyKey} />
          <input
            type="hidden"
            name="expected_total_minor"
            value={quote?.totalMinor ?? ""}
          />
          <label>
            Nom complet
            <input
              name="name"
              required
              minLength={2}
              maxLength={120}
              autoComplete="name"
            />
          </label>
          <label>
            Téléphone
            <input
              name="phone"
              type="tel"
              required
              minLength={7}
              maxLength={32}
              autoComplete="tel"
            />
          </label>
          <label>
            Adresse de livraison
            <textarea
              name="address"
              maxLength={500}
              rows={3}
              autoComplete="street-address"
            />
          </label>
          <label>
            Précisions utiles
            <textarea name="note" maxLength={1000} rows={3} />
          </label>
          <label className="checkout-check">
            <input type="checkbox" name="confirmed" required />
            Je confirme les coordonnées et le total vérifié. Cette commande ne
            constitue pas une confirmation de paiement.
          </label>
          {state.error && (
            <p role="alert" className="admin-error">
              {state.error}
            </p>
          )}
          {state.orderId && (
            <p className="admin-success" role="status">
              Commande {state.orderNumber} enregistrée en attente de paiement.{" "}
              <Link href={`/compte/commandes/${state.orderId}`}>
                Voir le suivi
              </Link>
            </p>
          )}
          <button
            className="button"
            disabled={
              !orderingEnabled ||
              !signedIn ||
              !quote?.canOrder ||
              pending ||
              !!state.orderId
            }
          >
            {pending
              ? "Enregistrement sécurisé…"
              : "Enregistrer la commande non payée"}
          </button>
          <small>
            Aucune saisie de carte, aucun paiement automatique et aucun
            téléchargement payant.
          </small>
        </form>
      </section>
    </div>
  );
}
