# Validation de cette branche

Contrôles exécutés localement le 2 novembre 2026, sans écriture sur Supabase de production.

| Contrôle              | Résultat                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| npm run format:check  | Réussi                                                                                                  |
| npm run lint          | Réussi                                                                                                  |
| npm run typecheck     | Réussi                                                                                                  |
| npm test              | 43 tests réussis                                                                                        |
| npm run build         | Build Next.js de production réussi                                                                      |
| npm run test:e2e      | 13 parcours publics de démonstration réussis                                                            |
| npm run test:e2e:live | 3 parcours sans configuration réussis : pas de faux catalogue, admin verrouillé, proximité indisponible |
| npm run test:admin    | 14 parcours d’intégration réussis sur fixture HTTPS locale isolée                                       |

Le build public et les deux suites publiques ont été lancés avec les deux variables Supabase explicitement vides, pour vérifier les états non configurés sans dépendre du projet distant. Cela ne modifie pas les variables enregistrées de l’environnement ni celles de Vercel.

## Intégration administrateur

Le script `scripts/test-admin.mjs` démarre Next dans `.next-admin-test`, avec le SDK Supabase habituel dirigé uniquement vers un serveur HTTPS sur loopback. Un certificat éphémère est approuvé explicitement ; la vérification TLS n’est jamais désactivée. Identifiants, sessions et données sont générés uniquement pour ce service en mémoire. Aucun mot de passe privilégié n’est intégré à l’application. Les variables publiques réelles sont remplacées dans le processus enfant, les fichiers générés tsconfig/next-env sont restaurés en fin de test, et les certificats temporaires supprimés. Ne pas modifier les fichiers de configuration ni lancer un second serveur de test pendant ce script.

Parcours vérifiés : accès anonyme protégé ; non-admin portant user_metadata.shena_role refusé ; connexion admin et cookies HttpOnly/SameSite ; compteurs depuis les lignes de test ; création ; modification prix/stock et conflit de révision ; publication et archivage sans suppression ; image falsifiée refusée puis PNG réencodé WebP ; PDF en quarantaine sans lien client ; recherche et aperçu ; navigation à 390 px sans débordement ; demande de récupération ; contrat de refus Storage privé et écritures non autorisées ; révocation du rôle avant une action ; callback de récupération avec destination fixe et changement de mot de passe ; déconnexion.

Captures locales générées (ignorées par Git) : `test-results/admin-desktop.png` et `test-results/admin-mobile.png`. Elles utilisent uniquement des données de test identifiées comme telles.

## Limites explicites

La fixture vérifie les formulaires, routes, Server Actions et appels SDK ; **elle n’exécute pas PostgreSQL ni les politiques RLS réelles**. Les refus de Storage dans cette suite sont ceux du contrat simulé du service local. Les requêtes publiques du SDK et la validation des fichiers sont aussi testées séparément au niveau unitaire.

Les migrations SQL sont des propositions non exécutées, non validées par une application sur PostgreSQL/Supabase dans cette session. Les fonctionnalités dépendant du manifeste v2 (catégories, galerie, registre, métadonnées) demandent une recette réelle en staging après accord. La suppression des médias et les uploads autres que PDF restent verrouillés par le manifeste proposé.

Aucun test de connexion aux comptes fondateurs, de CRUD réel, de politique RLS/Storage distante, de délivrabilité SMTP ou de restauration de sauvegarde ne peut être déclaré réussi ici. Le réseau actif bloque encore le domaine Supabase ; le brouillon permettant cet hôte n’a pas été publié. Aucun compte fondateur n’a été créé, aucun e-mail de production envoyé, aucun produit/image supprimé, aucune migration exécutée, aucun paiement ni commande réelle démarré.
