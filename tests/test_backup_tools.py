"""Fixtures seulement : aucun jeton Supabase, aucune source distante ni ressource AWS."""
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts/backup'))
import core
import shena_backup as runner

class FakeKms:
    def decrypt(self,**kwargs):
        assert kwargs['EncryptionContext']['project_ref']==core.REF
        return {'Plaintext':b'x'*32}

class BackupTests(unittest.TestCase):
    def test_envelope_roundtrip_tamper_and_context(self):
        with tempfile.TemporaryDirectory() as folder:
            d=Path(folder);src=d/'source';src.write_bytes(b'PRIVATE SYNTHETIC ONLY'*100000)
            enc=d/'archive';core.encrypt_file(src,enc,b'x'*32,b'wrapped','key','a'*32)
            dst=d/'restored';core.decrypt_file(enc,dst,FakeKms(),'key','a'*32)
            self.assertEqual(src.read_bytes(),dst.read_bytes())
            with self.assertRaises(ValueError):core.decrypt_file(enc,d/'wrong',FakeKms(),'key','b'*32)
            data=bytearray(enc.read_bytes());data[-17]^=1;enc.write_bytes(data)
            with self.assertRaises(Exception):core.decrypt_file(enc,d/'invalid',FakeKms(),'key','a'*32)
            self.assertFalse((d/'invalid').exists())
            with self.assertRaises(Exception):core.decrypt_file(enc,dst,FakeKms(),'key','a'*32)
            self.assertEqual(src.read_bytes(),dst.read_bytes())

    def test_archive_rejects_traversal_links_duplicates_and_missing_files(self):
        for names in [('../escape',),('ok','ok'),('manifest.json',)]:
            with self.subTest(names=names),tempfile.TemporaryDirectory() as folder:
                d=Path(folder);archive=d/'a.tar.gz';out=d/'restored';out.mkdir()
                with tarfile.open(archive,'w:gz') as tar:
                    for name in names:
                        value=json.dumps({'files':{'missing':'x'}}).encode() if name=='manifest.json' else b'fixture'
                        info=tarfile.TarInfo(name);info.size=len(value);tar.addfile(info,io.BytesIO(value))
                with self.assertRaises(ValueError):core.extract_verified(archive,out)
        with tempfile.TemporaryDirectory() as folder:
            d=Path(folder)
            with tarfile.open(d/'a','w:gz') as tar:
                info=tarfile.TarInfo('link');info.type=tarfile.SYMTYPE;info.linkname='../escape';tar.addfile(info)
            with self.assertRaises(ValueError):core.extract_verified(d/'a',d/'out')

    def test_official_endpoints_and_readonly_tls(self):
        project={'database':{'host':'db.'+core.REF+'.supabase.co'}}
        endpoints=runner.source_endpoints(project,[{'db_host':'aws-0-us-east-2.pooler.supabase.com','db_port':6543}])
        self.assertEqual([e[2] for e in endpoints],[5432,5432])
        with self.assertRaises(RuntimeError):runner.source_endpoints({'database':{'host':'attacker.example'}},[])
        with patch.dict(os.environ,{'PGPASSWORD':'SYNTHETIC SECRET','PGSERVICE':'bad','PGHOSTADDR':'127.0.0.1'}):
            env=runner.pg_env('host',5432,'user',Path('pgpass'))
            self.assertNotIn('PGPASSWORD',env);self.assertNotIn('PGHOSTADDR',env)
            self.assertEqual(env['PGSSLMODE'],'verify-full')
            self.assertIn('default_transaction_read_only=on',env['PGOPTIONS'])

    def test_private_output_refuses_repository(self):
        with self.assertRaises(ValueError):core.private_directory(ROOT/'not-a-backup')
        with tempfile.TemporaryDirectory() as folder:
            p=core.private_directory(Path(folder)/'private')
            if os.name!='nt':self.assertEqual(p.stat().st_mode&0o777,0o700)

    def test_upload_readback_and_version_required(self):
        class S3:
            def put_object(self,**kw):return {'VersionId':'v1'}
            def get_object(self,**kw):return {'Body':io.BytesIO(b'fixture')}
        with tempfile.TemporaryDirectory() as folder:
            p=Path(folder)/'ciphertext';p.write_bytes(b'fixture')
            self.assertEqual(runner.upload_verified(S3(),'bucket','account','key',p),'v1')
            p.write_bytes(b'TAMPER')
            with self.assertRaises(RuntimeError):runner.upload_verified(S3(),'bucket','account','key',p)
            with patch.object(S3,'put_object',return_value={}):
                with self.assertRaises(RuntimeError):runner.upload_verified(S3(),'bucket','account','key',p)

    def test_destination_rejects_public_unversioned_or_wrong_key(self):
        class Client:
            block=True;version='Enabled';key_account='123456789012'
            def get_caller_identity(self):return {'Account':'123456789012'}
            def head_bucket(self,**kw):pass
            def get_public_access_block(self,**kw):return {'PublicAccessBlockConfiguration':dict.fromkeys(('BlockPublicAcls','IgnorePublicAcls','BlockPublicPolicy','RestrictPublicBuckets'),self.block)}
            def get_bucket_versioning(self,**kw):return {'Status':self.version}
            def describe_key(self,**kw):return {'KeyMetadata':{'Arn':'arn:aws:kms:us-east-2:'+self.key_account+':key/fixture','KeyState':'Enabled','KeyUsage':'ENCRYPT_DECRYPT','KeySpec':'SYMMETRIC_DEFAULT'}}
        class Session:
            def __init__(self):self.instance=Client()
            def client(self,name):return self.instance
        session=Session()
        runner.destination(session,'bucket','key',False)
        for attr,value in [('block',False),('version','Suspended'),('key_account','999999999999')]:
            with self.subTest(attr=attr):
                previous=getattr(session.instance,attr);setattr(session.instance,attr,value)
                with self.assertRaises(RuntimeError):runner.destination(session,'bucket','key',False)
                setattr(session.instance,attr,previous)

    def test_destination_template_never_public_or_deletes_archives(self):
        template=json.loads((ROOT/'scripts/backup/destination.json').read_text())
        bucket=template['Resources']['Archive']
        self.assertEqual(bucket['DeletionPolicy'],'Retain')
        self.assertEqual(bucket['Properties']['VersioningConfiguration']['Status'],'Enabled')
        self.assertTrue(all(bucket['Properties']['PublicAccessBlockConfiguration'].values()))
        self.assertNotIn('LifecycleConfiguration',bucket['Properties'])
        self.assertEqual(template['Resources']['EnvelopeKey']['DeletionPolicy'],'Retain')

    def test_no_production_migration_or_automatic_attestation(self):
        source=(ROOT/'scripts/backup/shena_backup.py').read_text()
        self.assertNotIn('backup_restore_verified',source)
        self.assertIn("'migration_gate_open':False",source)
        self.assertNotIn('COMMIT;',source)
        self.assertNotIn('ALTER TABLE',source)

    @unittest.skipUnless(os.environ.get('SHENA_BACKUP_DOCKER_TESTS')=='1','Docker isolé, activé explicitement en CI')
    def test_real_pg17_dump_restore_and_metadata_tamper(self):
        image='postgres:17';name='shena-backup-fixture-'+__import__('uuid').uuid4().hex[:10]
        core.checked(['docker','pull',image])
        try:
            core.checked(['docker','run','-d','--name',name,'--network','none','-e','POSTGRES_HOST_AUTH_METHOD=trust',image])
            import time
            for _ in range(60):
                r=subprocess.run(['docker','exec',name,'pg_isready','-U','postgres'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
                if not r.returncode:break
                time.sleep(.5)
            def psql(q):return core.checked(['docker','exec','-i',name,'psql','-X','-U','postgres','-Atq','-v','ON_ERROR_STOP=1'],input=("SET search_path=pg_catalog;SET TIME ZONE 'UTC';"+q).encode()).decode()
            psql('CREATE ROLE anon;CREATE TABLE public.fixture(id integer PRIMARY KEY,label text NOT NULL);INSERT INTO public.fixture VALUES(1,\'SYNTHETIC ONLY\');ALTER TABLE public.fixture ENABLE ROW LEVEL SECURITY;GRANT SELECT ON public.fixture TO anon;CREATE POLICY active ON public.fixture FOR SELECT TO anon USING(true);')
            psql("CREATE VIEW public.fixture_view AS SELECT id FROM public.fixture;GRANT UPDATE(label) ON public.fixture TO anon;CREATE FUNCTION public.fixture_check() RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$ SELECT true $$;REVOKE EXECUTE ON FUNCTION public.fixture_check() FROM PUBLIC;GRANT EXECUTE ON FUNCTION public.fixture_check() TO anon;CREATE SEQUENCE public.fixture_sequence;SELECT nextval('public.fixture_sequence');")
            rows=psql(core.table_hash_query('public','fixture')).splitlines()
            import hashlib
            h=hashlib.sha256()
            for row in rows:h.update(row.encode()+b'\n')
            expected={'roles':['anon'],'catalog':json.loads(psql(core.catalog_query())),
                      'tables':[{'schema':'public','table':'fixture','rows':len(rows),'sha256':h.hexdigest()}]}
            with tempfile.TemporaryDirectory() as folder:
                d=Path(folder)
                # Export réel d'un snapshot vivant, puis écriture concurrente locale.
                # La nouvelle ligne doit être absente de la sauvegarde cohérente.
                export=subprocess.Popen(['docker','exec','-i',name,'psql','-X','-U','postgres','-Atq','-v','ON_ERROR_STOP=1'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
                try:
                    export.stdin.write('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;SELECT pg_export_snapshot();\n');export.stdin.flush()
                    import select
                    if not select.select([export.stdout],[],[],10)[0]:raise RuntimeError('Snapshot fixture timeout')
                    snapshot=export.stdout.readline().strip()
                    self.assertRegex(snapshot,r'^[0-9A-Fa-f-]+$')
                    psql("INSERT INTO public.fixture VALUES(2,'CONCURRENT SYNTHETIC ONLY')")
                    (d/'database.dump').write_bytes(core.checked(['docker','exec',name,'pg_dump','-U','postgres','--format=custom','--snapshot='+snapshot]))
                finally:
                    export.communicate('ROLLBACK;\n',timeout=10)
                self.assertEqual(psql('SELECT count(*) FROM public.fixture').strip(),'2')
                proof=core.restore_database(d,image,expected,'')
                self.assertTrue(proof['database_restore_verified'])
                expected['tables'][0]['rows']=2
                with self.assertRaises(RuntimeError):core.restore_database(d,image,expected,'')
        finally:
            subprocess.run(['docker','rm','-f','-v',name],check=True,stdout=subprocess.DEVNULL)

if __name__=='__main__':unittest.main(verbosity=2)
