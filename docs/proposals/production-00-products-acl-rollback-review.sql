-- RETOUR ARRIÈRE DOCUMENTÉ UNIQUEMENT — BLOQUÉ ET NON EXÉCUTÉ.
-- Les anciens grants sont maintenant connus : directs postgres, sans grant option.
-- Les rétablir rouvrirait notamment TRUNCATE, non protégé par RLS.
-- Préférer une réparation ciblée conservant les privilèges dangereux interdits.
BEGIN;
DO $blocked$ BEGIN
 RAISE EXCEPTION 'Retour arrière dangereux : nouvelle approbation explicite et plan de confinement requis. Rien n a été rétabli.';
END $blocked$;
-- Candidat exact pour les seuls privilèges retirés, SI explicitement approuvé :
-- exécution par postgres, avant toute migration admin, état courant réinventorié.
-- Aucun changement de SELECT, d'ACL de colonne, de PUBLIC ou de rôle système.
-- GRANT INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN
--   ON TABLE public.products TO anon,authenticated;
-- Pas de WITH GRANT OPTION : is_grantable=false dans le relevé d'origine.
ROLLBACK;
