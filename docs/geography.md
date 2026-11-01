# Géographie et logistique — contrat de démonstration

## Référentiel

La démo utilise les dix départements et un sous-ensemble manuel de seize communes connues. Département et commune sont deux entités distinctes ; ni quartier ni point de stockage n'est une commune. Les identifiants sont des slugs internes et **ne sont pas des codes officiels**. Aucun fichier officiel complet n'a été importé ni vérifié automatiquement dans cette intervention.

Référence institutionnelle visée pour l'import de production : [Haïti — limites administratives, OCHA COD-AB / CNIGS sur HDX](https://data.humdata.org/dataset/cod-ab-hti). Avant extension, télécharger la version officielle autorisée, consigner date/version, licence et empreinte, rapprocher les codes et noms des communes de ceux des départements, traiter les changements de limites et valider avec l'exploitant. Ne pas compléter ce référentiel avec des quartiers ou des noms devinés. La démo affiche sa couverture partielle ; l'absence d'une commune dans la liste n'est pas une exclusion commerciale de cette commune.

Le sélecteur couvre Ouest (Port-au-Prince, Pétion-Ville, Delmas), Nord (Cap-Haïtien, Limbé), Nord-Est (Fort-Liberté), Nord-Ouest (Port-de-Paix), Centre (Hinche, Maïssade, Mirebalais), Artibonite (Gonaïves, Saint-Marc), Sud (Les Cayes), Sud-Est (Jacmel), Grand'Anse (Jérémie) et Nippes (Miragoâne). Localité/quartier pourra devenir un champ optionnel distinct ; il n'est pas requis dans cette démo et aucune adresse n'est demandée.

## Modèle local

`geography.ts` valide la cohérence commune/département ; `logistics.ts` contient cinq points de stock explicitement fictifs, sans adresse, et une répartition des quatre produits en stock qui conserve leurs totaux actuels (12, 8, 6 et 4). Les produits sur commande n'ont pas de stock attribué ; les produits numériques n'ont ni stockage géographique, ni transporteur, ni frais de livraison physique.

Le classement par défaut est ordinal : stock positif dans la même commune, puis dans le même département, puis autres communes, numérique, sur commande, rupture. Il ne calcule aucune distance, durée de trajet ou couverture transporteur. Un tri de prix ou nouveauté explicite garde la priorité sur ce classement. Le filtre « Disponible près de moi » conserve les produits physiques avec stock dans la commune et les numériques (clairement distingués). Il est indisponible sans choix valide. Le mode toute Haïti retire la restriction géographique ; il conserve la préférence de réception tant que le client ne l'efface pas dans le sélecteur.

Le choix est stocké sous `shena.location.v1` sur l'appareil ; il est validé à la lecture. Un changement de département remet la commune à zéro. Aucun appel GPS, calcul routier ou requête Supabase n'est effectué. Les liens catalogue conservent recherche/filtrage/pagination ; la préférence géographique reste locale et ne fait pas partie d'un lien partagé. L'ordre local est appliqué après hydratation du navigateur.

## Livraison

Le tableau de règles est vide : aucune adresse de retrait, frais, délai ou disponibilité d'un partenaire n'est inventé. Les trois modes affichés sont **envisagés**, pas activés. La présence d'un stock dans une autre ville n'implique pas une livraison possible vers la commune choisie. Le libellé de repli est « Livraison et tarif à confirmer ». Une future règle doit relier un point d'origine, une commune ou zone de destination, un mode et un partenaire validé, avec un tarif et un délai optionnels explicitement inconnus lorsque NULL.

Le panier peut montrer une allocation fictive sur plusieurs points, dans l'ordre de proximité administrative, sans réservation, création de colis ou total de transport définitif. Le numérique est exclu de cette simulation. Une référence sur commande reste sans allocation en stock. Les lignes non attribuables sont signalées, jamais assimilées à un colis réel.

## Administration

`/gestion-stocks-demo` est un atelier **public de simulation**, pas une route admin réelle. Il permet de créer un point fictif, répartir les stocks et mettre un point à zéro ; toutes les modifications restent dans la mémoire de la page, ne changent pas le catalogue et disparaissent au rechargement. Les produits numériques ne figurent pas dans le choix des stocks physiques. Les zones/tarifs sont documentés comme non configurés. Aucune donnée client ou information privée n'y figure.

Avant une administration réelle : Supabase Auth SSR, rôle d'administrateur vérifié côté serveur et RLS, contrôle de chaque action, audit, validation des données et gestion de concurrence. Le prototype n'accorde aucun droit dans le projet existant.
