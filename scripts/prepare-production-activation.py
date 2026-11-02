"""Écrit des scripts SQL persistants POUR REVUE. Aucun pilote SQL ni réseau."""
from pathlib import Path
import argparse
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "docs/proposals/production-activation/persistent"
SOURCES = {
    "00-products-acl": "docs/proposals/production-00-products-acl-revoke-reviewed.sql",
    "01-admin": "docs/proposals/production-01-admin-production-candidate.sql",
    "02-commerce": "docs/proposals/production-activation/02-commerce-review.sql",
    "02-storage-acl": "docs/proposals/production-activation/02-storage-acl-review.sql",
    "03-storage": "docs/proposals/production-activation/03-storage-review.sql",
    "04-digital-delivery": "docs/proposals/production-activation/04-digital-delivery-review.sql",
}

def guard(name: str) -> str:
    if name not in SOURCES and name not in ("05-founders", "06-enable-commerce"):
        raise ValueError("Nom de script inconnu")
    return f"""DO $approval$ BEGIN
 IF current_user<>'postgres'
 OR current_setting('shena.target_project_ref',true) IS DISTINCT FROM 'xxadpoebcslutlevzdsy'
 OR current_setting('shena.review_context',true) IS DISTINCT FROM 'production-reviewed'
 OR current_setting('shena.approved_script',true) IS DISTINCT FROM '{name}'
 OR current_setting('shena.backup_restore_verified',true) IS DISTINCT FROM 'yes'
 OR COALESCE(current_setting('shena.backup_manifest_sha256',true),'') !~ '^[a-f0-9]{{64}}$'
 THEN RAISE EXCEPTION 'Accord de ce script, cible et restauration DB + Storage vérifiés requis'; END IF;
END $approval$;"""

def prepare(name: str) -> str:
    source = (ROOT / SOURCES[name]).read_text()
    if not source.rstrip().endswith("ROLLBACK;"):
        raise ValueError("Source de revue sans ROLLBACK final")
    body, count = re.subn(r"^BEGIN;\s*$", "", source, count=1, flags=re.MULTILINE)
    if count != 1:
        raise ValueError("BEGIN unique attendu")
    body = re.sub(r"ROLLBACK;\s*$", "", body)
    body = '\n'.join(line for line in body.splitlines() if not (line.lstrip().startswith('--') and re.search(r'ROLLBACK|COMMIT|STAGING|version de revue|Version de revue', line)))
    digest = hashlib.sha256(source.encode()).hexdigest()
    return (f"-- INSTALLATION PERSISTANTE PROPOSÉE : {name}. NON EXÉCUTÉE.\n"
            f"-- Source préservée : {SOURCES[name]} ; SHA256 {digest}\n"
            "-- Ne pas exécuter sans revue du fichier exact et approbation explicite.\n"
            "-- Les paramètres sont des attestations opérateur, pas une preuve de restauration.\n"
            "-- Aucun script applicatif/build n'exécute ce fichier.\nBEGIN;\n"
            "SET LOCAL lock_timeout='3s';\nSET LOCAL statement_timeout='60s';\n"
            + guard(name) + "\nSET LOCAL shena.acl_review_context='products-acl-reviewed';\n"
            + body + "\n-- Version persistante DISTINCTE : les fichiers de revue gardent ROLLBACK.\nCOMMIT;\n")

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if not args.check:
        DEST.mkdir(parents=True, exist_ok=True)
    for name in SOURCES:
        path = DEST / (name + ".sql")
        content = prepare(name)
        if args.check:
            if not path.exists() or path.read_text() != content:
                raise SystemExit("Script à régénérer : " + name)
        else:
            path.write_text(content)
    manifest = {"project_ref": "xxadpoebcslutlevzdsy", "proposed_not_executed": True, "files": {name + ".sql": hashlib.sha256(prepare(name).encode()).hexdigest() for name in SOURCES}}
    content = json.dumps(manifest, indent=2) + "\n"
    path = DEST / "manifest.json"
    if args.check:
        if not path.exists() or path.read_text() != content:
            raise SystemExit("Manifeste à régénérer")
    else:
        path.write_text(content)
    print("Fichiers SQL de revue persistante vérifiés/préparés. Aucun SQL exécuté.")

if __name__ == "__main__":
    main()
