"use client";
import { useState } from "react";
import { ProductVisual } from "./product-visual";
export function ProductGallery({
  image,
  name,
  url,
  live = false,
}: {
  image: string;
  name: string;
  url?: string;
  live?: boolean;
}) {
  const [alternate, setAlternate] = useState(false);
  const [zoom, setZoom] = useState(false);
  return (
    <div className="detail-image">
      <div className={`gallery-stage ${zoom ? "is-zoomed" : ""}`}>
        <ProductVisual
          url={url}
          live={live}
          image={image}
          name={name}
          priority
          alternate={alternate}
        />
      </div>
      <div className="gallery-controls" aria-label="Vue du produit">
        <button
          aria-pressed={!zoom && !alternate}
          onClick={() => {
            setZoom(false);
            setAlternate(false);
          }}
        >
          Vue produit
        </button>
        {!live && image !== "planner" && image !== "template" && (
          <button
            aria-pressed={alternate && !zoom}
            onClick={() => {
              setAlternate(true);
              setZoom(false);
            }}
          >
            Autre vue
          </button>
        )}
        <button aria-pressed={zoom} onClick={() => setZoom(true)}>
          Vue rapprochée
        </button>
      </div>
      <span>
        {live
          ? "Image du catalogue"
          : image === "planner" || image === "template"
            ? "Aperçu de couverture"
            : "Visuel généré"}{" "}
        {live
          ? "· Agrandir le visuel pour examiner le produit"
          : "· Démonstration · Image non contractuelle"}
      </span>
    </div>
  );
}
