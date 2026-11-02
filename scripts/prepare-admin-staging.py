"""Assemble un fichier de revue staging. Ne se connecte à aucune base et n'exécute rien."""
import argparse
from pathlib import Path
from uuid import UUID

ROOT = Path(__file__).resolve().parents[1]
SQL = ROOT / "docs/proposals/production-01-admin-reviewed.sql"
TESTS = ROOT / "docs/proposals/tests/admin-products-staging.sql"
MARKER = "-- SHENA_STAGING_TESTS_HERE"


def assemble(client_id: str, admin_a_id: str, admin_b_id: str) -> str:
    identities = [str(UUID(value)) for value in (client_id, admin_a_id, admin_b_id)]
    if len(set(identities)) != 3:
        raise ValueError("Trois UUID distincts du projet staging sont nécessaires.")
    proposal = SQL.read_text()
    if proposal.count(MARKER) != 1 or not proposal.rstrip().endswith("ROLLBACK;"):
        raise ValueError("Marqueur unique et ROLLBACK final requis.")
    settings = ["SELECT set_config('shena.review_context','staging-reviewed',false);"]
    for name, value in zip(("client_id", "admin_a_id", "admin_b_id"), identities):
        settings.append(f"SELECT set_config('shena.test_{name}','{value}',false);")
    return "\n".join(settings) + "\n" + proposal.replace(MARKER, TESTS.read_text())


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--client-id", required=True)
    parser.add_argument("--admin-a-id", required=True)
    parser.add_argument("--admin-b-id", required=True)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    try:
        result = assemble(args.client_id, args.admin_a_id, args.admin_b_id)
    except ValueError as error:
        parser.error(str(error))
    # 'x' refuse d'écraser un fichier existant. Aucun mot de passe/URL/clé demandé.
    with args.output.open("x") as output:
        output.write(result)
    print(f"Fichier de revue créé : {args.output}. Aucune requête exécutée.")


if __name__ == "__main__":
    main()
