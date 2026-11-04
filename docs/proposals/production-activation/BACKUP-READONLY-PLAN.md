# Sauvegarde SHENA : exécuteur Windows ou runner autorisé

La destination active est désormais **Google Drive privé via rclone**, sans AWS/S3/KMS ni service payant supplémentaire. Les anciens outils AWS n'ont créé aucune ressource réelle pendant leur développement et sont remplacés. Le guide exécutable est [SAUVEGARDE-WINDOWS.md](../../SAUVEGARDE-WINDOWS.md).

1. Autoriser Google avec `scripts/backup/Backup-SHENA.ps1 -AuthorizeDrive` sur votre ordinateur. Dossier neuf non partagé, portée limitée drive.file ; clé aléatoire conservée dans le coffre OS, jamais dans Drive.
2. L'outil identifie le projet Production, crée le rôle temporaire read_only déjà approuvé, vérifie ses droits et utilise pg_dump complet en snapshot. Il sauvegarde séparément tous les octets Storage et refuse les changements concurrents.
3. Chiffrement AES-256-GCM avant transfert, nouveau chemin UUID, contrôle du propriétaire et des permissions Google, refus d'écrasement et relecture par identifiant + hash.
4. Restauration PostgreSQL et fichiers depuis la copie Drive, dans une instance Docker sans réseau ni port. Comparaison des données, ACL/RLS/catalogues et checksums. Une erreur fait arrêter l'outil sans toucher à Production.
5. Examen des preuves, essais du service Supabase Storage et de ses droits, vérification des clés externes et essais des migrations sur la copie avant toute installation persistante. Aucun paramètre SQL d'attestation n'est généré automatiquement.

L'accès temporaire autorisé reste la requête officielle suivante, sans reset du mot de passe postgres ni modification manuelle de rôle système :

```http
POST https://api.supabase.com/v1/projects/xxadpoebcslutlevzdsy/cli/login-role
Content-Type: application/json

{"read_only":true}
```

Pour GitHub Actions, le workflow privé ne peut démarrer qu'après configuration des accès dans son coffre de secrets chiffrés distinct de Drive. L'intégration Codex actuelle refuse leur gestion ; le lanceur peut les configurer automatiquement depuis un GitHub CLI local déjà autorisé, sans fichier secret dans Git et sans fusion. Il ne contourne aucun refus d'accès.

Aucune archive Drive réelle ni restauration Production n'est encore validée. Les copies locales précédentes restent des preuves partielles et éphémères. Les tests de l'outillage utilisent des données synthétiques et ne modifient pas Production.
