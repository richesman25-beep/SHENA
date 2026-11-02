-- SIMULATION FACULTATIVE ET DANGEREUSE, À APPROUVER SÉPARÉMENT, NON EXÉCUTÉE.
-- Justification : démontrer en staging isolé la révocation des sept anciens grants,
-- pas seulement tester le maintien d'un staging déjà SELECT-only.
-- Ne pas utiliser comme bootstrap. Ne jamais exécuter sur Production.
-- Version seule : BEGIN/ROLLBACK protègent aussi une exécution isolée.
-- Un assemblage revu peut extraire le corps pour une transaction unique avec tests.
-- Aucun COMMIT intermédiaire : les grants doivent rester invisibles aux autres
-- connexions et être annulés par le ROLLBACK final de l'assemblage approuvé.
BEGIN;
DO $isolated$
BEGIN
 IF current_user<>'postgres' OR current_setting('shena.review_context',true) IS DISTINCT FROM 'staging-reviewed'
 OR current_setting('shena.target_project_ref',true) IS DISTINCT FROM 'prqmomjtmyhqijysfoog'
 OR current_setting('shena.approved_isolated_acl_test',true) IS DISTINCT FROM 'approved' THEN
   RAISE EXCEPTION 'Simulation de grants dangereux bloquée : accord explicite et staging isolé requis'; END IF;
END $isolated$;
-- Unique injection de panne, limitée à products dans le projet de test isolé.
GRANT INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN ON TABLE public.products TO anon,authenticated;
-- Le correctif doit suivre immédiatement dans la même transaction, puis les tests
-- et ROLLBACK. N'appliquer jamais ce fragment seul ou via un éditeur auto-commit.

ROLLBACK;
