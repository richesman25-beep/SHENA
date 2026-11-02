"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./icons";
const items = [
  { href: "/admin", label: "Tableau de bord", icon: "grid" },
  { href: "/admin/products", label: "Produits", icon: "box" },
  { href: "/admin/categories", label: "Catégories", icon: "grid" },
  { href: "/admin/medias", label: "Médias", icon: "image" },
  { href: "/admin/stocks", label: "Stocks", icon: "layers" },
  { href: "/admin/commandes", label: "Commandes", icon: "bag", pending: true },
  { href: "/admin/digital", label: "SHENA Digital", icon: "download" },
  { href: "/admin/clients", label: "Clients", icon: "users", pending: true },
  { href: "/admin/securite", label: "Sécurité", icon: "shield" },
] as const;
export function AdminNavigation() {
  const pathname = usePathname();
  return (
    <nav className="workspace-navigation" aria-label="Administration">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={
            pathname === item.href ||
            (item.href !== "/admin" && pathname.startsWith(item.href + "/"))
              ? "page"
              : undefined
          }
        >
          <Icon name={item.icon} />
          <span>{item.label}</span>
          {"pending" in item && <small>À venir</small>}
        </Link>
      ))}
    </nav>
  );
}
