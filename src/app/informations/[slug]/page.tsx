import { notFound } from "next/navigation";
import type { Metadata } from "next";
const content: Record<
  string,
  { title: string; intro: string; paragraphs: string[] }
> = {
  "a-propos": {
    title: "L’esprit SHENA.",
    intro: "Des essentiels bien choisis. De nouvelles possibilités.",
    paragraphs: [
      "SHENA est un projet de boutique généraliste destiné initialement au marché haïtien. Mode, électronique, beauté, maison et produits numériques y partagent le même espace.",
      "Cette première version présente une expérience de démonstration. Les articles, illustrations, stocks et prix sont fictifs. Aucun achat, compte client ou paiement n’est ouvert.",
      "Les coordonnées commerciales et le service client seront publiés après validation par les fondateurs, avant toute mise en vente.",
    ],
  },
  livraison: {
    title: "Livraison & retours.",
    intro: "Document provisoire à faire valider avant ouverture des ventes.",
    paragraphs: [
      "La livraison de produits physiques est envisagée en Haïti. Les départements et communes desservis, modes de livraison, frais et délais ne sont pas encore arrêtés. Ils devront être affichés avant confirmation de toute commande.",
      "Les articles sur commande nécessiteront une confirmation de disponibilité fournisseur et un délai estimatif distinct. Aucun approvisionnement n’est déclenché par le panier de démonstration.",
      "La procédure de retour, les délais applicables, les exclusions, les frais et les modalités de remboursement restent à définir et à valider. Contact et adresse de retour devront être ajoutés avant lancement. Les produits numériques n’entraînent aucun frais de livraison physique.",
    ],
  },
  numerique: {
    title: "Vos ressources numériques.",
    intro:
      "Conditions provisoires — aucune vente ni livraison de fichiers dans cette version.",
    paragraphs: [
      "Les fiches de démonstration précisent un format, une compatibilité et une licence indicative. Les illustrations sont des aperçus ; aucun fichier payant complet n’est accessible.",
      "La future bibliothèque sera réservée au titulaire du compte après confirmation fiable du paiement. Les fichiers seront conservés dans un stockage privé et servis par des liens temporaires après vérification côté serveur des droits.",
      "Durée d’accès, nombre de téléchargements, mises à jour et conditions de remboursement devront être indiqués avant achat. Aucun droit de redistribution ou de revente n’est accordé par les licences personnelles présentées. Le contenu et les droits de chaque ressource devront être vérifiés avant sa commercialisation.",
    ],
  },
  conditions: {
    title: "Conditions de vente.",
    intro:
      "Projet de texte à faire valider juridiquement avant publication commerciale.",
    paragraphs: [
      "SHENA n’accepte actuellement aucune commande ni aucun paiement. Les prix affichés en gourdes haïtiennes sont des exemples. Les informations légales de l’exploitant, son adresse et ses contacts restent à compléter.",
      "Avant le lancement, ces conditions devront préciser : formation du contrat, prix et taxes, disponibilité, livraison, retours, garanties, réclamations et traitement des litiges.",
      "MonCash, NatCash, virement et prestataire international sont des pistes à étudier. Aucun partenariat ni intégration officielle n’est affirmé. Un paiement ne sera jamais confirmé sur la seule déclaration du navigateur ou sur une capture d’écran.",
    ],
  },
  confidentialite: {
    title: "Confidentialité.",
    intro: "Information provisoire pour cette démonstration.",
    paragraphs: [
      "Cette version ne crée aucun compte client et n’envoie aucune commande à une base de données. Elle conserve les identifiants et quantités du panier ainsi que votre choix manuel de département et de commune dans le stockage local de votre navigateur. Retirez les articles ou effacez les données du site pour les supprimer.",
      "Aucun outil de publicité ou d’analyse d’audience n’est intégré. L’hébergeur peut traiter les données techniques nécessaires au fonctionnement du site selon sa propre configuration.",
      "Avant l’activation des comptes et des ventes, préciser l’identité du responsable de traitement, les finalités, les bases applicables, les destinataires, les durées de conservation, les transferts éventuels et les moyens d’exercer vos droits. Aucune conformité juridique certifiée n’est revendiquée.",
    ],
  },
};
export function generateStaticParams() {
  return Object.keys(content).map((slug) => ({ slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  return {
    title: content[(await params).slug]?.title || "Information introuvable",
  };
}
export default async function Information({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const page = content[(await params).slug];
  if (!page) notFound();
  return (
    <article className="shell legal">
      <span className="eyebrow">SHENA / INFORMATIONS</span>
      <h1>{page.title}</h1>
      <p className="legal-intro">{page.intro}</p>
      {page.paragraphs.map((p) => (
        <p key={p}>{p}</p>
      ))}
    </article>
  );
}
