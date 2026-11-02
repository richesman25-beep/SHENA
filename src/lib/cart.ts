import { products, type Product } from "./catalog";
export type CartLine = { id: string; quantity: number };
export function normalizeCart(
  raw: unknown,
  source: Product[] = products,
): CartLine[] {
  if (!Array.isArray(raw)) return [];
  const result: CartLine[] = [];
  for (const line of raw) {
    if (
      !line ||
      typeof line !== "object" ||
      typeof line.id !== "string" ||
      !Number.isInteger(line.quantity) ||
      line.quantity < 1
    )
      continue;
    const product = source.find((p) => p.id === line.id);
    if (
      !product ||
      product.type === "unknown" ||
      result.some((l) => l.id === line.id)
    )
      continue;
    const limit =
      product.type === "digital"
        ? 1
        : product.type === "stock"
          ? product.stock
          : 10;
    if (limit > 0)
      result.push({ id: product.id, quantity: Math.min(limit, line.quantity) });
  }
  return result;
}
export function cartTotal(lines: CartLine[], source: Product[] = products) {
  return normalizeCart(lines, source).reduce(
    (sum, line) =>
      sum + source.find((p) => p.id === line.id)!.price * line.quantity,
    0,
  );
}
