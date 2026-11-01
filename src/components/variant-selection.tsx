export function VariantSelection({ image }: { image: string }) {
  if (image !== "sneakers" && image !== "bag") return null;
  return (
    <div className="variant-selection">
      <span>{image === "sneakers" ? "Pointure" : "Coloris"}</span>
      <button type="button" aria-pressed="true">
        {image === "sneakers" ? "39 · modèle démo" : "Sable · modèle démo"}
      </button>
      <small>Une seule variante dans cette démonstration.</small>
    </div>
  );
}
