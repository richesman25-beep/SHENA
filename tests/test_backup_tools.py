"""Fixtures seulement : aucun jeton Supabase, aucune source distante ni compte Google."""
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
import drive
import shena_backup as runner

class FakeVault:
    def unwrap(self,wrapped,context,key_id):
        assert context['project_ref']==core.REF
        return b'x'*32

class BackupTests(unittest.TestCase):
    def test_envelope_roundtrip_tamper_and_context(self):
        with tempfile.TemporaryDirectory() as folder:
            d=Path(folder);src=d/'source';src.write_bytes(b'PRIVATE SYNTHETIC ONLY'*100000)
            enc=d/'archive';core.encrypt_file(src,enc,b'x'*32,b'wrapped','key','a'*32)
            dst=d/'restored';core.decrypt_file(enc,dst,FakeVault(),'key','a'*32)
            self.assertEqual(src.read_bytes(),dst.read_bytes())
            with self.assertRaises(ValueError):core.decrypt_file(enc,d/'wrong',FakeVault(),'key','b'*32)
            data=bytearray(enc.read_bytes());data[-17]^=1;enc.write_bytes(data)
            with self.assertRaises(Exception):core.decrypt_file(enc,d/'invalid',FakeVault(),'key','a'*32)
            self.assertFalse((d/'invalid').exists())
            with self.assertRaises(Exception):core.decrypt_file(enc,dst,FakeVault(),'key','a'*32)
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

    def test_public_os_ca_bundle_is_portable_and_empty_trust_is_refused(self):
        import ssl,types
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'ca.pem';runner.write_ca_bundle(path)
            context=ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
            context.load_verify_locations(cafile=str(path))
            self.assertGreater(len(context.get_ca_certs()),0)
            with patch.object(runner.ssl,'create_default_context',return_value=types.SimpleNamespace(get_ca_certs=lambda **kw:[])):
                with self.assertRaises(runner.SourceSecurityError):runner.write_ca_bundle(Path(folder)/'empty.pem')
            self.assertFalse((Path(folder)/'empty.pem').exists())

    def test_private_output_refuses_repository(self):
        with self.assertRaises(ValueError):core.private_directory(ROOT/'not-a-backup')
        with tempfile.TemporaryDirectory() as folder:
            p=core.private_directory(Path(folder)/'private')
            if os.name!='nt':self.assertEqual(p.stat().st_mode&0o777,0o700)

    def test_free_vault_key_wrap_wrong_key_and_context(self):
        import base64
        with patch.dict(os.environ,{'SHENA_BACKUP_MASTER_KEY':base64.b64encode(b'x'*32).decode()}):
            vault=drive.LocalVault();key,wrapped=vault.new_data_key('a'*32)
            self.assertEqual(vault.unwrap(wrapped,{'project_ref':core.REF,'backup_id':'a'*32},vault.key_id),key)
            with self.assertRaises(Exception):vault.unwrap(wrapped,{'project_ref':core.REF,'backup_id':'b'*32},vault.key_id)
            with self.assertRaises(ValueError):vault.unwrap(wrapped,{'project_ref':core.REF},'other-vault')

    def test_drive_rejects_public_shared_or_foreign_folder(self):
        private={'ownedByMe':True,'trashed':False}
        drive.owner_only(private,[{'type':'user','role':'owner'}])
        for perms in [[],[{'type':'anyone','role':'reader'}],[{'type':'group','role':'writer'}],[{'type':'user','role':'owner'},{'type':'user','role':'reader'}]]:
            with self.assertRaises(RuntimeError):drive.owner_only(private,perms)
        with self.assertRaises(RuntimeError):drive.owner_only({'ownedByMe':False},[{'type':'user','role':'owner'}])
        with self.assertRaises(RuntimeError):drive.owner_only(dict(private,driveId='shared-team'),[{'type':'user','role':'owner'}])

    def test_vault_refuses_plaintext_backend(self):
        class Plain:pass
        with patch.object(drive.keyring,'get_keyring',return_value=Plain()):
            with self.assertRaises(RuntimeError):drive.secret_get('fixture')

    def test_no_secrets_in_rclone_args_or_child_environment(self):
        with patch.dict(os.environ,{'SUPABASE_ACCESS_TOKEN':'SYNTHETIC','SHENA_BACKUP_MASTER_KEY':'SYNTHETIC','SHENA_RCLONE_CONFIG_B64':'SYNTHETIC'}):
            with patch.object(drive.subprocess,'run',return_value=__import__('types').SimpleNamespace(returncode=0,stdout=b'{}')) as run:
                transport=drive.RcloneTransfer('rclone','shena-drive:',Path('/private/rclone.conf'))
                transport.call('lsjson','shena-drive:')
                self.assertNotIn('SYNTHETIC',str(run.call_args.args))
                for key in ('SUPABASE_ACCESS_TOKEN','SHENA_BACKUP_MASTER_KEY','SHENA_RCLONE_CONFIG_B64'):self.assertNotIn(key,run.call_args.kwargs['env'])

    def test_google_authorization_child_receives_no_supabase_or_encryption_key(self):
        import types,contextlib
        with patch.dict(os.environ,{'SUPABASE_ACCESS_TOKEN':'SYNTHETIC','SHENA_BACKUP_MASTER_KEY':'SYNTHETIC','SHENA_RCLONE_CONFIG_B64':'SYNTHETIC'}),patch.object(drive.sys.stdin,'isatty',return_value=True),patch.object(drive,'LocalVault'),patch.object(drive,'secret_get',return_value=None),patch.object(drive.subprocess,'run',return_value=types.SimpleNamespace(returncode=1)) as run,contextlib.redirect_stdout(io.StringIO()):
            with self.assertRaises(RuntimeError):drive.authorize('rclone',Path('/unused/private.conf'))
            self.assertNotIn('SYNTHETIC',str(run.call_args.args))
            for name in ('SUPABASE_ACCESS_TOKEN','SHENA_BACKUP_MASTER_KEY','SHENA_RCLONE_CONFIG_B64'):self.assertNotIn(name,run.call_args.kwargs['env'])

    def test_github_setup_never_overwrites_existing_key(self):
        import types
        with patch.object(drive.shutil,'which',return_value='gh'),patch.object(drive.subprocess,'run',return_value=types.SimpleNamespace(returncode=0,stdout=b'[{"name":"SHENA_BACKUP_MASTER_KEY"}]')) as run:
            with self.assertRaises(RuntimeError):drive.configure_github(Path('/unused/config'),'SYNTHETIC')
            self.assertEqual(run.call_count,1)
            self.assertNotIn('set',run.call_args.args[0])
            self.assertIn('github.com/richesman25-beep/SHENA',run.call_args.args[0])

    def test_backup_workflow_never_publishes_or_runs_on_regular_push(self):
        text=(ROOT/'.github/workflows/production-backup-drive.yml').read_text()
        self.assertNotIn('uses: actions/upload-artifact',text)
        self.assertIn('[shena-backup-run]',text)
        self.assertIn('contents: read',text)
        self.assertNotIn('secrets: write',text)

    @unittest.skipUnless(os.environ.get('SHENA_BACKUP_RCLONE_TESTS')=='1','Transfert rclone réel activé en CI')
    def test_real_rclone_transfer_readback_restore_and_no_overwrite(self):
        with tempfile.TemporaryDirectory() as folder:
            d=Path(folder);binary=drive.ensure_rclone(d/'tools')
            remote=d/'remote-private';remote.mkdir()
            transfer=drive.RcloneTransfer(binary,str(remote))
            with patch.dict(os.environ,{'SHENA_BACKUP_MASTER_KEY':__import__('base64').b64encode(b'x'*32).decode()}):vault=drive.LocalVault()
            original=d/'original';original.write_bytes(b'PRIVATE SYNTHETIC ONLY'*10000)
            key,wrapped=vault.new_data_key('a'*32)
            enc=d/'backup.shena';core.encrypt_file(original,enc,key,wrapped,vault.key_id,'a'*32)
            transfer.upload('a'*32+'/backup.shena',enc)
            with self.assertRaises(RuntimeError):transfer.upload('a'*32+'/backup.shena',enc)
            downloaded=d/'downloaded';transfer.download('a'*32+'/backup.shena',downloaded)
            self.assertEqual(core.digest(enc),core.digest(downloaded))
            restored=d/'restored';core.decrypt_file(downloaded,restored,vault,vault.key_id,'a'*32)
            self.assertEqual(original.read_bytes(),restored.read_bytes())
            # Un autre contenu distant ne doit pas pouvoir être déchiffré.
            data=bytearray(downloaded.read_bytes());data[-17]^=1;downloaded.write_bytes(data)
            with self.assertRaises(Exception):core.decrypt_file(downloaded,d/'invalid',vault,vault.key_id,'a'*32)

    @unittest.skipUnless(os.environ.get('SHENA_BACKUP_RCLONE_TESTS')=='1','rclone réel activé en CI')
    def test_encrypted_reports_recovered_from_remote_without_github_artifact(self):
        with tempfile.TemporaryDirectory() as folder:
            d=Path(folder);remote=d/'remote';remote.mkdir();binary=drive.ensure_rclone(d/'tools')
            class Store(drive.DriveStore):
                def __init__(self):self.config=d/'private.conf';self.transport=drive.RcloneTransfer(binary,str(remote))
                def upload(self,key,source):self.transport.upload(key,source);return {'object_key':key}
                def locate(self,key):return {'object_key':key}
                def download(self,receipt,target):self.transport.download(receipt['object_key'],target)
            with patch.dict(os.environ,{'SHENA_BACKUP_MASTER_KEY':__import__('base64').b64encode(b'x'*32).decode()}):vault=drive.LocalVault()
            store=Store();receipt={'project_ref':core.REF,'backup_id':'a'*32,'provider':'google-drive','database_restore_verified':False,'marker':'SYNTHETIC PRIVATE REPORT ONLY'}
            path=store.save_report(receipt,vault)
            self.assertNotIn(b'SYNTHETIC PRIVATE REPORT ONLY',(remote/path).read_bytes())
            restored=store.latest_report(vault,d)
            self.assertEqual(restored,receipt)
            self.assertFalse(restored['database_restore_verified'])

    def test_installer_checksums_and_official_release_fallback(self):
        from urllib.error import HTTPError
        import zipfile
        payload=io.BytesIO()
        binary_name='rclone.exe' if os.name=='nt' else 'rclone'
        with zipfile.ZipFile(payload,'w') as z:z.writestr('rclone-v1.2.3-platform/'+binary_name,b'SYNTHETIC EXECUTABLE ONLY')
        data=payload.getvalue();filename='rclone-v1.2.3-windows-amd64.zip' if os.name=='nt' else 'rclone-v1.2.3-linux-amd64.zip'
        checks=__import__('hashlib').sha256(data).hexdigest()+'  '+filename
        prefix='https://github.com/rclone/rclone/releases/download/v1.2.3/'
        release={'tag_name':'v1.2.3','assets':[{'name':n,'browser_download_url':prefix+n} for n in ('SHA256SUMS',filename)]}
        def read(req,timeout=None):
            url=req.full_url
            self.assertEqual(req.get_header('User-agent'),'SHENA-backup/1.0')
            if 'downloads.rclone.org' in url:raise HTTPError(url,503,'Unavailable',{},None)
            if url.endswith('/latest'):return io.BytesIO(json.dumps(release).encode())
            if url.endswith('/SHA256SUMS'):return io.BytesIO(checks.encode())
            return io.BytesIO(data)
        with tempfile.TemporaryDirectory() as folder,patch.object(drive.shutil,'which',return_value=None),patch.object(drive.platform,'machine',return_value='AMD64'),patch.object(drive.platform,'system',return_value='Windows' if os.name=='nt' else 'Linux'),patch.object(drive.urllib.request,'urlopen',side_effect=read):
            binary=Path(drive.ensure_rclone(Path(folder)/'verified'))
            self.assertEqual(binary.read_bytes(),b'SYNTHETIC EXECUTABLE ONLY')
            checks='0'*64+'  '+filename
            with self.assertRaises(RuntimeError):drive.ensure_rclone(Path(folder)/'invalid')
            self.assertFalse((Path(folder)/'invalid'/binary_name).exists())

    def test_google_error_reports_only_request_and_reason(self):
        from urllib.error import HTTPError
        import types
        store=object.__new__(drive.DriveStore)
        store.settings=lambda:{'token':json.dumps({'access_token':'SENSITIVE_OAUTH_VALUE'})}
        body={'error':{'message':'private@example.test SENSITIVE_OAUTH_VALUE SECRET_FILE_ID',
             'errors':[{'reason':'insufficientPermissions','message':'PRIVATE_BODY'}],
             'details':[{'reason':'ACCESS_TOKEN_SCOPE_INSUFFICIENT','metadata':{'consumer':'PRIVATE_PROJECT'}}]}}
        def fail(req,timeout=None):
            self.assertEqual(req.get_header('Authorization'),'Bearer SENSITIVE_OAUTH_VALUE')
            raise HTTPError(req.full_url,403,'PRIVATE_MESSAGE',{},io.BytesIO(json.dumps(body).encode()))
        with patch.object(drive.urllib.request,'build_opener',return_value=types.SimpleNamespace(open=fail)):
            with self.assertRaises(drive.GoogleDriveError) as caught:store.api('files/SECRET_FILE_ID/permissions?pageToken=PRIVATE_PAGE')
        error=caught.exception
        self.assertEqual(error.status,403);self.assertEqual(error.operation,'permissions.list')
        self.assertIn('insufficientPermissions',error.reasons)
        for private in ('SENSITIVE_OAUTH_VALUE','PRIVATE_BODY','SECRET_FILE_ID','PRIVATE_PAGE','private@example.test','PRIVATE_PROJECT'):
            self.assertNotIn(private,str(error));self.assertNotIn(private,repr(error))
        self.assertEqual(drive.GoogleDriveError(403,'files.get',['SENSITIVE_OAUTH_VALUE']).reasons,('unknown',))

    def test_minimal_scope_privacy_uses_files_get_not_permissions_list(self):
        store=object.__new__(drive.DriveStore);calls=[]
        meta={'id':'EXISTING_ROOT','ownedByMe':True,'trashed':False,'shared':False,'mimeType':'application/vnd.google-apps.folder'}
        def api(path,body=None):
            calls.append(path)
            if '/permissions' in path:raise drive.GoogleDriveError(403,'permissions.list',['insufficientPermissions'])
            return meta
        store.api=api
        self.assertEqual(store.private('EXISTING_ROOT',is_folder=True)['id'],'EXISTING_ROOT')
        self.assertEqual(len(calls),1);self.assertIn('shared',calls[0]);self.assertNotIn('/permissions',calls[0])
        for key,value in [('shared',True),('shared',None),('ownedByMe',False),('driveId','SHARED_DRIVE'),('trashed',True)]:
            invalid=dict(meta);invalid[key]=value
            with self.assertRaises(RuntimeError):drive.private_metadata(invalid)
        unknown=dict(meta);unknown.pop('shared')
        with self.assertRaises(RuntimeError):drive.private_metadata(unknown)
        with self.assertRaises(RuntimeError):drive.private_metadata(dict(meta,permissions=[{'type':'anyone','role':'reader'}]))

    def test_recover_previous_folder_and_keep_configuration_after_403(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'rclone.conf'
            path.write_text('[shena-drive]\ntype = drive\nscope = drive.file\ntoken = {"access_token":"SYNTHETIC"}\n')
            store=object.__new__(drive.DriveStore);store.config=path;calls=[]
            def api(route,body=None):
                calls.append((route,body))
                if route.startswith('files?'):return {'files':[{'id':'ROOT_CREATED_BEFORE_403'}]}
                raise drive.GoogleDriveError(403,'files.get',['insufficientPermissions'])
            store.api=api
            with patch.object(drive,'save_config') as saved:
                self.assertEqual(store.bind_folder(allow_create=True),'ROOT_CREATED_BEFORE_403')
                self.assertTrue(saved.called)
                self.assertIn('ROOT_CREATED_BEFORE_403',path.read_text())
                with self.assertRaises(drive.GoogleDriveError):store.private(store.folder,is_folder=True)
            self.assertTrue(all(body is None for route,body in calls))
            self.assertEqual(store.bind_folder(),'ROOT_CREATED_BEFORE_403')

    def test_existing_vault_master_is_never_regenerated_on_reauthorization(self):
        import base64
        with patch.dict(os.environ,{},clear=True),patch.object(drive,'secret_get',return_value=base64.b64encode(b'x'*32).decode()),patch.object(drive,'secret_set') as save,patch.object(drive.secrets,'token_bytes',side_effect=AssertionError('No key rotation')):
            first=drive.LocalVault(create=True);second=drive.LocalVault(create=True)
            self.assertEqual(first.master,second.master)
            self.assertEqual(first.key_id,second.key_id)
            save.assert_not_called()

    def test_explicit_existing_folder_never_replaces_an_already_bound_root(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'rclone.conf'
            base='[shena-drive]\ntype = drive\nscope = drive.file\ntoken = {}\n'
            path.write_text(base+'root_folder_id = ORIGINAL_ROOT\n')
            store=object.__new__(drive.DriveStore);store.config=path
            with patch.object(store,'api') as api:
                with self.assertRaises(RuntimeError):store.bind_folder(preferred='OTHER_ROOT')
                api.assert_not_called()
                self.assertIn('ORIGINAL_ROOT',path.read_text())
            path.write_text(base)
            with patch.object(store,'api',return_value={'ownedByMe':True,'trashed':False,'shared':False,'mimeType':'application/vnd.google-apps.folder'}) as api,patch.object(drive,'save_config'):
                self.assertEqual(store.bind_folder(preferred='ORIGINAL_ROOT'),'ORIGINAL_ROOT')
                self.assertTrue(all(call.args[0].startswith('files/ORIGINAL_ROOT?') for call in api.call_args_list))
                self.assertIn('ORIGINAL_ROOT',path.read_text())

    def test_reauthorization_preserves_folder_client_and_master_key(self):
        import types,contextlib
        previous='[shena-drive]\ntype = drive\nscope = drive.file\nroot_folder_id = EXISTING_ROOT\nclient_id = ORIGINAL_CLIENT\nclient_secret = ORIGINAL_CLIENT_SECRET\ntoken = {"access_token":"OLD_SYNTHETIC"}\n'
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'rclone.conf'
            def reconnect(args,**kwargs):
                self.assertIn('reconnect',args)
                self.assertIn('ORIGINAL_CLIENT',path.read_text())
                path.write_text(path.read_text().replace('OLD_SYNTHETIC','NEW_SYNTHETIC'))
                return types.SimpleNamespace(returncode=0)
            with patch.object(drive.sys.stdin,'isatty',return_value=True),patch.object(drive,'LocalVault') as vault,patch.object(drive,'secret_get',return_value='1'),patch.object(drive,'load_config',return_value=previous),patch.object(drive.subprocess,'run',side_effect=reconnect),patch.object(drive,'save_config') as saved,contextlib.redirect_stdout(io.StringIO()):
                # Le contrôle réel est simulé après bind_folder pour cet échec.
                with patch.object(drive.DriveStore,'__init__',side_effect=drive.GoogleDriveError(403,'files.get',['appNotAuthorizedToFile'])):
                    with self.assertRaises(drive.GoogleDriveError):drive.authorize('rclone',path,allow_create=False)
                vault.assert_called_once_with(create=False)
                self.assertIn('EXISTING_ROOT',saved.call_args.args[0])
                self.assertIn('ORIGINAL_CLIENT_SECRET',saved.call_args.args[0])
                self.assertIn('scope = drive.file',saved.call_args.args[0])
                self.assertIn('NEW_SYNTHETIC',saved.call_args.args[0])

    def test_existing_profile_without_master_stops_before_oauth_or_key_generation(self):
        config='[shena-drive]\ntype = drive\nscope = drive.file\nroot_folder_id = ORIGINAL_ROOT\n'
        with patch.object(drive.sys.stdin,'isatty',return_value=True),patch.object(drive,'secret_get',return_value='1'),patch.object(drive,'load_config',return_value=config),patch.object(drive,'LocalVault',side_effect=RuntimeError('Clé absente')) as vault,patch.object(drive.subprocess,'run') as run:
            with self.assertRaises(RuntimeError):drive.authorize('rclone',Path('/unused/private.conf'))
            vault.assert_called_once_with(create=False)
            run.assert_not_called()

    def test_existing_backup_can_still_be_downloaded_without_permissions_list(self):
        import types
        with tempfile.TemporaryDirectory() as folder:
            config=Path(folder)/'rclone.conf'
            config.write_text('[shena-drive]\ntype = drive\nscope = drive.file\nroot_folder_id = ROOT\ntoken = {"access_token":"SYNTHETIC"}\n')
            calls=[]
            def api(store,path,body=None):
                self.assertIsNone(body);self.assertNotIn('/permissions',path);calls.append(path)
                key=path.split('/')[1].split('?')[0]
                parents={'ROOT':[],'CHILD':['ROOT'],'ARCHIVE':['CHILD']}
                return {'id':key,'ownedByMe':True,'trashed':False,'shared':False,'parents':parents[key],'mimeType':'application/octet-stream' if key=='ARCHIVE' else 'application/vnd.google-apps.folder'}
            with patch.object(drive.DriveStore,'api',api),patch.object(drive.RcloneTransfer,'call',side_effect=lambda *args,**kwargs: b'{"ID":"ARCHIVE"}' if args[0]=='lsjson' else b'{}'),patch.object(drive.RcloneTransfer,'download',side_effect=lambda key,p:Path(p).write_bytes(b'EXISTING ENCRYPTED BACKUP')):
                store=drive.DriveStore('rclone',config)
                target=Path(folder)/'restored'
                store.download({'drive_folder_id':'ROOT','drive_file_id':'ARCHIVE','drive_backup_folder_id':'CHILD','object_key':'a'*32+'/backup.shena'},target)
                self.assertEqual(target.read_bytes(),b'EXISTING ENCRYPTED BACKUP')
            self.assertEqual(drive.google_operation('files/ARCHIVE?fields=shared'),'files.get')
            self.assertTrue(all('/permissions' not in p for p in calls))

    def test_drive_diagnostic_logs_safe_reason_and_uses_no_write(self):
        import contextlib
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'rclone.conf';path.write_text('[shena-drive]\ntype = drive\nscope = drive.file\nroot_folder_id = PRIVATE_ID\ntoken = {}\n')
            def api(store,route,body=None):
                self.assertIsNone(body)
                if '/permissions' in route:raise drive.GoogleDriveError(403,'permissions.list',['insufficientPermissions'])
                return {'id':'PRIVATE_ID','ownedByMe':True,'trashed':False,'shared':False,'mimeType':'application/vnd.google-apps.folder'}
            output=io.StringIO()
            with patch.object(drive.RcloneTransfer,'call',side_effect=RuntimeError('Synthetic rclone startup denied')),patch.object(drive.DriveStore,'api',api),contextlib.redirect_stdout(output):drive.diagnose_drive('rclone',path)
            log=output.getvalue()
            self.assertIn('"oauth_client": "shared-default"',log)
            self.assertEqual(log.count('"request"'),1)
            self.assertNotIn('PRIVATE_ID',log);self.assertNotIn('token',log)

    def test_quota_backoff_is_bounded_and_never_replays_creation(self):
        import urllib.error
        from unittest.mock import MagicMock
        store=object.__new__(drive.DriveStore)
        store.settings=lambda:{'token':json.dumps({'access_token':'NEVER_PRINT'})}
        def error(reason='RATE_LIMIT_EXCEEDED',headers=None):
            return urllib.error.HTTPError('https://invalid',403,'masked',headers,io.BytesIO(json.dumps({'error':{'errors':[{'reason':reason}]}}).encode()))
        opener=MagicMock();opener.open.side_effect=[error() for _ in range(5)]
        with patch.object(drive.urllib.request,'build_opener',return_value=opener),patch.object(drive.time,'sleep') as sleep,patch.object(drive.random,'uniform',side_effect=lambda low,high:high):
            with self.assertRaises(drive.GoogleDriveError):store.api('files/ROOT')
            self.assertEqual(opener.open.call_count,5)
            self.assertEqual([c.args[0] for c in sleep.call_args_list],[2,4,8,16])
        for body,reason,headers in [({},'RATE_LIMIT_EXCEEDED',None),(None,'insufficientPermissions',None),(None,'RATE_LIMIT_EXCEEDED',{'Retry-After':'120'})]:
            opener.open.reset_mock();opener.open.side_effect=error(reason,headers)
            with patch.object(drive.urllib.request,'build_opener',return_value=opener),patch.object(drive.time,'sleep') as sleep:
                with self.assertRaises(drive.GoogleDriveError):store.api('files',body)
                self.assertEqual(opener.open.call_count,1);sleep.assert_not_called()

    def test_quota_retry_success_and_retry_after(self):
        import urllib.error
        from unittest.mock import MagicMock
        store=object.__new__(drive.DriveStore);store.settings=lambda:{'token':'{"access_token":"hidden"}'}
        opener=MagicMock();response=MagicMock();response.__enter__.return_value=io.StringIO('{"ok":true}')
        opener.open.side_effect=[urllib.error.HTTPError('https://invalid',429,'masked',{'Retry-After':'1'},io.BytesIO(b'{}')),response]
        with patch.object(drive.urllib.request,'build_opener',return_value=opener),patch.object(drive.time,'sleep') as sleep,patch.object(drive.random,'uniform',return_value=1.5) as jitter:
            self.assertEqual(store.api('files/ROOT'),{'ok':True})
            jitter.assert_called_once_with(1.0,2);sleep.assert_called_once_with(1.5)

    def test_oauth_mode_and_refresh_request_budget(self):
        from unittest.mock import Mock
        self.assertEqual(drive.oauth_client_mode({}),'shared-default')
        self.assertEqual(drive.oauth_client_mode({'client_id':'personal.apps.googleusercontent.com'}),'personal')
        store=object.__new__(drive.DriveStore);store.transport=Mock()
        with patch.object(drive.time,'monotonic',side_effect=[10,10,11,309,310,310]):
            store.refresh();store.refresh();store.refresh();store.refresh()
        self.assertEqual(store.transport.call.call_count,2)

    def test_personal_client_failure_preserves_active_profile_and_key(self):
        from unittest.mock import Mock
        original='[shena-drive]\ntype=drive\nscope=drive.file\nroot_folder_id=ROOT\ntoken={}\n'
        with tempfile.TemporaryDirectory() as folder:
            config=Path(folder)/'config';credentials=Path(folder)/'client.json'
            credentials.write_text(json.dumps({'installed':{'client_id':'personal.apps.googleusercontent.com','client_secret':'HIDDEN_CLIENT'}}))
            old=Mock();old.transport.call.return_value=b'[]'
            result=Mock(returncode=0,stdout=b'obscured')
            with patch.object(drive.sys.stdin,'isatty',return_value=True),patch.object(drive,'load_config',return_value=original),patch.object(drive,'LocalVault') as vault,patch.object(drive,'DriveStore',side_effect=[old,RuntimeError('access refused')]),patch.object(drive.subprocess,'run',return_value=result) as run,patch.object(drive,'save_config') as save,patch.object(drive,'secret_set') as secret:
                with self.assertRaises(RuntimeError):drive.configure_personal_client('rclone',config,credentials)
                self.assertEqual(config.read_text(),original);save.assert_not_called();secret.assert_not_called();vault.assert_called_once_with()
                for call in run.call_args_list:self.assertNotIn('HIDDEN_CLIENT',str(call.args))

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
                r=subprocess.run(['docker','exec',name,'pg_isready','-h','127.0.0.1','-U','postgres'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
                if not r.returncode:break
                time.sleep(.5)
            def psql(q):return core.checked(['docker','exec','-i',name,'psql','-X','-U','postgres','-Atq','-v','ON_ERROR_STOP=1'],input=("SET search_path=pg_catalog;SET TIME ZONE 'UTC';"+q).encode()).decode()
            psql('CREATE ROLE anon;CREATE TABLE public.fixture(id integer PRIMARY KEY,label text NOT NULL);INSERT INTO public.fixture VALUES(1,\'SYNTHETIC ONLY\');ALTER TABLE public.fixture ENABLE ROW LEVEL SECURITY;GRANT SELECT ON public.fixture TO anon;CREATE POLICY active ON public.fixture FOR SELECT TO anon USING(true);')
            psql("UPDATE public.fixture SET label='SYNTHETIC — Haïti\u2028ONLY';")
            psql("CREATE VIEW public.fixture_view AS SELECT id FROM public.fixture;GRANT UPDATE(label) ON public.fixture TO anon;CREATE FUNCTION public.fixture_check() RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$ SELECT true $$;REVOKE EXECUTE ON FUNCTION public.fixture_check() FROM PUBLIC;GRANT EXECUTE ON FUNCTION public.fixture_check() TO anon;CREATE SEQUENCE public.fixture_sequence;SELECT nextval('public.fixture_sequence');")
            psql("CREATE ROLE supabase_admin SUPERUSER NOLOGIN;CREATE FUNCTION public.fixture_event() RETURNS event_trigger LANGUAGE plpgsql AS $$ BEGIN RETURN; END $$;CREATE EVENT TRIGGER fixture_event ON ddl_command_end WHEN TAG IN ('CREATE TABLE') EXECUTE FUNCTION public.fixture_event();ALTER EVENT TRIGGER fixture_event OWNER TO supabase_admin;")
            rows=[row for row in psql(core.table_hash_query('public','fixture')).split('\n') if row]
            import hashlib
            h=hashlib.sha256()
            for row in rows:h.update(row.encode()+b'\n')
            expected={'roles':['anon','supabase_admin'],'role_attributes':[['supabase_admin',True,False]],'catalog':json.loads(psql(core.catalog_query())),
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
                # Bundle réel PostgreSQL + octets Storage, chiffré et transféré
                # par rclone (backend local), puis restauré depuis la copie distante.
                import hashlib,base64,types
                source=d/'bundle';source.mkdir();(source/'objects').mkdir()
                __import__('shutil').copyfile(d/'database.dump',source/'database.dump')
                (source/'objects/00000000.bin').write_bytes(b'%PDF-1.7\nSYNTHETIC STORAGE ONLY')
                obj={'bucket_id':'digital-products','object_path':'fixture.pdf','file':'objects/00000000.bin','sha256':core.digest(source/'objects/00000000.bin')}
                (source/'source-inventory.json').write_text(json.dumps(expected))
                (source/'storage-files.json').write_text(json.dumps([obj]))
                (source/'storage-inventory.json').write_text(json.dumps({'objects':[{'bucket_id':'digital-products','name':'fixture.pdf'}]}))
                manifest={'project_ref':core.REF,'preloads':'','files':{p.relative_to(source).as_posix():core.digest(p) for p in source.rglob('*') if p.is_file()}}
                (source/'manifest.json').write_text(json.dumps(manifest))
                archive=d/'bundle.tar.gz'
                with tarfile.open(archive,'w:gz') as tar:
                    for p in source.rglob('*'):
                        if p.is_file():tar.add(p,arcname=p.relative_to(source).as_posix(),recursive=False)
                with patch.dict(os.environ,{'SHENA_BACKUP_MASTER_KEY':base64.b64encode(b'x'*32).decode()}):vault=drive.LocalVault()
                key,wrapped=vault.new_data_key('a'*32);encrypted=d/'bundle.shena'
                core.encrypt_file(archive,encrypted,key,wrapped,vault.key_id,'a'*32)
                transfer=drive.RcloneTransfer(drive.ensure_rclone(d/'tools'),str(d/'remote'))
                transfer.upload('a'*32+'/backup.shena',encrypted)
                class Store:
                    def download(self,receipt,target):transfer.download(receipt['object_key'],target)
                receipt={'provider':'google-drive','project_ref':core.REF,'backup_id':'a'*32,'key_id':vault.key_id,'archive_sha256':core.digest(encrypted),'object_key':'a'*32+'/backup.shena'}
                runner.restore_receipt(types.SimpleNamespace(restore_image=image),Store(),vault,d,receipt)
                self.assertTrue(receipt['database_restore_verified'])
                self.assertTrue(receipt['storage_bytes_restore_verified'])
                self.assertFalse(receipt['storage_service_restore_verified'])
                self.assertFalse(receipt['migration_gate_open'])
                proof=receipt

                self.assertTrue(proof['database_restore_verified'])
                expected['tables'][0]['rows']=2
                with self.assertRaises(RuntimeError):core.restore_database(d,image,expected,'')
        finally:
            subprocess.run(['docker','rm','-f','-v',name],check=True,stdout=subprocess.DEVNULL)

if __name__=='__main__':unittest.main(verbosity=2)
