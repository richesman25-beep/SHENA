import Image from "next/image";
const positions: Record<string, [number, number]> = {
  sneakers: [0, 0],
  headphones: [1, 0],
  beauty: [2, 0],
  bag: [0, 1],
  vase: [1, 1],
  speaker: [2, 1],
};
/** Planche locale originale : recadrage CSS, aucune requête vers un service tiers. */
export function ProductVisual({
  image,
  name,
  priority = false,
  alternate = false,
}: {
  image: string;
  name: string;
  priority?: boolean;
  alternate?: boolean;
}) {
  const cell = positions[image];
  if (!cell)
    return (
      <div
        className={`digital-cover ${image === "template" ? "cv-cover" : "planner-cover"}`}
        role="img"
        aria-label={`Aperçu de démonstration : ${name}`}
      >
        <span className="cover-brand">
          SHENA <b>DIGITAL</b>
        </span>
        <span className="cover-type">
          {image === "template"
            ? "CARRIÈRE & AMBITION"
            : "ORGANISATION & PROJETS"}
        </span>
        <strong>
          {image === "template" ? (
            <>
              Votre prochain
              <br />
              chapitre.
            </>
          ) : (
            <>
              Des idées.
              <br />
              Un plan.
              <br />À vous de jouer.
            </>
          )}
        </strong>
        <div className="cover-lines">
          <i />
          <i />
          <i />
        </div>
        <span className="cover-bottom">
          {image === "template"
            ? "LE KIT CV PROFESSIONNEL / WORD + PDF"
            : "MON PLANNER ESSENTIEL / PDF"}
        </span>
        <span className="cover-number">
          {image === "template" ? "02" : "01"}
        </span>
      </div>
    );
  return (
    <div className="studio-visual">
      <Image
        src={
          alternate
            ? "/products/studio-alternate.png"
            : "/products/studio-collection.png"
        }
        alt={`Visuel généré de démonstration : ${name}`}
        width={1536}
        height={1024}
        sizes="(max-width: 640px) 150vw, 75vw"
        priority={priority}
        style={{
          width: "300%",
          height: "200%",
          maxWidth: "none",
          position: "absolute",
          left: `-${cell[0] * 100}%`,
          top: `-${cell[1] * 100}%`,
        }}
      />
    </div>
  );
}
