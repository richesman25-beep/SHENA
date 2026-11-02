"""Prépare uniquement l'attribution de rôle à deux comptes EXISTANTS et vérifiés."""
import argparse
import importlib.util
from pathlib import Path
import re

spec = importlib.util.spec_from_file_location("activation", Path(__file__).with_name("prepare-production-activation.py"))
activation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(activation)

def prepare(a: str, b: str) -> str:
    emails = [a.strip().lower(), b.strip().lower()]
    if emails[0] == emails[1] or any(not re.fullmatch(r"[^\s@'\\]+@[^\s@'\\]+\.[^\s@'\\]+", x) or len(x)>254 for x in emails):
        raise ValueError("Deux emails distincts à confirmer par le propriétaire requis")
    values = ",".join("'" + x.replace("'", "''") + "'" for x in emails)
    return """-- NON EXÉCUTÉ. Données nominatives : ne pas commettre le fichier généré dans Git.
-- Aucune création de compte, invitation email ou validation d'email simulée.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
""" + activation.guard("05-founders") + f"""
DO $founders$ DECLARE ids uuid[];distinct_emails integer;verified integer; BEGIN
 IF current_setting('shena.founder_identities_verified',true) IS DISTINCT FROM 'yes' THEN RAISE EXCEPTION 'Identité des fondateurs et propriété des comptes à vérifier avant attribution'; END IF;
 SELECT array_agg(id),count(DISTINCT lower(email)),count(*) FILTER(WHERE email_confirmed_at IS NOT NULL)
 INTO ids,distinct_emails,verified FROM(SELECT id,email,email_confirmed_at FROM auth.users WHERE lower(email) IN({values}) ORDER BY id FOR UPDATE) locked;
 IF cardinality(ids) IS DISTINCT FROM 2 OR distinct_emails<>2 OR verified<>2
 THEN RAISE EXCEPTION 'Deux comptes réels distincts et emails vérifiés requis'; END IF;
 IF EXISTS(SELECT 1 FROM auth.users WHERE id=ANY(ids) AND raw_app_meta_data IS NOT NULL AND jsonb_typeof(raw_app_meta_data)<>'object') THEN RAISE EXCEPTION 'Métadonnées Auth non conformes : aucune correction automatique'; END IF;
 UPDATE auth.users SET raw_app_meta_data=COALESCE(raw_app_meta_data,'{{}}'::jsonb)||'{{"shena_role":"admin"}}'::jsonb
 WHERE id=ANY(ids) AND raw_app_meta_data->'shena_role' IS DISTINCT FROM '"admin"'::jsonb;
END $founders$;
COMMIT;
"""

def main() -> None:
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--admin-a-email",required=True)
    p.add_argument("--admin-b-email",required=True)
    p.add_argument("--output",type=Path,required=True)
    a=p.parse_args()
    if a.output.resolve().is_relative_to(Path(__file__).resolve().parents[1]):p.error("Fichier nominatif hors du dépôt Git requis")
    try: content=prepare(a.admin_a_email,a.admin_b_email)
    except ValueError as e: p.error(str(e))
    with a.output.open("x",opener=lambda path,flags: __import__('os').open(path,flags,0o600)) as f: f.write(content)
    print("Fichier nominatif privé créé pour revue ; aucune requête exécutée ni invitation envoyée.")

if __name__ == '__main__': main()
