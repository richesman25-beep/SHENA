import type { OrderStatus } from "./contracts";
export const orderStatusLabels: Record<OrderStatus, string> = {
  pending_payment: "En attente de paiement",
  paid: "Paiement vérifié",
  processing: "En préparation",
  shipped: "Expédiée",
  delivered: "Livrée",
  cancelled: "Annulée",
  refunded: "Remboursée",
};
export const orderSummaryColumns =
  "id,order_number,status,subtotal_minor,delivery_minor,total_minor,currency,created_at,reservation_expires_at,version,customer_name";
export const orderDetailColumns =
  "id,order_number,status,subtotal_minor,delivery_minor,total_minor,currency,created_at,reservation_expires_at,version,customer_name,customer_id,customer_phone,delivery_address,department_id,commune_id,note,zone_name";
export type CommerceOrder = {
  id: string;
  order_number: string;
  status: OrderStatus;
  subtotal_minor: number;
  delivery_minor: number;
  total_minor: number;
  currency: "HTG";
  created_at: string;
  reservation_expires_at: string;
  version: number;
  customer_name: string;
  customer_id: string;
  customer_phone: string;
  delivery_address: string;
  department_id: string | null;
  commune_id: string | null;
  note: string;
  zone_name: string | null;
};
export type CommerceOrderItem = {
  product_id: string;
  product_name: string;
  product_type: "physical" | "digital";
  quantity: number;
  unit_price_minor: number;
  total_minor: number;
};
export type PaymentReview = {
  id: string;
  provider: "moncash" | "natcash";
  external_reference: string;
  amount_minor: number;
  status: "pending" | "approved" | "rejected";
  submitted_by: string;
  verified_by: string | null;
  created_at: string;
  review_note: string | null;
  submit_note: string;
};
