-- PROPOSITION NON EXÉCUTÉE. Extension disponible 1.6.4 et préchargée au 2026-11-03.
-- Pas d'activation des commandes, pas de tâche planifiée créée ici.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
DO $approval$ BEGIN
 IF current_user<>'postgres'
 OR current_setting('shena.target_project_ref',true) IS DISTINCT FROM 'xxadpoebcslutlevzdsy'
 OR current_setting('shena.approved_script',true) IS DISTINCT FROM '07-pg-cron'
 OR current_setting('shena.backup_restore_verified',true) IS DISTINCT FROM 'yes'
 OR COALESCE(current_setting('shena.backup_manifest_sha256',true),'') !~ '^[a-f0-9]{64}$'
 THEN RAISE EXCEPTION 'Accord spécifique et restauration vérifiée requis'; END IF;
 IF EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_cron')
 OR NOT EXISTS(SELECT 1 FROM pg_available_extension_versions WHERE name='pg_cron' AND version='1.6.4')
 OR NOT ('pg_cron'=ANY(regexp_split_to_array(current_setting('shared_preload_libraries'),'\s*,\s*')))
 THEN RAISE EXCEPTION 'État pg_cron différent du relevé : arrêt'; END IF;
END $approval$;
CREATE EXTENSION pg_cron VERSION '1.6.4';
REVOKE ALL ON SCHEMA cron FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA cron FROM PUBLIC,anon,authenticated;
-- Version de revue seulement ; version persistante distincte à approuver ensuite.
ROLLBACK;
