"use client";
import { useState } from "react";
import { products } from "@/lib/catalog";
import {
  stockLocations,
  inventories,
  type Inventory,
  type StockLocation,
} from "@/lib/logistics";
import { communes, departments, communeName } from "@/lib/geography";
export function StockWorkbench() {
  const [locations, setLocations] = useState<StockLocation[]>(
    stockLocations.map((l) => ({ ...l })),
  );
  const [rows, setRows] = useState<Inventory[]>(
    inventories.map((i) => ({ ...i })),
  );
  const [notice, setNotice] = useState("");
  const [department, setDepartment] = useState("");
  const [commune, setCommune] = useState("");
  const [filter, setFilter] = useState("");
  function addLocation(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") || "")
      .trim()
      .slice(0, 60);
    if (
      !name ||
      !communes.some((c) => c.id === commune && c.departmentId === department)
    )
      return;
    setLocations((old) => [
      ...old,
      {
        id: crypto.randomUUID(),
        name: `${name} — démo`,
        communeId: commune,
        public: true,
      },
    ]);
    setNotice("Point fictif ajouté à cette simulation uniquement.");
    form.reset();
    setCommune("");
    setDepartment("");
  }
  function setInventory(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const productId = String(data.get("product"));
    const locationId = String(data.get("location"));
    const quantity = Number(data.get("quantity"));
    if (
      !Number.isInteger(quantity) ||
      quantity < 0 ||
      quantity > 10000 ||
      !locations.some((l) => l.id === locationId) ||
      !products.some((p) => p.id === productId && p.type === "stock")
    )
      return;
    setRows((old) => [
      ...old.filter(
        (i) => i.productId !== productId || i.locationId !== locationId,
      ),
      { productId, locationId, quantity },
    ]);
    setNotice(
      "Quantité fictive mise à jour, sans écriture dans Supabase ni changement du catalogue.",
    );
  }
  return (
    <>
      <div className="workbench-forms">
        <form onSubmit={addLocation}>
          <h2>Ajouter un point fictif</h2>
          <label>
            Nom public du point
            <input
              required
              maxLength={60}
              name="name"
              placeholder="Nom de démonstration, sans adresse privée"
            />
          </label>
          <label>
            Département du point
            <select
              required
              value={department}
              onChange={(e) => {
                setDepartment(e.target.value);
                setCommune("");
              }}
            >
              <option value="">Choisir</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Commune du point
            <select
              required
              disabled={!department}
              value={commune}
              onChange={(e) => setCommune(e.target.value)}
            >
              <option value="">Choisir</option>
              {communes
                .filter((c) => c.departmentId === department)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          <button className="button">Ajouter à la simulation</button>
        </form>
        <form onSubmit={setInventory}>
          <h2>Répartir le stock fictif</h2>
          <label>
            Produit physique
            <select name="product">
              {products
                .filter((p) => p.type === "stock")
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Point de stockage
            <select name="location">
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Quantité fictive
            <input
              name="quantity"
              type="number"
              min="0"
              max="10000"
              step="1"
              required
              defaultValue={0}
            />
          </label>
          <button className="button">Appliquer à la simulation</button>
          <small>
            0 indique une rupture à ce point. Les produits numériques n’ont pas
            de stock physique.
          </small>
        </form>
      </div>
      <p role="status" className="workbench-status">
        {notice}
      </p>
      <div className="workbench-table">
        <h2>Stocks de démonstration par emplacement</h2>
        <label>
          Filtrer par département
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">Toute Haïti</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Produit</th>
                <th>Point public fictif</th>
                <th>Commune</th>
                <th>Quantité</th>
                <th>État</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .filter(
                  (i) =>
                    !filter ||
                    communes.find(
                      (c) =>
                        c.id ===
                        locations.find((l) => l.id === i.locationId)?.communeId,
                    )?.departmentId === filter,
                )
                .map((i) => {
                  const loc = locations.find((l) => l.id === i.locationId)!;
                  return (
                    <tr key={i.productId + i.locationId}>
                      <td>
                        {products.find((p) => p.id === i.productId)?.name}
                      </td>
                      <td>{loc.name}</td>
                      <td>{communeName(loc.communeId)}</td>
                      <td>{i.quantity}</td>
                      <td>
                        {i.quantity > 0 ? "Stock fictif" : "Rupture (démo)"}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="info-box">
        <h2>Zones et tarifs</h2>
        <p>
          Aucune règle de livraison n’est configurée. Les futurs écrans devront
          définir origine, destination, mode, partenaire autorisé, frais et
          délai validés. Aucune valeur n’est inventée ici.
        </p>
      </div>
    </>
  );
}
