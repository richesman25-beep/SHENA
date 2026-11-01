# Identité visuelle SHENA — refonte marketplace

La refonte remplace l’identité éditoriale vert/crème par une interface e-commerce bleu nuit (`#172f54`), orange (`#f57928`), blanc et gris clair (`#f4f6f9`). Les titres utilisent la même famille sans empattement que le reste de l’interface ; les prix et actions sont plus visibles. L’orange est associé à du texte foncé pour garder une bonne lisibilité.

Le header regroupe logo, recherche centrale et sélecteur de catégorie, compte et favoris explicitement indisponibles, et panier fonctionnel avec compteur. La barre d’annonce et les univers numériques sont centralisés dans `src/lib/storefront.ts` ; aucune offre promotionnelle fictive n’est introduite.

L’accueil est plus dense : menu de rayons sur grand écran, campagne principale, deux campagnes secondaires, catégories illustrées, nouveautés, sélection éditoriale et sections par rayon. Les sélections ne sont pas présentées comme des statistiques de ventes ou des classements de popularité. Les rayons avec peu de références restent courts plutôt que de dupliquer des produits ou d’inventer du stock. Sur mobile, les rayons de produits et catégories défilent horizontalement par geste tactile ou navigation clavier dans les liens.

## Visuels et optimisation

`public/products/studio-collection.png` est une planche originale générée pour SHENA, sans logo de marque, comportant six vues studio réalistes. Ce ne sont pas des photos d’articles réellement disponibles. Le composant `ProductVisual` utilise un recadrage CSS cohérent et Next Image pour servir les variantes optimisées, le cache et le chargement différé ; les visuels principaux sont prioritaires. Une seule source locale est partagée, sans dépendance à un domaine tiers. Les couvertures numériques sont composées en HTML/CSS avec un texte accessible et représentent uniquement des aperçus.

La galerie permet une vue standard et une vue rapprochée de la même image, sans prétendre fournir des angles supplémentaires inexistants. Les images et stocks restent indiqués comme démonstration. Les anciennes illustrations SVG sont conservées dans le dépôt mais ne servent plus à l’affichage produit. Avant commercialisation, remplacer les visuels générés par des photographies validées des articles réels, et les couvertures par celles des ressources réellement détenues.

## SHENA Digital

Identité secondaire violette, couvertures graphiques, badges « Numérique », format, taille, licence et prix. Six entrées thématiques (e-books/guides, Canva, Word/Excel, formations, planners, éducation/ressources) orientent vers la recherche. Le catalogue indique explicitement qu’il ne contient que deux exemples ; les rubriques sans résultat affichent un état vide et un moyen de réinitialiser les filtres. Aucun achat ni téléchargement n’est simulé.

## Cohérence et accessibilité

Les fiches, catalogue, panier, documents et footer partagent palette, cartes, rayons de bordure et typographie. Labels de champs, focus visible, lien d’évitement et annonces du panier sont conservés. Les boutons d’ajout ne sont pas imbriqués dans les liens produits. Les contrôles de galerie exposent leur état avec aria-pressed. Les effets se limitent à de légers changements de couleur/ombre et sont réduits avec prefers-reduced-motion. Les tests navigateur vérifient le débordement mobile et les parcours critiques ; ils ne remplacent pas un audit d’accessibilité complet.
