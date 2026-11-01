# Configurer la connexion existante et préparer l'administration

## Variables manquantes constatées

Les métadonnées de configuration cloud, les noms de variables du processus et les fichiers .env locaux ont été examinés sans imprimer de valeurs : NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY étaient absentes. Aucune connexion réelle, lecture de Sneakers SHENA, sauvegarde ou inspection des politiques du projet n'a donc pu être confirmée.

Les deux exigences de variables publiques sont enregistrées dans le brouillon Codex ; aucune valeur n'a été inventée. Il n'est pas nécessaire d'ajouter une clé service_role ni un secret Supabase au navigateur.

## Vercel

Dans le projet SHENA, ouvrir Settings → Environment Variables. Ajouter les valeurs du **projet Supabase SHENA existant** :

- NEXT_PUBLIC_SUPABASE_URL : Project URL HTTPS depuis Supabase → Project Settings / API ou Connect.
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY : clé publique publishable. Une ancienne clé anon est acceptée si son rôle est anon. Ne jamais utiliser une clé secret ou service_role.
- SHENA_CATALOG_MODE : live, ou omettre (live est la valeur par défaut). demo est réservé à une Preview volontairement identifiée et aux tests, jamais à l'exploitation réelle.

Sélectionner les environnements Preview/Production appropriés et **redéployer** : les variables NEXT_PUBLIC sont intégrées au build et les anciennes instances ne reçoivent pas automatiquement les changements. Ne pas committer .env.local. Le domaine donné par le propriétaire est https://shena-azure.vercel.app/ ; vérifier le domaine effectivement déployé avant de configurer Site URL dans Supabase Auth. La connexion par mot de passe ne repose sur aucun callback arbitraire ni redirection fournie par l'utilisateur.

## Environnement Codex

Dans les paramètres d'environnement, renseigner les deux noms publics enregistrés dans le brouillon avec les valeurs exactes de SHENA. Enregistrer les paramètres, puis publier l'environnement si l'interface le demande. Le brouillon seul ne modifie pas le processus actuel. Créer/reconnecter une tâche ou redémarrer le serveur après injection des valeurs.

Le réseau de l'instance est restreint. Ajouter le **hostname exact** de NEXT_PUBLIC_SUPABASE_URL aux destinations autorisées (sans https://, chemin ou clé), ainsi que le domaine Storage s'il est distinct. Le hostname du projet n'étant pas connu ici, aucune destination Supabase n'a été inventée et aucun joker global n'est nécessaire. Le brouillon conserve api.github.com pour la création de PR ; son application au runtime doit aussi être confirmée.

Pour un poste local : copier .env.example vers .env.local ignoré, renseigner les valeurs publiques et lancer npm run dev. Aucun fichier .env.local contenant de vraies valeurs n'est créé par l'agent. Ne jamais envoyer les valeurs en chat ou les ajouter à un rapport.

## Vérifications en lecture seule après configuration

1. Lancer npm run dev avec le mode live, consulter /boutique et vérifier les seuls produits actifs.
2. Vérifier que Sneakers SHENA apparaît s'il est actif, avec son UUID et ses données réelles. Le produit local de même nom n'est pas une preuve de connexion.
3. Tester recherche, filtres et fiche ; vérifier qu'un produit inactif n'est pas lisible anonymement. Vérifier également l'accès direct REST sous RLS, pas seulement l'interface.
4. Examiner les valeurs réelles et contraintes de product_type avant de créer un nouveau produit. Les types inconnus sont affichés comme à vérifier et bloquent l'ajout au panier. Aucune contrainte existante n'est modifiée pour faire passer un formulaire.
5. Examiner erreurs/réseau/RLS en cas d'échec. Une erreur ne déclenche aucun retour automatique aux fixtures.

## Administrateur réel

Créer ou identifier un utilisateur réel dans Supabase Authentication via un canal sécurisé, sans mot de passe partagé dans le code. Faire attribuer **côté serveur** app_metadata.shena_role=admin à son UUID par le propriétaire via l'API d'administration/Dashboard approprié, après vérification du compte. Ne jamais mettre ce rôle dans user_metadata ni rendre une fonction d'auto-promotion publique. Aucun UUID ni compte fictif n'est fourni dans le projet.

Avant les politiques proposées, le rôle peut permettre l'ouverture de l'espace serveur mais pas les écritures : le RPC manque et RLS peut ne laisser lire que les produits actifs. Après approbation, sauvegarde vérifiée et application contrôlée des propositions, le RPC confirme les fonctionnalités installées. Tester compte admin, compte client et utilisateur anonyme séparément. Vérifier une révocation effective du rôle et les accès REST directs.

Les actions serveur conservent les contrôles d'origine de Next.js. Vérifier les limites Supabase Auth et la protection contre les tentatives répétées, configurer la politique de mot de passe et l'authentification renforcée adaptée avant exploitation. Les connexions et téléversements réels restent à tester ; le code préparé n'est pas une certification de sécurité.

## Déploiement et limites

Aucun déploiement manuel ni fusion n'est réalisé par cette mission. La branche peut déclencher une Preview selon votre configuration Vercel, non vérifiée ici. Les paiements et commandes sont volontairement indisponibles. Ne pas appliquer une proposition SQL simplement pour faire disparaître un avertissement dans l'interface : chaque modification de schéma ou politique exige votre accord préalable.

### Attribution du rôle : opération manuelle distincte à examiner

Si l'interface Supabase ne permet pas de modifier les métadonnées applicatives, un opérateur habilité peut préparer l'opération ci-dessous dans le SQL Editor, **uniquement après vérification du compte réel, sauvegarde adaptée et autorisation**. L'agent ne l'a pas exécutée. Remplacer le marqueur par l'UUID du compte réel choisi ; ne pas attribuer le rôle sur la seule base d'un e-mail transmis par un navigateur. L'expression préserve les autres métadonnées et ne crée aucun utilisateur :

```sql
-- Proposition d'attribution, pas une migration à exécuter en lot.
-- Examiner d'abord le compte réel ciblé dans Authentication / Users.
UPDATE auth.users
SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                       || jsonb_build_object('shena_role', 'admin')
WHERE id = '<UUID_REEL_CONFIRME>'::uuid;
-- Vérifier qu'une seule ligne attendue a été modifiée et consigner l'opération.
```

Pour révoquer, retirer uniquement la clé shena_role du même compte, avec le même contrôle et audit, puis vérifier l'accès serveur et les accès REST après révocation. Les politiques proposées relisent cette donnée côté base. Aucune clé d'administration n'a besoin d'être ajoutée au code de l'application pour cette attribution manuelle.
