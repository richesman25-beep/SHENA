# Sauvegarder SHENA depuis Windows ou un exécuteur sécurisé

Cette procédure ne modifie pas le schéma, les produits, Auth ou les permissions de Production. La seule opération préparatoire sur Production est la création/renouvellement du rôle temporaire `read_only` déjà autorisée. Aucun script de migration, activation commerciale, fusion ou déploiement n'est appelé. Ne pas lancer cet outil dans le réseau Codex actuellement bloqué : il est prévu pour votre ordinateur ou un runner autorisé.

## Une commande sur Windows

Depuis le checkout de la PR nº 4, avec Python **3.12+** et Docker Desktop démarré :

```powershell
.\scripts\backup\Backup-SHENA.ps1 -ProvisionDestination
```

Le compte AWS doit déjà être authentifié par votre méthode habituelle (SSO, rôle ou gestionnaire sécurisé). Un profil existant peut être choisi avec `-AwsProfile NOM_DU_PROFIL`. Aucun nom de profil ni compte AWS n'est supposé existant. La région proposée est `us-east-2`, comme le projet source ; `-Region` permet de choisir une autre région autorisée.

`-ProvisionDestination` autorise explicitement la création du stockage privé S3 et de la clé AWS KMS via le modèle [destination.json](../scripts/backup/destination.json). Ces ressources sont facturables et restent conservées si la stack est supprimée. Le bucket est privé, bloque les accès publics, refuse le HTTP, conserve les versions et n'a aucune expiration automatique. L'outil ne modifie pas une stack existante pour forcer sa conformité : il s'arrête si les prérequis ne sont pas satisfaits. Il ne supprime aucun objet ni clé.

Si vous disposez déjà des ressources autorisées :

```powershell
.\scripts\backup\Backup-SHENA.ps1 -Bucket NOM_DU_BUCKET_PRIVE -KmsKey ARN_DE_LA_CLE_KMS
```

Le jeton opérateur Supabase est demandé **en saisie masquée sur votre ordinateur** ; il n'est ni enregistré ni passé en argument. Un gestionnaire qui fournit déjà `SUPABASE_ACCESS_TOKEN` au processus évite cette saisie. Ne pas copier ce secret dans le chat, un fichier Git, une commande ou un journal. Le script crée son environnement Python hors dépôt et réutilise les clients PostgreSQL 17 installés ; sinon il utilise les clients officiels dans Docker. Il n'installe aucun service PostgreSQL Windows.

Le wrapper est destiné à Windows PowerShell 5.1 ou PowerShell 7. Respecter la politique d'exécution de votre organisation ; ne pas la désactiver pour lancer ce fichier. Le lecteur de travail doit être privé et chiffré (par exemple BitLocker). Les ACL Windows limitent le répertoire de travail au SID courant ; sous Linux les permissions sont 0700. Ne pas utiliser un dossier synchronisé publiquement ou partagé. Prévoir l'espace du dump, des objets et de la restauration Docker ; l'instance temporaire utilise un tmpfs et nécessite assez de mémoire.

## Ce que la commande fait

1. Installe les dépendances dans `%LOCALAPPDATA%\SHENA\backup-tools`, vérifie les outils, puis identifie le projet **xxadpoebcslutlevzdsy** via l'API officielle. Les hôtes proviennent de Supabase. Connexion directe puis Session Pooler sur **5432**, TLS `verify-full`, certificat vérifié ; aucun Transaction Pooler 6543 ni tunnel détourné.
2. Crée l'accès temporaire déjà approuvé, sélectionne `supabase_read_only_user` et vérifie la lecture seule, l'absence de droits d'écriture/CREATE et le BYPASSRLS nécessaire à une sauvegarde complète. RLS n'est pas désactivé. Un certificat non reconnu, un hôte différent ou un privilège inattendu fait arrêter l'outil.
3. Exporte les rôles sans leurs mots de passe, puis lance **pg_dump custom complet**, sans filtrer les schémas, en conservant propriétaires et ACL. Un snapshot PostgreSQL exporté est partagé avec le dump et l'inventaire de contrôle. Le dump n'est pas limité à products : Auth et Storage PostgreSQL sont inclus si les permissions et extensions le permettent. Une table étrangère ou un refus d'accès exige un plan spécifique, jamais une omission silencieuse.
4. Copie tous les objets de tous les buckets, y compris privés, via l'API Storage officielle. Une clé serveur Storage peut être lue par l'API opérateur si nécessaire ; elle reste en mémoire et n'est jamais exposée au navigateur, à Docker ou à Git. Compare inventaire et tailles après capture ; un changement concurrent de Storage impose de recommencer.
5. Construit une archive avec dump, rôles, catalogues, hashes des lignes et objets. La chiffre en flux **AES-256-GCM** avec une clé de données aléatoire générée par KMS. La clé maîtresse reste dans KMS ; seule la clé de données **enveloppée, indéchiffrable sans KMS**, est dans l'en-tête authentifié. Aucun fichier de clé en clair n'est conservé. Les fichiers temporaires en clair et pgpass sont supprimés à la fin, même en cas d'erreur ; une suppression n'est pas un effacement physique garanti sur SSD.
6. Transfère l'archive chiffrée dans S3, exige un VersionId, relit exactement cette version et compare son SHA256. Le compte propriétaire du bucket et l'état de la clé sont contrôlés. La clé KMS est un service distinct du stockage des archives ; l'accès S3 seul ne suffit pas au déchiffrement. Un rôle de restauration séparé peut recevoir uniquement lecture + déchiffrement.
7. Retélécharge cette version distante, demande le déchiffrement à KMS et restaure dans un conteneur éphémère **sans réseau, sans port publié et sans montage hôte**. Une image Supabase compatible est requise. Le tag est proposé uniquement depuis la version réellement fournie par l'API ; s'il n'existe pas ou manque une extension, l'outil s'arrête. `-RestoreImage IMAGE_VERIFIEE` permet de fournir une image compatible ; son digest est résolu et enregistré. Ne pas choisir une image tierce inconnue.
8. Vérifie toutes les tables inventoriées, nombres de lignes, SHA256 des lignes triées, contraintes, ACL de table/colonnes/fonctions, politiques RLS, fonctions, vues, triggers et versions d'extensions, ainsi que tous les octets Storage restaurés. Tout écart ou erreur pg_restore échoue. Les rôles sont créés **sans login ni privilèges élevés** ; le SQL complet roles.sql n'est pas rejoué aveuglément. Une incompatibilité de rôle système bloque la restauration et exige une adaptation isolée examinée, pas une élévation en Production.

Le rôle temporaire ne dure que cinq minutes. Les clients et images de clients sont préparés avant sa création ; les connexions du dump/roles sont ouvertes avant expiration. Le snapshot reste ouvert jusqu'à la fin. Pour une très grande base, valider le budget de durée/connexions avant cette procédure ; ne pas rallonger les permissions ou renouveler un mot de passe en boucle pour masquer un échec.

## Tester ou reprendre sans tout refaire

Tester seulement les connexions et droits (aucune destination AWS nécessaire) :

```powershell
.\scripts\backup\Backup-SHENA.ps1 -TestConnections
```

Rejouer la restauration depuis une archive déjà conservée, sur une autre machine autorisée, **sans jeton Supabase ni nouveau dump** :

```powershell
.\scripts\backup\Backup-SHENA.ps1 -RestoreReceipt CHEMIN_DU_RECU.json -RestoreImage IMAGE_VERIFIEE
```

Le reçu est hors Git, normalement dans `%LOCALAPPDATA%\SHENA\backups`. Il contient bucket, version, empreinte, ARN KMS et résultats, jamais le jeton, un mot de passe ou une clé en clair. Conserver aussi ce reçu dans votre dossier opérateur privé. Les archives et leurs versions sont dans S3, pas dans les artefacts d'un dépôt public. Garder la clé KMS active, accessible au rôle de restauration et protégée contre sa suppression.

Sur Linux/macOS ou un runner de confiance avec Python 3.12+, Docker et accès directs autorisés : installer les dépendances dans un venv privé puis lancer `python scripts/backup/shena_backup.py` avec les mêmes options en kebab-case (`--provision-destination`, `--aws-profile`, etc.). Aucun secret ne doit être fourni comme option. Le script ne réutilise pas un mot de passe de base intégré à une URL.

## Accès indispensables à accorder une seule fois

- **Exécuteur** : votre Windows ou un runner de confiance, Python 3.12+, Docker et trafic sortant autorisé vers les hôtes officiels Supabase en 5432, APIs Supabase/AWS et registres d'images en HTTPS. Aucun contournement de la politique Codex n'est nécessaire. Sur un runner, utiliser son gestionnaire de secrets approuvé.
- **Supabase** : le jeton opérateur du projet SHENA, avec lecture des métadonnées/pooler, création de l'accès temporaire approuvé et lecture des clés serveur si des buckets privés existent. Le jeton existant est déjà configuré dans Codex ; votre ordinateur doit y accéder par saisie masquée ou votre gestionnaire sécurisé, sans l'inscrire dans GitHub.
- **AWS** : un compte et une identité autorisés. Pour des ressources existantes : `sts:GetCallerIdentity`, lecture des réglages du bucket, `s3:ListBucket`, `s3:PutObject`, `s3:GetObject`, `s3:GetObjectVersion` sur le préfixe `shena-production/*`, et `kms:DescribeKey`, `kms:GenerateDataKey`, `kms:Decrypt` pour la seule clé choisie. Limiter l'usage KMS au contexte `project_ref=xxadpoebcslutlevzdsy`. L'application SHENA n'a besoin d'aucun de ces droits.
- **Provisionnement optionnel** : autorisation de créer la stack CloudFormation `shena-private-backups`, son bucket/politique/versioning/chiffrement/blocage public et sa clé/politique/rotation KMS. Le provisionnement n'est pas exécuté depuis ce chat. À défaut, fournir des ressources déjà autorisées avec les deux options non secrètes ; ne pas accorder des droits administrateur globaux au runner de sauvegarde.

## Ce qui ouvre réellement la suite

Un code de sortie nul confirme les vérifications décrites, **pas une autorisation automatique de migration**. Le rapport garde `migration_gate_open=false` et `storage_service_restore_verified=false` : cette restauration des fichiers ne constitue pas un essai du service Supabase Storage avec ses JWT/RLS. Les attributs/appartenances des rôles système, secrets externes/Vault, intégrations et tests des migrations sur la copie restent à examiner. Si du contenu Vault nécessite une clé fournisseur absente, les lignes SQL restaurées seules ne prouvent pas que les secrets sont récupérables.

Transmettre seulement le reçu sans secrets pour reprendre la mission dans Codex, ou accorder l'accès sécurisé à l'archive et à KMS à l'exécuteur de restauration. Je vérifierai les preuves et compléterai les tests du service Storage et des migrations sur la copie isolée avant toute écriture Production. Les autorisations SQL existantes restent acquises pour les fichiers identiques ; toute modification de script sera soumise à revue. L'ordre reste : ACL products → Admin/deux fondateurs → commandes désactivées → tests → activation seulement avec zones/frais approuvés. Aucun paiement automatique ni téléchargement payant n'est activé par ces outils.
