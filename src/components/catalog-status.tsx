"use client";
import { useCatalog } from "./catalog-provider";
export function CatalogStatus() {
  const state = useCatalog();
  if (state.status === "ready" && !state.message) return null;
  return (
    <div
      className="catalog-status"
      role={state.status === "error" ? "alert" : "status"}
    >
      <h2>
        {state.status === "error"
          ? "Catalogue indisponible"
          : state.status === "unconfigured"
            ? "Ouverture du catalogue en préparation"
            : "Information catalogue"}
      </h2>
      <p>{state.message}</p>
      {state.status === "error" && (
        <button className="button" onClick={() => window.location.reload()}>
          Réessayer
        </button>
      )}
    </div>
  );
}
