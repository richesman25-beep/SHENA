/** Contrats de phase future : aucun prestataire ni endpoint de paiement activé. */
export const orderStatuses = [
  "pending_payment",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
] as const;
export type OrderStatus = (typeof orderStatuses)[number];
export type PaymentProvider = "moncash" | "natcash" | "international";
export type VerifiedPayment = Readonly<{
  provider: PaymentProvider;
  eventId: string;
  orderId: string;
  amountMinor: number;
  currency: "HTG";
  transactionId: string;
}>;
export interface PaymentAdapter {
  // Implémentation future : vérifier signature, secret, source et statut chez le prestataire.
  verifyServerNotification(
    rawBody: Uint8Array,
    headers: Headers,
  ): Promise<VerifiedPayment>;
}
export function canTransitionOrder(from: OrderStatus, to: OrderStatus) {
  const transitions: Record<OrderStatus, readonly OrderStatus[]> = {
    pending_payment: ["paid", "cancelled"],
    paid: ["processing", "refunded"],
    processing: ["shipped", "delivered", "refunded"],
    shipped: ["delivered", "refunded"],
    delivered: ["refunded"],
    cancelled: [],
    refunded: [],
  };
  return transitions[from].includes(to);
}
// Aucun adaptateur factice : absence explicite, impossible de démarrer un paiement.
export function configuredPaymentAdapter(): PaymentAdapter | null {
  return null;
}
