"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="shell empty">
      <h1>Une interruption passagère.</h1>
      <p>La page n’a pas pu se charger. Vous pouvez réessayer.</p>
      <button onClick={reset} className="button">
        Réessayer
      </button>
    </div>
  );
}
