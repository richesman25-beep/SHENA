import { geographicRank } from "./logistics";
import type { CustomerLocation } from "./geography";
export const categories = [
  {
    slug: "mode",
    name: "Mode & accessoires",
    short: "Mode",
    mark: "01",
    color: "#e8d6c1",
  },
  {
    slug: "electronique",
    name: "Électronique",
    short: "Tech",
    mark: "02",
    color: "#dce6e4",
  },
  {
    slug: "beaute",
    name: "Beauté & soins",
    short: "Beauté",
    mark: "03",
    color: "#eedbd3",
  },
  {
    slug: "maison",
    name: "Maison & quotidien",
    short: "Maison",
    mark: "04",
    color: "#e7e5d5",
  },
  {
    slug: "numerique",
    name: "Produits numériques",
    short: "Numérique",
    mark: "05",
    color: "#e1dff0",
  },
] as const;
export type Category = string;
export type Product = {
  id: string;
  slug: string;
  name: string;
  category: Category;
  type: "stock" | "preorder" | "digital" | "unknown";
  source?: "supabase";
  stockKnown?: boolean;
  imageUrl?: string;
  createdAt?: string;
  categoryIds?: string[];
  categoryLabel?: string;
  price: number;
  stock: number;
  brand: string;
  image: string;
  description: string;
  details: string[];
  formats?: string;
  size?: string;
  license?: string;
  lead?: string;
  featured?: boolean;
};
export const products: Product[] = [
  {
    id: "sneakers-demo",
    slug: "sneakers-shena-demo",
    name: "Sneakers SHENA",
    category: "mode",
    type: "stock",
    price: 4500,
    stock: 12,
    brand: "SHENA",
    image: "sneakers",
    description:
      "Une silhouette essentielle, des tons naturels et une semelle confortable pour accompagner vos journées.",
    details: [
      "Modèle de démonstration, taille unique 39",
      "Tige textile et empiècements synthétiques",
      "Coloris crème et terre cuite",
    ],
    featured: true,
  },
  {
    id: "headphones-demo",
    slug: "casque-sans-fil",
    name: "Casque sans fil Studio",
    category: "electronique",
    type: "stock",
    price: 3750,
    stock: 8,
    brand: "Studio",
    image: "headphones",
    description:
      "Votre musique vous accompagne, à la maison comme en déplacement.",
    details: [
      "Connexion Bluetooth",
      "Coussinets enveloppants",
      "Câble de charge inclus",
    ],
    featured: true,
  },
  {
    id: "beauty-demo",
    slug: "rituel-douceur",
    name: "Rituel douceur",
    category: "beaute",
    type: "stock",
    price: 2250,
    stock: 6,
    brand: "Essentiel",
    image: "beauty",
    description: "Un duo de soins pour une parenthèse de douceur au quotidien.",
    details: [
      "Coffret de démonstration",
      "Lotion et soin visage",
      "Composition à confirmer avant commercialisation",
    ],
    featured: true,
  },
  {
    id: "bag-demo",
    slug: "sac-quotidien",
    name: "Le sac du quotidien",
    category: "mode",
    type: "preorder",
    price: 3200,
    stock: 0,
    brand: "SHENA",
    image: "bag",
    lead: "Délai fournisseur à confirmer",
    description:
      "Des lignes sobres et un format pratique pour emporter vos essentiels.",
    details: [
      "Coloris sable",
      "Anses longues",
      "Disponibilité fournisseur à confirmer",
    ],
    featured: true,
  },
  {
    id: "planner-demo",
    slug: "planner-essentiel",
    name: "Mon planner essentiel",
    category: "numerique",
    type: "digital",
    price: 650,
    stock: 0,
    brand: "SHENA Digital",
    image: "planner",
    description:
      "Faites de la place à vos idées. Un planner à imprimer pour organiser semaines, projets et priorités.",
    details: [
      "24 pages : semaines, objectifs et notes",
      "Format A4 imprimable",
      "Aucun fichier vendu ou livré dans cette démonstration",
    ],
    formats: "PDF",
    size: "3 Mo (indicatif)",
    license: "Usage personnel uniquement ; redistribution interdite.",
    featured: true,
  },
  {
    id: "home-demo",
    slug: "vase-terra",
    name: "Vase Terra",
    category: "maison",
    type: "stock",
    price: 1850,
    stock: 4,
    brand: "Atelier",
    image: "vase",
    description:
      "Une forme organique et une teinte chaleureuse pour habiller votre intérieur.",
    details: [
      "Céramique mate",
      "Hauteur indicative : 22 cm",
      "Fleurs non incluses",
    ],
    featured: true,
  },
  {
    id: "template-demo",
    slug: "kit-cv-professionnel",
    name: "Le kit CV professionnel",
    category: "numerique",
    type: "digital",
    price: 950,
    stock: 0,
    brand: "SHENA Digital",
    image: "template",
    description:
      "Une mise en page claire pour présenter votre parcours et préparer votre prochaine candidature.",
    details: [
      "Modèle de CV et lettre de motivation",
      "Compatible avec Word",
      "Contenu de démonstration : aucun téléchargement disponible",
    ],
    formats: "DOCX · PDF",
    size: "2 Mo (indicatif)",
    license: "Usage personnel ; aucune revente du modèle.",
  },
  {
    id: "speaker-demo",
    slug: "enceinte-nomade",
    name: "Enceinte nomade",
    category: "electronique",
    type: "preorder",
    price: 2900,
    stock: 0,
    brand: "Studio",
    image: "speaker",
    lead: "Délai fournisseur à confirmer",
    description:
      "Un format compact pour donner le rythme à vos moments de détente.",
    details: [
      "Bluetooth",
      "Format portable",
      "Caractéristiques à confirmer avant vente",
    ],
  },
];
export const money = (value: number) =>
  `${new Intl.NumberFormat("fr-HT", { maximumFractionDigits: 2 }).format(value)} HTG`;
export const typeLabel = (type: Product["type"]) =>
  ({
    stock: "En stock",
    preorder: "Sur commande",
    digital: "Produit numérique",
    unknown: "Type à vérifier",
  })[type];
export type Filters = {
  q?: string;
  category?: string;
  type?: string;
  brand?: string;
  min?: string;
  max?: string;
  availability?: string;
  sort?: string;
  page?: string;
  near?: string;
};
export function filterProducts(
  input: Filters,
  source: Product[] = products,
  location: CustomerLocation | null = null,
) {
  const normalize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const q = normalize(input.q?.trim() || "");
  let found = source.filter(
    (p) =>
      (!q || normalize(`${p.name} ${p.description} ${p.brand}`).includes(q)) &&
      (!input.category ||
        p.category === input.category ||
        p.categoryIds?.includes(input.category)) &&
      (!input.type || p.type === input.type) &&
      (!input.brand || p.brand === input.brand) &&
      (!input.availability ||
        (input.availability === "stock"
          ? p.type === "stock" && p.stock > 0
          : p.type === input.availability)) &&
      (!input.min || p.price >= Number(input.min)) &&
      (!input.max || p.price <= Number(input.max)),
  );
  if (input.near === "1" && location)
    found = found.filter(
      (p) => p.type === "digital" || geographicRank(p, location) === 0,
    );
  if (input.sort === "price-asc")
    found = [...found].sort((a, b) => a.price - b.price);
  if (input.sort === "price-desc")
    found = [...found].sort((a, b) => b.price - a.price);
  if (input.sort === "newest")
    found = [...found].sort((a, b) =>
      a.createdAt && b.createdAt
        ? b.createdAt.localeCompare(a.createdAt)
        : source.indexOf(b) - source.indexOf(a),
    );
  if (location && (!input.sort || input.sort === "nearby"))
    found = [...found].sort(
      (a, b) => geographicRank(a, location) - geographicRank(b, location),
    );
  const pageCount = Math.max(1, Math.ceil(found.length / 6));
  const page = Math.min(
    pageCount,
    Math.max(1, Math.floor(Number(input.page) || 1)),
  );
  return {
    items: found.slice((page - 1) * 6, page * 6),
    total: found.length,
    page,
    pageCount,
  };
}

export function readFilters(
  input: Record<string, string | string[] | undefined>,
): Filters {
  const result: Filters = {};
  for (const key of [
    "q",
    "category",
    "type",
    "brand",
    "min",
    "max",
    "availability",
    "sort",
    "page",
    "near",
  ] as const) {
    const value = input[key];
    if (typeof value === "string") result[key] = value.slice(0, 200);
  }
  return result;
}
