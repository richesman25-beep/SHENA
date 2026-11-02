import sharp from "sharp";
export function hasAllowedImageSignature(bytes: Uint8Array) {
  const ascii = (from: number, to: number) =>
    String.fromCharCode(...bytes.slice(from, to));
  return (
    bytes.length >= 12 &&
    ((bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) ||
      (bytes[0] === 137 &&
        ascii(1, 4) === "PNG" &&
        bytes[4] === 13 &&
        bytes[5] === 10 &&
        bytes[6] === 26 &&
        bytes[7] === 10) ||
      (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP"))
  );
}
export async function processProductImage(buffer: Buffer) {
  if (
    buffer.byteLength === 0 ||
    buffer.byteLength > 2 * 1024 * 1024 ||
    !hasAllowedImageSignature(buffer)
  )
    throw new Error("Image refusée.");
  const source = sharp(buffer, {
    limitInputPixels: 16000000,
    failOn: "warning",
  });
  const meta = await source.metadata();
  if (
    !["jpeg", "png", "webp"].includes(meta.format || "") ||
    !meta.width ||
    !meta.height ||
    meta.width > 6000 ||
    meta.height > 6000
  )
    throw new Error("Image refusée.");
  return source
    .rotate()
    .resize({
      width: 1800,
      height: 1800,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 85 })
    .toBuffer();
}
