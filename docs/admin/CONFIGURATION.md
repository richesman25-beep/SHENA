# Configuration et mise en service contrôlée

## Variables

| Variable                             | Où                     | Valeur à obtenir                                                                                             |
| ------------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| NEXT_PUBLIC_SUPABASE_URL             | Vercel + Codex         | URL du projet SHENA dans Supabase → Project Settings → API                                                   |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Vercel + Codex         | Clé publique publishable de ce même projet, jamais service_role / sb_secret_                                 |
| SHENA_SITE_URL                       | Serveur Vercel + Codex | `https://shena-2go5.vercel.app` pour ce déploiement ; origine exacte du domaine définitif lors du changement |
| SHENA_CATALOG_MODE                   | Serveur                | `live` ; `demo` réservé aux revues explicitement signalées                                                   |

Vercel → projet SHENA → Settings → Environment Variables : renseigner les variables pour les environnements réellement voulus, puis reconstruire le déploiement après validation de la PR. Les variables NEXT_PUBLIC sont intégrées au build. Ne pas donner à une Preview inconnue un accès administrateur de production.

Codex → configuration de l’environnement → variables : mêmes noms. Autoriser en réseau l’hôte exact de l’URL Supabase, en conservant les domaines GitHub existants. Le brouillon réseau préparé n’a pas été publié. Les secrets restent dans le gestionnaire de variables, jamais dans les fichiers suivis. `.env.example` n’inclut aucune clé réelle. Le code n’a besoin d’aucune clé secrète serveur pour l’administration.

## Authentification et deux fondateurs

1. Dans Supabase Auth, conserver deux utilisateurs réels distincts, avec adresses vérifiées. Aucun compte n’est créé par ce code.
2. Vérifier l’identité de chaque fondateur hors du navigateur et relever son UUID depuis le tableau de bord sécurisé. Ne jamais attribuer le rôle sur une simple adresse reçue dans une requête publique.
3. Avec un opérateur déjà autorisé via Dashboard/Admin API, ajouter `shena_role: admin` aux **app_metadata** en préservant les autres propriétés. Jamais aux user_metadata. Consigner acteur/date/UUID/justification dans un journal d’exploitation protégé ; aucune clé Admin dans l’application.
4. Répéter séparément pour le deuxième fondateur, puis vérifier les comptes sans rôle, une session expirée et un rôle révoqué. Ne pas partager de mot de passe. Utiliser des mots de passe distincts et la protection MFA du compte Supabase opérateur. MFA applicatif/AAL2 reste un renforcement futur, pas une protection revendiquée ici.
5. Après approbation/application des politiques SQL, chaque fondateur se connecte à `/admin/connexion`. Sans capacités confirmées, le tableau de bord indique les écritures verrouillées.

## Récupération de mot de passe

Supabase → Authentication → URL Configuration : définir Site URL sur l’origine de production et autoriser exactement `https://shena-2go5.vercel.app/admin/auth/callback` (adapter au domaine définitif). Éviter les wildcards de production.

Pour un lien utilisable aussi depuis un autre appareil, examiner le modèle **Reset Password** et utiliser le flux token-hash serveur :

```html
<a
  href="{{ .SiteURL }}/admin/auth/confirm?token_hash={{ .TokenHash }}&type=recovery"
  >Réinitialiser mon mot de passe</a
>
```

Le flux PKCE `/admin/auth/callback?code=…` est aussi pris en charge et nécessite le navigateur qui a demandé le lien. Les callbacks ignorent toute destination `next`, vérifient à nouveau l’utilisateur et son rôle, et ne renvoient pas le jeton dans une page. La nouvelle valeur doit contenir 12 à 128 caractères et être confirmée. Le changement tente une déconnexion globale. Tester délivrabilité SMTP, expiration, lien à usage unique et refus du non-admin dans une Preview contrôlée avant mise en service. Aucun e-mail de production n’a été envoyé pendant le développement.

## Stockage

Réutiliser `product-images`, déjà public. Ne pas changer ses fichiers, sa visibilité ni ses règles automatiquement. Les uploads JPEG/PNG/WebP passent par validation serveur et conversion WebP, 2 Mo maximum ; un nouvel objet est ajouté, l’ancien conservé. Le bucket doit accepter image/webp ; les limites doivent être comparées au préflight.

Les propositions créent `digital-quarantine` et `digital-products` **privés uniquement s’ils n’existent pas** ; en cas de conflit, arrêter et adapter le script. Le serveur dépose uniquement des PDF de 2 Mo en quarantaine, sans analyse antivirus revendiquée, sans URL publique ni lien signé client. Ressources graphiques, formations et logiciels peuvent être décrits dans les métadonnées ; les formats ZIP/Office/EPUB sont préparés mais non activés par le manifeste SQL livré. Aucun exécutable n’est accepté.

Le nouveau registre de médias n’importe pas les anciens fichiers automatiquement. La suppression des médias existants reste verrouillée. La suppression future exige réservation transactionnelle et absence de référence, mais `mediaDelete` reste faux jusqu’au contrôle réel des politiques, des références externes et des tests Storage en staging.

## Déploiement après validation

Examiner la PR, effectuer les prérequis SQL ci-dessous en staging, tester les deux comptes, puis décider de fusionner et déployer sur Vercel. Aucun merge ni déploiement n’est effectué par cette mission. Vérifier `/admin`, produits, images, récupération, erreurs réseau et refus d’accès en navigation privée. Les commandes/paiements restent désactivés.
