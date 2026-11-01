# feat: créer la première boutique SHENA et son département numérique

Le dépôt initial ne contient aucun code ni branche distante. Cette première version apporte une vitrine Next.js en français, des pages catalogue et produits, un département numérique et un panier local persistant avec données de démonstration clairement signalées.

L’interface utilise une identité vert profond/crème et des illustrations SVG originales. Le catalogue combine recherche, filtres, tri et pagination. Les produits physiques et numériques sont distingués ; aucune commande, confirmation de paiement ou livraison de fichier n’est simulée.

La configuration Supabase est préparée avec le contrat exact de public.products et un .env.example sans valeurs. Aucune connexion ni migration n’est effectuée. Documentation : design, architecture future, sécurité et déploiement Vercel. Les phases suivantes nécessitent autorisation.

## Validation

Les résultats réellement exécutés sont consignés dans docs/validation.md.

## Revue

Vérifier le design, les libellés de démonstration et le périmètre. Ne pas fusionner automatiquement. Une PR GitHub nécessite une branche de base distante ; le dépôt étant initialement vide, elle doit être établie avant ouverture d’une PR comparable.
