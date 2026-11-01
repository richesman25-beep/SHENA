import { StockWorkbench } from "@/components/stock-workbench";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Atelier stocks — simulation locale",
};
export default function Stocks() {
  return (
    <div className="shell workbench-page">
      <div className="page-heading">
        <span className="eyebrow">PRÉPARATION DE L’ADMINISTRATION</span>
        <h1>Atelier des stocks multivilles</h1>
        <p>
          Interface de simulation publique, sans données réelles. Les
          modifications restent dans cette page et disparaissent au
          rechargement. Ce n’est pas une administration authentifiée.
        </p>
      </div>
      <StockWorkbench />
    </div>
  );
}
