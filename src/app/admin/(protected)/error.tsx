"use client";
export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <section className="workspace-panel admin-empty">
      <h2>Ces données ne peuvent pas être affichées.</h2>
      <p>
        Aucune opération n’a été confirmée. Vérifiez votre connexion et
        réessayez.
      </p>
      <button className="button" onClick={reset}>
        Réessayer
      </button>
    </section>
  );
}
