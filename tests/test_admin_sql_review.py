"""Analyse STATIQUE seulement : aucun pilote SQL, réseau ou moteur de base."""
import importlib.util
import json
from pathlib import Path
import unittest
from pglast import parse_sql, parse_plpgsql, ast

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("prepare_admin_staging", ROOT / "scripts/prepare-admin-staging.py")
prepare = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare)


class SqlReviewTests(unittest.TestCase):
    def test_postgres_syntax(self):
        for relative in (
            "docs/proposals/staging/04-storage-capabilities-review.sql",
            "docs/proposals/tests/products-acl-unsafe-stage-simulation-review.sql",
            "docs/proposals/staging/02-storage-review.sql",
            "docs/proposals/staging/03-commerce-review.sql",
            "docs/proposals/production-01-admin.sql",
            "docs/proposals/production-01-admin-production-candidate.sql",
            "docs/proposals/production-01-admin-reviewed.sql",
            "docs/proposals/production-01-admin-inventory.sql",
            "docs/proposals/tests/admin-products-staging.sql",
        ):
            with self.subTest(file=relative):
                self.assertTrue(parse_sql((ROOT / relative).read_text()))

    def test_production_candidate_is_gated_and_remains_rollback(self):
        text = (ROOT / "docs/proposals/production-01-admin-production-candidate.sql").read_text()
        statements = parse_sql(text)
        self.assertTrue(parse_plpgsql(text))
        self.assertEqual(statements[-1].stmt.kind.name, "TRANS_STMT_ROLLBACK")
        self.assertNotIn("TRANS_STMT_COMMIT", [getattr(getattr(s.stmt, "kind", None), "name", None) for s in statements])
        self.assertIn("production-reviewed", text)
        self.assertIn("shena.backup_restore_verified", text)
        self.assertNotIn("SHENA_STAGING_TESTS_HERE", text)

    def test_plpgsql_syntax(self):
        # Vérifie aussi les corps DO et PL/pgSQL, sans les évaluer.
        for relative in ("docs/proposals/production-01-admin-reviewed.sql", "docs/proposals/tests/admin-products-staging.sql"):
            with self.subTest(file=relative):
                self.assertTrue(parse_plpgsql((ROOT / relative).read_text()))

    def test_assembly_remains_rollback(self):
        result = prepare.assemble("11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333")
        statements = parse_sql(result)
        self.assertEqual(statements[-1].stmt.kind.name, "TRANS_STMT_ROLLBACK")
        self.assertNotIn("TRANS_STMT_COMMIT", [getattr(getattr(s.stmt, "kind", None), "name", None) for s in statements])
        self.assertNotIn(prepare.MARKER, result)

    def test_elevated_function_surface(self):
        functions = [s.stmt for s in parse_sql(prepare.SQL.read_text()) if isinstance(s.stmt, ast.CreateFunctionStmt)]
        elevated = []
        for fn in functions:
            options = {o.defname: o.arg for o in fn.options}
            if options["language"].sval == "sql":
                self.assertTrue(all(isinstance(s.stmt, ast.SelectStmt) for s in parse_sql(options["as"][0].sval)))
            if options["security"].boolval:
                elevated.append(fn.funcname[-1].sval)
                self.assertFalse(fn.parameters)
            self.assertEqual(options["set"].name, "search_path")
            self.assertEqual([a.val.sval for a in options["set"].args], ["pg_catalog", "pg_temp"])
        self.assertEqual(elevated, ["shena_is_admin"])

    def test_no_dangerous_table_grants(self):
        grants = [s.stmt for s in parse_sql(prepare.SQL.read_text()) if isinstance(s.stmt, ast.GrantStmt) and s.stmt.is_grant and s.stmt.objtype.name == "OBJECT_TABLE"]
        self.assertTrue(grants)
        for grant in grants:
            roles = [r.rolename for r in grant.grantees]
            self.assertFalse(grant.grant_option)
            for privilege in grant.privileges:
                self.assertIn(privilege.priv_name, ["select", "insert", "update"])
                self.assertTrue(privilege.cols, "Aucun grant implicite sur les futures colonnes")
                if privilege.priv_name != "select":
                    self.assertEqual(roles, ["authenticated"])
                if privilege.priv_name == "update":
                    self.assertNotIn("id", [c.sval for c in privilege.cols])
                    self.assertNotIn("created_at", [c.sval for c in privilege.cols])

    def test_restrictive_guards_remain_on_both_write_commands(self):
        policies = [s.stmt for s in parse_sql(prepare.SQL.read_text()) if isinstance(s.stmt, ast.CreatePolicyStmt) and not s.stmt.permissive]
        self.assertEqual({p.cmd_name for p in policies}, {"insert", "update"})
        for policy in policies:
            self.assertEqual([r.rolename for r in policy.roles], ["authenticated"])
            self.assertIsNotNone(policy.with_check)
            if policy.cmd_name == "update":
                self.assertIsNotNone(policy.qual)

    def test_confirmed_staging_bootstrap_is_exact_and_rls_precedes_grant(self):
        sql = (ROOT / "docs/proposals/staging/00-products-bootstrap-review.sql").read_text()
        statements = parse_sql(sql)
        self.assertTrue(parse_plpgsql(sql))
        self.assertEqual(statements[-1].stmt.kind.name, "TRANS_STMT_ROLLBACK")
        tables = [s.stmt for s in statements if isinstance(s.stmt, ast.CreateStmt)]
        self.assertEqual(len(tables), 1)
        columns = [c for c in tables[0].tableElts if isinstance(c, ast.ColumnDef)]
        self.assertEqual([c.colname for c in columns], ["id","created_at","name","description","price_htg","product_type","stock","image_url","active"])
        expected_types=["uuid","timestamptz","text","text","numeric","text","int4","text","bool"]
        self.assertEqual([c.typeName.names[-1].sval for c in columns], expected_types)
        self.assertTrue(all(c.typeName.typmods is None for c in columns))
        not_null=[c.colname for c in columns if any(x.contype.name=="CONSTR_NOTNULL" for x in (c.constraints or ()))]
        self.assertEqual(not_null,["id","created_at"])
        defaults={c.colname for c in columns if any(x.contype.name=="CONSTR_DEFAULT" for x in (c.constraints or ()))}
        self.assertEqual(defaults,{"id","created_at","stock","active"})
        values={c.colname:next(x.raw_expr for x in c.constraints if x.contype.name=="CONSTR_DEFAULT") for c in columns if c.colname in defaults}
        self.assertEqual(values["id"].funcname[-1].sval,"gen_random_uuid")
        self.assertEqual(values["created_at"].funcname[-1].sval,"now")
        self.assertEqual(values["stock"].val.ival,0)
        self.assertIs(values["active"].val.boolval,False)
        keys=[c for c in tables[0].tableElts if isinstance(c, ast.Constraint)]
        self.assertEqual([(c.conname,c.contype.name) for c in keys],[("SHENA_pkey","CONSTR_PRIMARY")])
        rls=next(i for i,s in enumerate(statements) if isinstance(s.stmt,ast.AlterTableStmt))
        grants=[(i,s.stmt) for i,s in enumerate(statements) if isinstance(s.stmt,ast.GrantStmt) and s.stmt.is_grant]
        self.assertTrue(grants)
        self.assertTrue(all(i>rls and [p.priv_name for p in g.privileges]==["select"] for i,g in grants))
        policy=next(s.stmt for s in statements if isinstance(s.stmt,ast.CreatePolicyStmt))
        self.assertEqual(policy.policy_name,"Public can view active product")
        self.assertEqual([r.rolename for r in policy.roles],["anon","authenticated"])
        self.assertTrue(policy.permissive)
        self.assertIsNone(policy.with_check)

    def test_staging_fixture_is_inactive_and_contains_no_auth_or_external_link(self):
        fixture = json.loads((ROOT / "docs/proposals/staging/01-product-fixture-candidate.json").read_text())
        self.assertEqual(set(fixture), {"name", "description", "price_htg", "product_type", "stock", "image_url", "active"})
        self.assertIs(fixture["active"], False)
        self.assertIsNone(fixture["image_url"])
        self.assertIn("FICTIF", fixture["name"])
        self.assertGreaterEqual(fixture["price_htg"], 0)
        self.assertGreaterEqual(fixture["stock"], 0)

    def test_acl_patch_sql_and_plpgsql_syntax(self):
        for relative in ("docs/proposals/production-00-products-acl-rollback-review.sql", "docs/proposals/production-00-products-acl-inventory.sql", "docs/proposals/production-00-products-acl-revoke-reviewed.sql", "docs/proposals/tests/products-acl-staging.sql"):
            sql = (ROOT / relative).read_text()
            self.assertTrue(parse_sql(sql))
            if "DO $" in sql:
                self.assertTrue(parse_plpgsql(sql))

    def test_acl_patch_never_grants_or_alters_products(self):
        sql = (ROOT / "docs/proposals/production-00-products-acl-revoke-reviewed.sql").read_text()
        statements = parse_sql(sql)
        self.assertEqual(statements[-1].stmt.kind.name, "TRANS_STMT_ROLLBACK")
        forbidden = (ast.InsertStmt, ast.UpdateStmt, ast.DeleteStmt, ast.TruncateStmt, ast.AlterTableStmt, ast.CreatePolicyStmt, ast.AlterPolicyStmt, ast.CreateFunctionStmt)
        self.assertFalse(any(isinstance(s.stmt, forbidden) for s in statements))
        grants = [s.stmt for s in statements if isinstance(s.stmt, ast.GrantStmt)]
        self.assertTrue(grants)
        for grant in grants:
            self.assertFalse(grant.is_grant)
            self.assertEqual(grant.behavior.name, "DROP_RESTRICT")
            self.assertNotIn("select", [p.priv_name for p in grant.privileges])
            self.assertEqual([r.rolename for r in grant.grantees], ["anon", "authenticated"])
        self.assertEqual(len(grants),1)
        self.assertEqual({p.priv_name for p in grants[0].privileges},{"insert","update","delete","truncate","references","trigger","maintain"})

    def test_acl_staging_assembly_keeps_final_rollback(self):
        patch = (ROOT / "docs/proposals/production-00-products-acl-revoke-reviewed.sql").read_text()
        checks = (ROOT / "docs/proposals/tests/products-acl-staging.sql").read_text()
        self.assertEqual(patch.count("-- SHENA_ACL_STAGING_TESTS_HERE"), 1)
        assembled = patch.replace("-- SHENA_ACL_STAGING_TESTS_HERE", checks)
        statements = parse_sql(assembled)
        self.assertTrue(parse_plpgsql(assembled))
        self.assertEqual(statements[-1].stmt.kind.name, "TRANS_STMT_ROLLBACK")
        self.assertNotIn("TRANS_STMT_COMMIT", [getattr(getattr(s.stmt, "kind", None), "name", None) for s in statements])

    def test_confirmed_bootstrap_acl_and_admin_assembly_is_static_and_rollback(self):
        spec = importlib.util.spec_from_file_location("prepare_staging_validation", ROOT / "scripts/prepare-staging-validation.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        ids=("11111111-1111-4111-8111-111111111111","22222222-2222-4222-8222-222222222222","33333333-3333-4333-8333-333333333333")
        for mode,accounts,simulate in (("acl",(),False),("acl",(),True),("admin",ids,False)):
            with self.subTest(mode=mode,simulate=simulate):
                sql=module.assemble(mode,accounts,simulate)
                statements=parse_sql(sql)
                self.assertTrue(parse_plpgsql(sql))
                self.assertEqual(statements[-1].stmt.kind.name,"TRANS_STMT_ROLLBACK")
                self.assertNotIn("TRANS_STMT_COMMIT",[getattr(getattr(s.stmt,"kind",None),"name",None) for s in statements])
                if simulate:
                    self.assertIn("shena.approved_isolated_acl_test",sql)
                    self.assertNotIn("SET LOCAL shena.approved_isolated_acl_test=",sql)
        with self.assertRaises(ValueError):
            module.assemble("admin",())

    def test_duplicate_identity_rejected(self):
        with self.assertRaises(ValueError):
            prepare.assemble("11111111-1111-4111-8111-111111111111", "11111111-1111-4111-8111-111111111111", "33333333-3333-4333-8333-333333333333")

    def test_injection_or_non_uuid_rejected(self):
        for invalid in ("admin", "'; COMMIT; --", "", "https://production.example"):
            with self.subTest(value=invalid), self.assertRaises(ValueError):
                prepare.assemble(invalid, "22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333")


if __name__ == "__main__":
    unittest.main(verbosity=2)
