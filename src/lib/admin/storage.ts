export type ManagedMedia = {
  id: string;
  object_path: string;
  public_url: string;
  size_bytes: number;
  state: "active" | "deleting" | "deleted";
  created_at: string;
};
export function safeStoragePrefix(value: unknown) {
  if (typeof value !== "string") return "";
  if (
    value.length > 500 ||
    value.startsWith("/") ||
    value.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(value)
  )
    return null;
  const parts = value.split("/");
  if (parts.some((p) => p === "." || p === ".." || p.includes("%")))
    return null;
  return parts.filter(Boolean).join("/");
}
export function managedObjectPath(value: string) {
  return /^managed\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/i.test(
    value,
  );
}
