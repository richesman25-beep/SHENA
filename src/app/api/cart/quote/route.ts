import { quoteFromServer } from "@/lib/commerce/server";
import { CheckoutError } from "@/lib/commerce/quote";
import { readLimitedJson, HttpInputError } from "@/lib/http/json";
export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const quote = await quoteFromServer(await readLimitedJson(request));
    return Response.json({ quote }, { headers });
  } catch (error) {
    const status =
      error instanceof HttpInputError
        ? error.status
        : error instanceof CheckoutError
          ? 422
          : 503;
    return Response.json(
      {
        error:
          error instanceof HttpInputError || error instanceof CheckoutError
            ? error.message
            : "Le récapitulatif ne peut pas être calculé.",
      },
      { status, headers },
    );
  }
}
