# Validation locale — sprint STAGING

Aucune requête SQL ni modification sur Supabase Production. Aucun test Supabase distant n'est déclaré réussi.

| Contrôle                                         | Résultat                            |
| ------------------------------------------------ | ----------------------------------- |
| TypeScript                                       | Réussi                              |
| ESLint                                           | Réussi                              |
| Tests locaux TypeScript et PostgreSQL en mémoire | 73 réussis, 1 ignoré volontairement |
| Revue statique SQL/PLpgSQL avec pglast 7.22      | 14 réussis                          |

Le test ignoré réserve l'exécution du correctif ACL final (MAINTAIN compris) exclusivement à SHENA-STAGING après reproduction fidèle, conformément à la demande du propriétaire. L'analyse statique n'applique aucun SQL.

Contrôles complémentaires réussis : formatage, build Next.js, 13 parcours publics de démonstration, 3 parcours publics sans configuration Supabase et **19 parcours admin/commandes** sur fixture HTTPS locale isolée. Contrôle distant STAGING : bloqué avant connexion, clé publique dédiée absente.

## Portée des modèles locaux

PGlite exécute PostgreSQL localement en mémoire pour les modèles admin, Storage et commandes. Les rôles, auth.users, claims et tables Storage sont des représentations synthétiques isolées, sans compte ou donnée Production. Ces tests couvrent user_metadata inefficace, deux admins, CRUD protégé, contraintes, zones, montants recalculés, stock, idempotence, annulation, refus de paiement direct et double revue.

Le script `scripts/test-admin.mjs` teste les routes, formulaires, Server Actions et le SDK normal sur une fixture HTTPS isolée. Le transport intercepte uniquement l'origine STAGING connue vers loopback et interdit les connexions externes. Certificat éphémère approuvé, TLS jamais désactivé ; mots de passe générés pour la fixture, aucun compte réel créé. Les nouveaux parcours commande utilisent le modèle PostgreSQL local ; Auth et Storage HTTP restent simulés. Les configurations générées sont restaurées après le test.

Ces modèles ne valident ni le projet Supabase réel, ni son PostgREST, ses JWT, ses buckets HTTP, SMTP, Realtime ou sauvegardes. Les métadonnées Production sont celles transmises par le propriétaire. L'application des migrations distantes reste en attente de revue et d'accord.

Le build et les parcours publics sont exécutés avec les variables Supabase explicitement vides. La Preview exige l'origine STAGING exacte et des réglages explicites ; ses paramètres Vercel externes ne sont pas configurés par ce test.

Résultats complémentaires de build et navigateur : voir le rapport final de la PR et `docs/SPRINT-MVP-STAGING.md`. Les captures locales dans test-results sont ignorées par Git et ne contiennent que des fixtures.
