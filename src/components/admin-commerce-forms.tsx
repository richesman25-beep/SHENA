"use client";
import { useActionState, useState } from "react";
import {
  saveDeliveryZoneAction,
  transitionOrderAction,
  submitPaymentReviewAction,
  decidePaymentReviewAction,
} from "@/app/admin/commerce-actions";
import type { ActionState } from "@/app/admin/actions";
import type { DeliveryZone } from "@/lib/commerce/quote";
import type { CommerceOrder, PaymentReview } from "@/lib/commerce/orders";
import { departments, communes } from "@/lib/geography";
function Result({ state }: { state: ActionState }) {
  return (
    <>
      {state.error && (
        <p role="alert" className="admin-error">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="admin-success">
          {state.success}
        </p>
      )}
    </>
  );
}
export function DeliveryZoneForm({
  zone,
  enabled,
}: {
  zone?: DeliveryZone;
  enabled: boolean;
}) {
  const [state, action, pending] = useActionState(saveDeliveryZoneAction, {});
  const [department, setDepartment] = useState(zone?.department_id || "");
  const [commune, setCommune] = useState(zone?.commune_id || "");
  return (
    <form className="admin-form" action={action}>
      <input name="id" type="hidden" value={zone?.id || ""} />
      <label>
        Nom de la zone
        <input
          name="name"
          required
          minLength={2}
          maxLength={100}
          defaultValue={zone?.name}
        />
      </label>
      <label>
        Département
        <select
          name="department_id"
          value={department}
          onChange={(e) => {
            setDepartment(e.target.value);
            setCommune("");
          }}
          required
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
        Commune
        <select
          name="commune_id"
          value={commune}
          onChange={(e) => setCommune(e.target.value)}
          disabled={!department}
        >
          <option value="">Tout le département</option>
          {communes
            .filter((c) => c.departmentId === department)
            .map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
        </select>
      </label>
      <label>
        Frais en HTG
        <input
          name="fee_htg"
          type="number"
          min="0"
          step="0.01"
          max="100000000"
          defaultValue={zone ? zone.fee_minor / 100 : undefined}
          required
        />
      </label>
      <label className="admin-check">
        <input
          name="active"
          type="checkbox"
          defaultChecked={zone?.active || false}
        />
        Zone active
      </label>
      <label className="admin-check">
        <input name="confirmed" type="checkbox" />
        Je confirme que ce tarif de livraison est applicable.
      </label>
      <Result state={state} />
      <button className="button" disabled={!enabled || pending}>
        {pending ? "Enregistrement…" : "Enregistrer le tarif"}
      </button>
    </form>
  );
}
export function OrderTransitionForm({
  order,
  enabled,
}: {
  order: CommerceOrder;
  enabled: boolean;
}) {
  const [state, action, pending] = useActionState(transitionOrderAction, {});
  const targets =
    order.status === "pending_payment"
      ? [{ id: "cancelled", label: "Annuler et libérer le stock" }]
      : order.status === "paid"
        ? [{ id: "processing", label: "Mettre en préparation" }]
        : order.status === "processing"
          ? [
              { id: "shipped", label: "Marquer expédiée" },
              { id: "delivered", label: "Marquer livrée" },
            ]
          : order.status === "shipped"
            ? [{ id: "delivered", label: "Marquer livrée" }]
            : [];
  if (!targets.length)
    return (
      <p className="admin-muted">
        Aucune transition opérationnelle proposée pour cet état. Les
        remboursements demandent une procédure distincte et ne sont pas simulés.
      </p>
    );
  return (
    <form className="admin-form" action={action}>
      <input name="order_id" type="hidden" value={order.id} />
      <input name="version" type="hidden" value={order.version} />
      <label>
        Prochain statut
        <select name="status">
          {targets.map((t) => (
            <option value={t.id} key={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Justification
        <textarea name="note" minLength={5} maxLength={1000} required />
      </label>
      <label className="admin-check">
        <input name="confirmed" type="checkbox" required />
        Je confirme ce changement de statut.
      </label>
      <Result state={state} />
      <button className="button" disabled={!enabled || pending}>
        {pending ? "Vérification…" : "Mettre à jour le statut"}
      </button>
    </form>
  );
}
export function SubmitPaymentReviewForm({
  order,
  enabled,
  draftId,
}: {
  order: CommerceOrder;
  enabled: boolean;
  draftId: string;
}) {
  const [state, action, pending] = useActionState(
    submitPaymentReviewAction,
    {},
  );
  const [key] = useState(draftId);
  return (
    <form className="admin-form" action={action}>
      <input name="order_id" type="hidden" value={order.id} />
      <input name="idempotency_key" type="hidden" value={key} />
      <label>
        Canal vérifié
        <select name="provider">
          <option value="moncash">MonCash — contrôle manuel</option>
          <option value="natcash">NatCash — contrôle manuel</option>
        </select>
      </label>
      <label>
        Référence de transaction reçue
        <input
          name="reference"
          minLength={4}
          maxLength={160}
          required
          autoComplete="off"
        />
      </label>
      <label>
        Montant reçu en HTG
        <input
          name="amount_htg"
          type="number"
          min="0"
          step="0.01"
          defaultValue={order.total_minor / 100}
          required
        />
      </label>
      <label>
        Trace du contrôle indépendant
        <textarea
          name="note"
          minLength={10}
          maxLength={1000}
          required
          placeholder="Décrivez le contrôle effectué, sans clé, mot de passe ni numéro de carte."
        />
      </label>
      <label className="admin-check">
        <input name="statement_verified" type="checkbox" required />
        J’ai vérifié la réception effective dans le compte de la boutique,
        indépendamment d’un reçu client ou d’une redirection.
      </label>
      <Result state={state} />
      <button
        className="button"
        disabled={!enabled || pending || order.status !== "pending_payment"}
      >
        {pending ? "Contrôle…" : "Soumettre au second administrateur"}
      </button>
    </form>
  );
}
export function DecidePaymentReviewForm({
  review,
  orderId,
  currentUserId,
  enabled,
}: {
  review: PaymentReview;
  orderId: string;
  currentUserId: string;
  enabled: boolean;
}) {
  const [state, action, pending] = useActionState(
    decidePaymentReviewAction,
    {},
  );
  if (review.status !== "pending")
    return (
      <p className="admin-muted">
        Décision : {review.status === "approved" ? "approuvée" : "rejetée"}.
      </p>
    );
  if (review.submitted_by === currentUserId)
    return (
      <p className="admin-muted">
        Un autre administrateur doit effectuer le contrôle indépendant.
      </p>
    );
  return (
    <form className="admin-form" action={action}>
      <input name="review_id" type="hidden" value={review.id} />
      <input name="order_id" type="hidden" value={orderId} />
      <label>
        Décision
        <select name="decision">
          <option value="rejected">Rejeter la vérification</option>
          <option value="approved">Approuver après réception vérifiée</option>
        </select>
      </label>
      <label>
        Justification du second contrôle
        <textarea name="note" minLength={10} maxLength={1000} required />
      </label>
      <label className="admin-check">
        <input name="statement_verified" type="checkbox" required />
        J’ai effectué mon propre contrôle du compte de la boutique et du montant
        exact.
      </label>
      <Result state={state} />
      <button className="button" disabled={!enabled || pending}>
        {pending ? "Contrôle…" : "Enregistrer ma décision"}
      </button>
    </form>
  );
}
