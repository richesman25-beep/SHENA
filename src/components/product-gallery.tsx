"use client";
import { useState } from "react";
import { ProductVisual } from "./product-visual";
export function ProductGallery({
  image,
  name,
}: {
  image: string;
  name: string;
}) {
  const [zoom, setZoom] = useState(false);
  return (
    <div className="detail-image">
      <div className={`gallery-stage ${zoom ? "is-zoomed" : ""}`}>
        <ProductVisual image={image} name={name} priority />
      </div>
      <div className="gallery-controls" aria-label="Vue du produit">
        <button aria-pressed={!zoom} onClick={() => setZoom(false)}>
          Vue produit
        </button>
        <button aria-pressed={zoom} onClick={() => setZoom(true)}>
          Vue rapprochée
        </button>
      </div>
      <span>
        {image === "planner" || image === "template"
          ? "Aperçu de couverture"
          : "Visuel généré"}{" "}
        · Démonstration · Image non contractuelle
      </span>
    </div>
  );
}
