/** Sous-ensemble de démonstration des communes haïtiennes, extensible.
 * Référence administrative : OCHA COD-AB Haïti / CNIGS (voir docs/geography.md).
 * Les identifiants ci-dessous sont internes, pas des codes officiels.
 */
export const departments = [
  { id: "ouest", name: "Ouest" },
  { id: "nord", name: "Nord" },
  { id: "nord-est", name: "Nord-Est" },
  { id: "nord-ouest", name: "Nord-Ouest" },
  { id: "centre", name: "Centre" },
  { id: "artibonite", name: "Artibonite" },
  { id: "sud", name: "Sud" },
  { id: "sud-est", name: "Sud-Est" },
  { id: "grand-anse", name: "Grand’Anse" },
  { id: "nippes", name: "Nippes" },
] as const;
export const communes = [
  { id: "port-au-prince", name: "Port-au-Prince", departmentId: "ouest" },
  { id: "petion-ville", name: "Pétion-Ville", departmentId: "ouest" },
  { id: "delmas", name: "Delmas", departmentId: "ouest" },
  { id: "cap-haitien", name: "Cap-Haïtien", departmentId: "nord" },
  { id: "limbe", name: "Limbé", departmentId: "nord" },
  { id: "fort-liberte", name: "Fort-Liberté", departmentId: "nord-est" },
  { id: "port-de-paix", name: "Port-de-Paix", departmentId: "nord-ouest" },
  { id: "hinche", name: "Hinche", departmentId: "centre" },
  { id: "maissade", name: "Maïssade", departmentId: "centre" },
  { id: "mirebalais", name: "Mirebalais", departmentId: "centre" },
  { id: "gonaives", name: "Gonaïves", departmentId: "artibonite" },
  { id: "saint-marc", name: "Saint-Marc", departmentId: "artibonite" },
  { id: "les-cayes", name: "Les Cayes", departmentId: "sud" },
  { id: "jacmel", name: "Jacmel", departmentId: "sud-est" },
  { id: "jeremie", name: "Jérémie", departmentId: "grand-anse" },
  { id: "miragoane", name: "Miragoâne", departmentId: "nippes" },
] as const;
export type CustomerLocation = {
  departmentId: string;
  communeId: string;
  locality?: string;
};
export function normalizeLocation(value: unknown): CustomerLocation | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<CustomerLocation>;
  const commune = communes.find(
    (c) => c.id === v.communeId && c.departmentId === v.departmentId,
  );
  if (!commune) return null;
  return {
    departmentId: commune.departmentId,
    communeId: commune.id,
    ...(typeof v.locality === "string" && v.locality.trim()
      ? { locality: v.locality.trim().slice(0, 100) }
      : {}),
  };
}
export const communeName = (id: string) =>
  communes.find((c) => c.id === id)?.name || "Commune inconnue";
export const departmentName = (id: string) =>
  departments.find((d) => d.id === id)?.name || "Département inconnu";
