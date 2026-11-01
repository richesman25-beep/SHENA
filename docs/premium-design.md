# Direction artistique premium et multiville

## Évaluation et reconstruction

La version précédente répétait les mêmes rayons et le même fond, et la grande majorité des interactions ne tenait pas compte de la commune du client. Cette version reconstruit l'accueil : header bleu, logotype avec symbole, campagne photo composée, tuiles de six univers, nouveautés, zone de proximité, destination tech, duo mode/beauté, portail digital, maison/logistique et produits sur commande. Les proportions, fonds, cartes et compositions varient selon la section.

Palette demandée : bleu #183B8C, corail #FF6B45, bleu clair #EAF2FF, blanc #FFFFFF, gris #F5F7FB, anthracite #202938 et vert de disponibilité #16865D. La police Manrope variable est hébergée localement, issue de Fontsource 5.3.0, avec licence SIL OFL conservée sous public/fonts/. Aucun service de fontes externe ni nouvelle dépendance applicative n'est requis. Le style partagé antérieur est conservé dans globals.css et la couche premium dans premium.css, importée après lui.

Les boutons corail structurent les campagnes et le bloc d'achat ; les boutons bleus servent les cartes. Le vert signale une disponibilité géographique positive de démonstration. Aucun pourcentage, prix barré ou avis n'est inventé. Le badge et les textes précisent le caractère fictif des produits et des stocks.

## Visuels

La nouvelle campagne `campaign-premium.png` est une composition studio générée pour SHENA. Elle illustre les univers, pas une offre groupée ni des variantes commercialisées. Les produits utilisent la planche studio locale existante et une seconde planche `studio-alternate.png` pour les autres vues des fiches. Ces visuels générés ne prouvent ni la possession de marchandises ni la conformité exacte à des articles réels.

Next Image sert les variantes optimisées et le cache ; la campagne et la vue principale sont prioritaires, les autres visuels sont chargés à la demande. Les recadrages de planche restent en CSS. Les couvertures numériques sont des compositions HTML/CSS, pas des fichiers payants exposés.

## Parcours géographique et numérique

Le header expose une sélection manuelle, complétée par une barre sur mobile/tablette et un accès dans les filtres. Le dialogue utilise le comportement modal natif, des labels explicites, Escape et retour du focus. Il est rendu hors des formulaires catalogue pour éviter les soumissions parasites ou formulaires imbriqués.

La fiche présente une galerie à plusieurs visuels pour les produits physiques, un aperçu pour le numérique, les origines publiables et les modalités inconnues. Sur mobile, le bloc d'achat reste collant lorsqu'il atteint la zone visible. Les variantes existantes sont affichées sans inventer de choix : une seule pointure ou un seul coloris de démonstration.

SHENA Digital possède une bannière propre, dix entrées thématiques, des fiches avec format/taille/licence/compatibilité et un accès à la future bibliothèque. Deux produits d'exemple restent disponibles ; les catégories sans contenu affichent un état vide. Aucun compte, paiement ou téléchargement sécurisé n'est prétendu opérationnel.

## Validation prévue et limites

Les captures et résultats exécutés sont décrits dans le rapport de cette intervention. Les fonctionnalités de localisation sont locales ; la couverture géographique est partielle. Les conditions commerciales, le référentiel de production et les photographies réelles restent à valider avant lancement. Les migrations proposées ne sont pas appliquées. Aucun audit juridique ou certification d'accessibilité n'est revendiqué.
