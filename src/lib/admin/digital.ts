export const digitalKinds = [
  "ebook",
  "document",
  "template",
  "graphics",
  "software",
  "training",
  "planner",
  "other",
] as const;
export function validateDigitalMetadata(form: FormData) {
  const kind = String(form.get("kind") || "");
  const formats = String(form.get("formats") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const license = String(form.get("license") || "").trim();
  const compatibility = String(form.get("compatibility") || "").trim();
  const contents = String(form.get("contents") || "").trim();
  if (
    !digitalKinds.some((k) => k === kind) ||
    formats.length > 10 ||
    formats.some((f) => f.length > 40) ||
    license.length > 5000 ||
    compatibility.length > 3000 ||
    contents.length > 15000
  )
    throw new Error(
      "Vérifiez le type de ressource, les formats et la longueur des informations.",
    );
  return { kind, formats, license, compatibility, contents };
}
export function validatePrivateFile(
  file: { name: string; type: string; size: number },
  bytes: Uint8Array,
  extended: boolean,
) {
  if (
    file.size === 0 ||
    file.size > 2 * 1024 * 1024 ||
    bytes.length !== file.size
  )
    return null;
  const ext = file.name.split(".").at(-1)?.toLowerCase();
  const text = (from: number, to: number) =>
    String.fromCharCode(...bytes.slice(from, to));
  if (
    ext === "pdf" &&
    file.type === "application/pdf" &&
    text(0, 5) === "%PDF-"
  )
    return { mime: "application/pdf", extension: "pdf" };
  const archiveTypes: Record<string, string> = {
    zip: "application/zip",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    epub: "application/epub+zip",
  };
  if (
    extended &&
    ext &&
    archiveTypes[ext] &&
    file.type === archiveTypes[ext] &&
    bytes.length >= 4 &&
    bytes[0] === 80 &&
    bytes[1] === 75 &&
    ((bytes[2] === 3 && bytes[3] === 4) || (bytes[2] === 5 && bytes[3] === 6))
  )
    return { mime: archiveTypes[ext], extension: ext };
  return null;
}
