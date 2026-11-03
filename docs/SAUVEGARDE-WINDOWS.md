# Sauvegardes gratuites : Google Drive + coffre séparé

Les outils `scripts/backup/` utilisent désormais **rclone et Google Drive**. Aucun compte AWS, S3, KMS, abonnement supplémentaire ou création de ressource payante. Le stockage utilise votre quota Drive existant ; s'il est plein, le transfert échoue sans supprimer d'ancienne sauvegarde ni acheter d'espace.

## Autorisation Google initiale

Depuis le checkout de la PR nº 4, sur votre Windows avec Python 3.12+ et Docker Desktop démarré :

```powershell
.\scripts\backup\Backup-SHENA.ps1 -AuthorizeDrive
```

Le lanceur installe ses dépendances hors Git et réutilise rclone s'il est installé ; sinon il télécharge le binaire officiel et vérifie le SHA256 publié en HTTPS. Il ouvre l'autorisation Google dans votre navigateur. Choisir votre compte et autoriser **rclone** à accéder seulement aux fichiers utilisés/créés par l'application (`drive.file`), pas à l'ensemble des documents Drive. Aucun code OAuth à envoyer dans le chat. Le script crée un dossier personnel neuf `SHENA encrypted backups`, sans partage, et vérifie qu'il n'a que son propriétaire. Aucun ancien fichier/dossier n'est supprimé, partagé ou déplacé.

Après l'autorisation, la sauvegarde locale puis sa restauration isolée sont lancées. Le jeton Supabase déjà autorisé est lu du gestionnaire sécurisé du processus ou du coffre Windows ; seulement s'il n'y est pas encore disponible localement, il est demandé en saisie masquée et mémorisé dans ce coffre. Le jeton configuré dans Codex n'est pas exporté par les outils dans votre ordinateur. Il n'est jamais passé en argument ni enregistré dans Git. Aucune commande SQL manuelle n'est demandée.

Pour les exécutions suivantes, aucune nouvelle autorisation Google tant que son jeton de renouvellement reste valide :

```powershell
.\scripts\backup\Backup-SHENA.ps1
```

## Chiffrement et séparation des secrets

La clé maîtresse aléatoire de 256 bits est conservée dans **Gestionnaire d'identifiants Windows**, distinct de Google Drive. macOS Keychain ou Linux Secret Service sont aussi acceptés ; un backend de fichier plaintext est refusé. La configuration OAuth est également conservée dans ce coffre, en fragments de taille compatible Windows, et matérialisée seulement dans un répertoire temporaire privé pendant l'exécution. Le jeton Google est renouvelé automatiquement par rclone.

Chaque sauvegarde utilise une nouvelle clé de données et un nonce aléatoires. L'archive est chiffrée localement en flux AES-256-GCM. La clé de données est elle-même enveloppée par AES-GCM sous la clé maîtresse, avec contexte projet + identifiant de sauvegarde. Seule cette clé **chiffrée** accompagne l'archive ; la clé maîtresse n'est jamais transférée vers Drive. Ne pas remplacer cette clé par un mot de passe humain faible.

Le coffre Windows doit rester récupérable : en conserver une sauvegarde sécurisée ou une copie de la clé dans un coffre gratuit indépendant tel que KeePassXC sur un support hors Drive. **Perdre le coffre et toutes ses copies rend les archives indéchiffrables.** Le programme ne publie pas une clé de secours et ne suppose pas que la sauvegarde du profil Windows est déjà activée. L'option Actions ci-dessous conserve une copie dans son coffre de secrets chiffrés, également distinct de Drive. Les appartenances et accès aux coffres doivent rester limités aux opérateurs autorisés.

## Sauvegarde et contrôles automatiques

- Identifie SHENA Production `xxadpoebcslutlevzdsy`, teste connexion directe puis **Session Pooler 5432** en TLS `verify-full`, sans Transaction Pooler ni contournement du réseau Codex. Clients PostgreSQL 17 natifs ou Docker officiels. Les outils sont préparés avant la création de l'accès temporaire de cinq minutes déjà autorisé.
- Sélectionne le rôle read_only, vérifie l'absence d'écriture/CREATE et le BYPASSRLS nécessaire à la lecture de toutes les lignes. Aucun RLS n'est désactivé. Une incohérence de rôle interrompt le programme.
- Exporte les rôles sans leurs mots de passe et un **pg_dump custom complet**, sans filtre de schéma, avec snapshot exporté partagé avec l'inventaire des données. Auth et les métadonnées Storage sont incluses si les permissions et extensions le permettent ; un refus n'est jamais masqué.
- Télécharge les objets de tous les buckets Supabase, privés compris. La clé serveur Storage éventuellement nécessaire reste en mémoire et n'est jamais fournie au navigateur ni à Git. Taille et inventaire avant/après sont comparés. Un changement concurrent impose un nouveau passage.
- Chiffre avant tout transfert, utilise un nouveau chemin UUID, refuse l'écrasement et vérifie que dossier et archive ne sont pas partagés, y compris avec un second utilisateur. Aucun `sync`, `delete`, lien public ou changement des permissions Google. Drive n'est pas un stockage WORM : le propriétaire peut supprimer ses fichiers ; le hash authentifié et l'identifiant Drive détectent une substitution.
- Retélécharge depuis Drive et compare SHA256, vérifie l'enveloppe AES-GCM, les chemins de l'archive et chaque fichier, puis restaure PostgreSQL dans un conteneur **sans réseau, port publié ni montage hôte**. L'image Supabase compatible est résolue depuis la version réelle et son digest enregistré. En cas d'image/extension incompatible, arrêt et possibilité de reprendre avec `-RestoreImage IMAGE_VERIFIEE`.
- Compare tables, lignes, hashes, contraintes, ACL, RLS, fonctions, vues, séquences et event triggers. L'adaptation limitée des rôles fournisseur s'applique uniquement à cette instance isolée ; aucun rejeu aveugle de roles.sql, aucun rôle inconnu élevé automatiquement. Vérifie aussi les octets de chaque fichier Storage restauré.

Les fichiers temporaires en clair et les configurations OAuth sont hors Git, avec ACL Windows limitées au SID courant ou permissions Unix 0700, et supprimés à la fin. Le disque de travail doit être privé et chiffré, par exemple BitLocker. Le tmpfs de restauration Docker doit disposer d'assez de mémoire. Une suppression n'est pas un effacement physique garanti sur SSD ; sur un runner éphémère, sa destruction complète est la dernière protection.

Un reçu privé est écrit dans `%LOCALAPPDATA%\SHENA\backups`. Il contient empreinte, identifiants Drive et résultats, jamais jeton, mot de passe ou clé en clair. Ne pas le commettre. Pour reprendre une restauration à partir de la copie Drive existante, sans nouveau dump ni accès Production :

```powershell
.\scripts\backup\Backup-SHENA.ps1 -RestoreReceipt CHEMIN_DU_RECU.json -RestoreImage IMAGE_VERIFIEE
```

La même clé doit être accessible depuis le coffre séparé de la machine de restauration. Sur Linux/macOS, installer les dépendances dans un venv privé et utiliser `python scripts/backup/shena_backup.py` avec les mêmes options en kebab-case.

## GitHub Actions, sans archive ni secret publié

Le workflow `.github/workflows/production-backup-drive.yml` est préparé pour un runner Ubuntu standard. Dans un dépôt public, il utilise les capacités gratuites standard de GitHub Actions ; aucun runner payant ou élargissement de quota n'est demandé. Le job vérifie que ses accès privés sont présents **avant toute requête Production**. Il teste lui-même la connectivité Supabase via le code commun et s'arrête si elle manque. Aucun artefact de backup, dump ou reçu n'est envoyé à GitHub ; uniquement l'archive chiffrée est envoyée au dossier Drive privé.

Depuis votre ordinateur, si votre GitHub CLI est déjà authentifié avec le droit d'écrire les secrets du dépôt, une seule commande autorise Google et configure le runner :

```powershell
.\scripts\backup\Backup-SHENA.ps1 -AuthorizeDrive -ConfigureGitHub
```

Le programme transmet par **stdin** à `gh secret set` les trois valeurs `SHENA_RCLONE_CONFIG_B64`, `SHENA_BACKUP_MASTER_KEY` et `SUPABASE_ACCESS_TOKEN`. Ce sont des secrets chiffrés du coffre GitHub Actions, pas des fichiers Git, des logs ni des artefacts publics. La clé est donc dans un coffre distinct de Drive. Rien n'est copié manuellement dans une variable ou un YAML. Le programme n'ouvre pas une nouvelle connexion GitHub ou ne contourne pas un refus de permission.

Après cette configuration, il crée un commit **vide**, sans fichier ni secret, sur la branche existante `feat/shena-production-activation`, portant le marqueur `[shena-backup-run]`. Cela déclenche le workflow avant toute fusion dans main. La mise à jour est fast-forward uniquement, jamais forcée ; un changement concurrent de branche provoque un échec sûr. Les pushes ordinaires, forks et PR ne déclenchent aucune sauvegarde Production. Après une fusion ultérieure autorisée, le bouton `workflow_dispatch` sera également disponible sur la branche par défaut. Aucun planning n'est activé à votre insu.

L'intégration GitHub actuellement accessible depuis Codex a refusé la gestion des secrets (`403`) ; le workflow n'est donc **pas présenté comme activé**. La commande sur votre ordinateur réutilise votre autorisation GitHub locale existante si elle possède les droits nécessaires. Si elle est absente ou refusée, aucun secret n'est exposé et aucune sauvegarde distante n'est déclenchée ; le flux local Drive reste utilisable. Les jetons Google peuvent être révoqués par Google ou par le propriétaire ; seule une révocation/expiration du renouvellement impose une nouvelle autorisation Google.

## Limite de validation avant les migrations

Aucun outil de cette procédure n'exécute une migration, ne fusionne une PR, ne publie Vercel et n'active une commande, un paiement ou un téléchargement. Le rapport conserve `migration_gate_open=false` et distingue `database_restore_verified`, `storage_bytes_restore_verified` et `storage_service_restore_verified` (ce dernier reste faux tant que le service Supabase Storage isolé et ses JWT/RLS ne sont pas réellement testés). Les clés externes/Vault et les appartenances système exigent aussi examen. Un reçu ou une CI sur données synthétiques ne prouve pas une restauration Production.

L'autorisation Google n'a pas encore été accordée dans cette session : aucun transfert réel vers votre Drive ni sauvegarde Production n'est certifié. Après une exécution réelle, les preuves seront examinées et les tests du service isolé complétés avant de reprendre les migrations déjà autorisées, avec empreintes inchangées. Une modification de script SQL exigera la revue supplémentaire déjà prévue.
