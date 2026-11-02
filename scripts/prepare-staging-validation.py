"""Produit un SQL de REVUE sans exécution : bootstrap fidèle, ACL et tests admin facultatifs."""
import argparse
from pathlib import Path
from uuid import UUID

ROOT = Path(__file__).resolve().parents[1]
PROPOSALS = ROOT / "docs/proposals"


def body(path: Path) -> str:
    sql = path.read_text()
    import re
    if not sql.rstrip().endswith("ROLLBACK;"):
        raise ValueError(f"ROLLBACK final manquant : {path.name}")
    sql, count = re.subn(r"^BEGIN;\s*$", "", sql, count=1, flags=re.MULTILINE)
    if count != 1:
        raise ValueError(f"BEGIN unique attendu : {path.name}")
    return re.sub(r"ROLLBACK;\s*$", "", sql)


def assemble(mode: str = "acl", accounts: tuple[str, ...] = (), simulate_grants: bool = False) -> str:
    if mode not in ("acl", "admin"):
        raise ValueError("Mode acl ou admin requis.")
    ids = tuple(str(UUID(value)) for value in accounts)
    if mode == "admin" and (len(ids) != 3 or len(set(ids)) != 3):
        raise ValueError("Trois UUID staging distincts requis pour les tests admin.")
    statements = [
        "-- REVUE UNIQUEMENT. Vérifier le vrai projet avant toute exécution approuvée.",
        "BEGIN;",
        "SET LOCAL shena.review_context='staging-reviewed';",
        "SET LOCAL shena.target_project_ref='prqmomjtmyhqijysfoog';",
        "SET LOCAL shena.acl_review_context='products-acl-reviewed';",
        body(PROPOSALS / "staging/00-products-bootstrap-review.sql"),
        # Fixture positive en plus de l'inactive : données synthétiques, même ROLLBACK.
        "INSERT INTO public.products(name,description,price_htg,product_type,stock,active) VALUES('SHENA STAGING — TEST LECTURE ACTIVE','Fixture temporaire de recette uniquement',20,'physical',1,true);",
    ]
    if simulate_grants:
        statements.extend([
            "-- Injection facultative : exige l'approbation distincte ET la variable externe prévue.",
            body(PROPOSALS / "tests/products-acl-unsafe-stage-simulation-review.sql"),
        ])
    patch = body(PROPOSALS / "production-00-products-acl-revoke-reviewed.sql")
    checks = (PROPOSALS / "tests/products-acl-staging.sql").read_text()
    statements.append(patch.replace("-- SHENA_ACL_STAGING_TESTS_HERE", checks))
    if mode == "admin":
        for name, value in zip(("client_id", "admin_a_id", "admin_b_id"), ids):
            statements.append(f"SET LOCAL shena.test_{name}='{value}';")
        migration = body(PROPOSALS / "production-01-admin-reviewed.sql")
        tests = (PROPOSALS / "tests/admin-products-staging.sql").read_text()
        # Tests dans un sous-bloc : leurs mutations Auth/fixtures sont annulées avant
        # d'éventuelles extensions revues du protocole, puis tout est encore ROLLBACK.
        tests = "SAVEPOINT admin_test_cases;\n" + tests + "\nROLLBACK TO SAVEPOINT admin_test_cases;\nRELEASE SAVEPOINT admin_test_cases;"
        statements.append(migration.replace("-- SHENA_STAGING_TESTS_HERE", tests))
    statements.append("ROLLBACK;")
    return "\n".join(statements) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode", choices=("acl", "admin"), default="acl")
    parser.add_argument("--client-id")
    parser.add_argument("--admin-a-id")
    parser.add_argument("--admin-b-id")
    parser.add_argument("--simulate-original-grants", action="store_true")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    accounts = tuple(value for value in (args.client_id, args.admin_a_id, args.admin_b_id) if value)
    try:
        result = assemble(args.mode, accounts, args.simulate_original_grants)
    except ValueError as error:
        parser.error(str(error))
    with args.output.open("x") as target:
        target.write(result)
    print(f"Fichier de revue créé : {args.output}. Aucun SQL exécuté.")
    if args.simulate_original_grants:
        print("Simulation dangereuse bloquée sans approbation distincte ; ne jamais la valider hors transaction staging.")


if __name__ == "__main__":
    main()
