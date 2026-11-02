export class HttpInputError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
/** Limite appliquée pendant la lecture, pas après avoir chargé un corps arbitraire. */
export async function readLimitedJson(
  request: Request,
  limit = 16000,
): Promise<unknown> {
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .match(/^application\/json(?:\s*;|$)/)
  )
    throw new HttpInputError("Format JSON requis.", 415);
  const length = request.headers.get("content-length");
  if (length && Number(length) > limit)
    throw new HttpInputError("Requête trop volumineuse.", 413);
  if (!request.body) throw new HttpInputError("Corps de requête requis.", 400);
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0,
    text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new HttpInputError("Requête trop volumineuse.", 413);
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof HttpInputError) throw error;
    throw new HttpInputError("JSON invalide.", 400);
  } finally {
    reader.releaseLock();
  }
}
