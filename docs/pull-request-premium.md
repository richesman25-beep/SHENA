# Reconstruire SHENA avec une identité premium et des disponibilités multivilles

La vitrine précédente répétait ses compositions et ne permettait pas de choisir un lieu de réception. Cette version introduit une campagne visuelle composée, la palette bleu/corail demandée, Manrope locale et un accueil aux sections variées : univers, nouveautés, proximité, tech, mode/beauté, maison et SHENA Digital.

Le client choisit manuellement département/commune, mémorisé sur son appareil. Le catalogue privilégie les stocks fictifs de sa commune puis du département ; le filtre « Disponible près de moi » et le mode toute Haïti restent distincts. Les fiches présentent les origines et quantités de démonstration ; faute de règle, elles indiquent « Livraison et tarif à confirmer ». Le panier propose seulement une simulation multiville. Le numérique reste sans transport physique.

Les fiches physiques ont une seconde vue générée. SHENA Digital propose dix entrées thématiques et prépare une bibliothèque indisponible. Un atelier public de simulation permet d'examiner l'interface de gestion des stocks sans modifier le catalogue ni Supabase.

Les propositions SQL et le plan de transition de products.stock sont dans docs/proposals/, hors migrations exécutables. Aucun schéma, donnée, politique RLS, identifiant ou accès Supabase n'est modifié. Pas de paiement, transport, réservation ni téléchargement réel. Les conditions de couverture géographique et les visuels générés sont documentés.

Validation : voir docs/premium-validation.md. Comparaison avec feat/shena-marketplace-redesign. Aucune fusion automatique ni commande de déploiement.
