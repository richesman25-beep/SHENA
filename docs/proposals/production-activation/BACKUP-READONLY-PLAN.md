# Sauvegarde : étape préalable, non exécutée pour PostgreSQL

Le jeton Management API fonctionne pour les lectures projet/SQL/Auth/config/backups. Cela ne prouve pas ses permissions d'écriture. Aucune sauvegarde PostgreSQL disponible n'a été trouvée. Les requêtes SELECT de métadonnées ne sont pas un dump.

Une archive Storage AES-256-GCM existe localement hors Git : un bucket, un objet, métadonnées et manifeste SHA256, inventaire stable avant/après. Déchiffrement et comparaison des octets restaurés réussis. La clé est dans un fichier privé séparé. Pas de copie indépendante durable, pas de restauration du service Storage : ne pas déclarer la sauvegarde globale vérifiée.

## Autorisation proposée pour débloquer pg_dump

Requête exacte, **non envoyée** :

```http
POST https://api.supabase.com/v1/projects/xxadpoebcslutlevzdsy/cli/login-role
Content-Type: application/json

{"read_only":true}
```

Authentification : jeton opérateur déjà sécurisé, jamais copié dans le fichier. Ce point d'accès beta crée un rôle de connexion temporaire et renvoie rôle, mot de passe et TTL. Il constitue une modification de rôle Production et exige donc l'accord explicite du propriétaire. Ne pas le présenter comme une simple lecture. Risques : capacité de lecture sensible, durée d'expiration, éventuelles limites RLS/ACL ; vérifier les privilèges avant utilisation. Aucun mot de passe postgres réinitialisé, aucun rôle système modifié manuellement.

Après accord : examiner le rôle retourné, obtenir l'hôte de connexion réellement fourni par Supabase, utiliser un fichier pgpass privé hors Git. Ne pas placer le mot de passe dans les arguments, journaux ou navigateur. PostgreSQL client 17 compatible avec le serveur 17.11. Enregistrer versions, cible, début/fin, erreurs et code de sortie du dump. Aucun CREATE/ALTER source via SQL ; session et transaction de sauvegarde en lecture seule.

Commandes de principe (variables opérateur sans valeur inventée, non exécutées) :

```sh
pg_dump --format=custom --file="$SHENA_BACKUP_DIR/database.dump" --dbname="$SHENA_BACKUP_CONNECTION"
pg_dumpall --roles-only --no-role-passwords --file="$SHENA_BACKUP_DIR/roles.sql" --dbname="$SHENA_BACKUP_CONNECTION"
pg_restore --list "$SHENA_BACKUP_DIR/database.dump" > "$SHENA_BACKUP_DIR/database-toc.txt"
```

SHENA_BACKUP_CONNECTION doit exclure le mot de passe ; pgpass le fournit. Le dump garde les propriétaires et ACL. Un refus d'accès, notamment Auth, rôles ou schémas gérés, invalide la qualification « complète ». Ne pas continuer en masquant les erreurs ni substituer une exportation products à la sauvegarde du projet. Les clés API, secrets Vault, mots de passe des rôles système et configurations externes nécessitent leur propre plan de récupération sécurisé ; ne pas les écrire en clair dans des rapports.

## Restauration isolée et preuves à obtenir

Restaurer dans une instance Supabase/PostgreSQL compatible isolée, sans emails, webhook, cron, paiements ni exposition publique. Provisionner uniquement les rôles/ extensions compatibles nécessaires : ne pas rejouer aveuglément les rôles système de Production. Restaurer le dump avec arrêt sur erreur ; vérifier schémas, données, contraintes, séquences, fonctions, ACL et RLS. Réconcilier les inventaires et tester anon/client/deux admins sur cette copie. Restaurer les octets Storage dans un service isolé et vérifier contenu, noms, confidentialité et politiques ; ne pas recopier les fichiers dans Production.

Produire ensuite un manifeste signé/contrôlé avec empreintes et résultats, chiffrer base et Storage, conserver une copie privée durable autorisée et la clé séparément. Ni checksums seuls, ni copie de fichiers seule, ni paramètre SQL déclaratif ne valident une restauration. Ne positionner aucune attestation backup_restore_verified tant que cette procédure n'a pas réussi et été examinée.

## Destination durable privée proposée — non provisionnée

Prévoir un stockage objet privé hors du projet Supabase source, dans un compte marchand autorisé : accès public entièrement bloqué, TLS obligatoire, versioning activé et politique de rétention protégeant le point de restauration avant migration. Les comptes de l'application et les clés publiques Supabase n'y ont aucun accès. Le compte de sauvegarde peut écrire et vérifier uniquement le préfixe dédié ; la suppression et la récupération des clés sont réservées à un autre accès opérateur. Définir la rétention avant toute règle automatique de suppression. Ne pas créer de bucket payant ni choisir un compte externe à la place du propriétaire.

Chiffrer chaque archive PostgreSQL/Storage côté client avec une clé AES-256-GCM aléatoire, puis contrôler le SHA256 après transfert et relecture distante. Ne jamais joindre la clé à l'archive ni à son manifeste. Conserver cette clé dans un gestionnaire de secrets distinct du stockage de sauvegarde, avec contrôle d'accès et procédure de récupération ; aucun mot de passe ou clé dans Git, les logs CI ou le navigateur. Le chiffrement serveur du stockage est complémentaire. Tester la récupération de la clé et le déchiffrement depuis l'environnement de restauration avant de déclarer ce prérequis satisfait.

Aucune destination durable ni identité d'accès correspondante n'est actuellement configurée dans cet environnement. Les fichiers /tmp existants et la clé séparée sont des artefacts locaux éphémères ; ils ne constituent pas la conservation indépendante demandée. Une destination privée autorisée et son accès sécurisé sont nécessaires avant tout transfert. Ne pas demander de recopier des secrets dans le chat.

## Validation finale exigée avant le premier script persistant

- Dump complet terminé sans erreur, couvertures PostgreSQL et Auth vérifiées et limites documentées ; rôles et extensions réconciliés, sans mots de passe système exportés.
- Stockage durable relu et déchiffré depuis une machine isolée, avec clé récupérée séparément ; tous les objets Storage rapprochés de leur inventaire.
- Restauration réelle de la base et du service Storage compatible réussie, incluant les refus d'accès anon/client et les accès des deux comptes administrateurs sur la copie. Aucune restauration par écrasement de Production.
- Manifeste et preuves examinés ; seulement ensuite, accord nominatif du propriétaire sur l'empreinte SHA256 de chaque script persistant. Une CI verte seule ne constitue pas cette validation.
