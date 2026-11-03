"""Sauvegarde externe SHENA : aucune migration et aucune activation Production."""
import argparse
import getpass
import hashlib
import json
import os
import re
from pathlib import Path
import shutil
import ssl
import subprocess
import sys
import tarfile
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, timezone
import psycopg
from psycopg import sql
from drive import LocalVault, DriveStore, ensure_rclone, load_config, save_config, authorize, configure_github, secret_get, secret_set
from core import REF, REPO, CHUNK, checked, digest, private_directory, encrypt_file, decrypt_file, extract_verified, restore_database, catalog_query, table_hash_query

API = 'https://api.supabase.com/v1/projects/' + REF
ROLE = 'supabase_read_only_user'

class SourceSecurityError(RuntimeError):
    pass

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs): raise RuntimeError('Redirection HTTP refusée pour protéger les identifiants')


def request(url, headers=None, body=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, headers=headers or {})
    try: return urllib.request.build_opener(NoRedirect).open(req, timeout=60)
    except urllib.error.HTTPError as e: raise RuntimeError('API refusée HTTP ' + str(e.code)) from None


def api(token, suffix='', body=None):
    with request(API + suffix, {'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'}, body) as stream:
        return json.load(stream)


def source_endpoints(project, poolers):
    direct = project['database']['host']
    if direct != 'db.' + REF + '.supabase.co': raise RuntimeError('Hôte direct non reconnu : examen requis')
    result = [('direct', direct, 5432)]
    for row in poolers:
        host = row.get('db_host', '')
        if host.endswith('.pooler.supabase.com'):
            # Session Pooler documenté sur 5432. Jamais Transaction Pooler 6543.
            value = ('session', host, 5432)
            if value not in result: result.append(value)
    return result


def write_ca_bundle(path):
    # libpq/OpenSSL n'utilise pas toujours le magasin Windows automatiquement.
    # Python charge les autorités approuvées de l'OS : certificats PUBLICS seuls.
    certificates=ssl.create_default_context().get_ca_certs(binary_form=True)
    if not certificates:raise SourceSecurityError('Aucune autorité de certification approuvée disponible')
    Path(path).write_text(''.join(ssl.DER_cert_to_PEM_cert(c) for c in certificates),encoding='ascii')


def pg_env(host, port, user, password_file):
    env = os.environ.copy()
    for name in ('PGPASSWORD','PGSERVICE','PGSERVICEFILE','PGHOSTADDR','PGOPTIONS','PGDATABASE','PGUSER','PGPORT','PGHOST','PGPASSFILE','PGSSLMODE','PGSSLROOTCERT'):
        env.pop(name, None)
    env.update(PGHOST=host, PGPORT=str(port), PGUSER=user, PGDATABASE='postgres', PGPASSFILE=str(password_file),
               PGSSLMODE='verify-full', PGSSLROOTCERT=str(password_file.parent/'ca.pem'), PGCONNECT_TIMEOUT='10',
               PGOPTIONS='-c default_transaction_read_only=on -c search_path=pg_catalog -c timezone=UTC')
    return env


CLIENT_IMAGE = None


def prepare_pg_tools():
    global CLIENT_IMAGE
    programs = ('pg_dump','pg_dumpall','pg_restore','psql')
    if all(shutil.which(p) and ' 17.' in checked([p,'--version']).decode() for p in programs): return
    # Docker Desktop évite d'installer un serveur PostgreSQL sur Windows.
    if not shutil.which('docker'): raise RuntimeError('Docker Desktop ou clients PostgreSQL 17 requis')
    checked(['docker','pull','postgres:17'])
    image=json.loads(checked(['docker','image','inspect','postgres:17']))[0]
    CLIENT_IMAGE=image['RepoDigests'][0]


def pg_call(program, args, env, stdout=None):
    if CLIENT_IMAGE:
        env=env.copy();env['PGSSLROOTCERT']='/work/ca.pem'
        work=Path(env['PGPASSFILE']).parent.resolve()
        mapped=[]
        for arg in args:
            if arg.startswith('--file='):
                mapped.append('--file=/work/'+Path(arg[7:]).resolve().relative_to(work).as_posix())
            elif Path(arg).is_absolute():mapped.append('/work/'+Path(arg).resolve().relative_to(work).as_posix())
            else:mapped.append(arg)
        command=['docker','run','--rm','--mount','type=bind,src='+str(work)+',dst=/work','-e','HOME=/tmp']
        if os.name!='nt':command+=['--user',str(os.getuid())+':'+str(os.getgid())]
        for key in ('PGHOST','PGPORT','PGUSER','PGDATABASE','PGSSLMODE','PGSSLROOTCERT','PGCONNECT_TIMEOUT','PGOPTIONS'):
            command+=['-e',key]
        command+=['--entrypoint','/bin/sh',CLIENT_IMAGE,'-c',
            'umask 077; cp /work/pgpass /tmp/pgpass; chmod 600 /tmp/pgpass; export PGPASSFILE=/tmp/pgpass; exec "$@"',
            'shena',program,'--no-password',*mapped]
    else:command=[program,'--no-password',*args]
    result = subprocess.run(command, env=env, stdout=stdout if stdout is not None else subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode: raise RuntimeError(program + ' échoué (journal SQL masqué pour protéger les données)')
    return result.stdout


def connect_source(token, project, work):
    endpoints = source_endpoints(project, api(token, '/config/database/pooler'))
    write_ca_bundle(work/'ca.pem')
    credentials = api(token, '/cli/login-role', {'read_only': True})
    role = credentials['role']; password = credentials['password']
    if not re.fullmatch(r'[a-zA-Z_][a-zA-Z0-9_]{0,62}',role) or any(c in password for c in ('\n','\r','\0')): raise RuntimeError('Identifiants temporaires non conformes')
    failures = []
    for mode, host, port in endpoints:
        user = role + ('.' + REF if mode == 'session' else '')
        pgpass = work / 'pgpass'
        escaped = password.replace('\\', '\\\\').replace(':', '\\:')
        pgpass.write_text(f'{host}:{port}:postgres:{user}:{escaped}\n'); pgpass.chmod(0o600)
        env = pg_env(host, port, user, pgpass)
        conn = None
        try:
            conn = psycopg.connect(host=host, port=port, dbname='postgres', user=user, password=password,
                sslmode='verify-full', sslrootcert=str(work/'ca.pem'), connect_timeout=10, autocommit=True,
                options='-c default_transaction_read_only=on -c search_path=pg_catalog -c timezone=UTC')
            conn.execute(sql.SQL('SET ROLE {}').format(sql.Identifier(ROLE)))
            # Test du même transport et de la même sélection de rôle que pg_dump.
            pg_call('psql', ['-X','-At','-v','ON_ERROR_STOP=1','-c','SET ROLE '+ROLE+'; SELECT current_user;'], env)
            check_source(conn)
            return conn, env, mode
        except (psycopg.Error, RuntimeError) as e:
            if conn: conn.close()
            if isinstance(e,SourceSecurityError):raise
            failures.append(mode + ':' + (e.sqlstate or 'connection') if isinstance(e, psycopg.Error) else mode + ':client')
    raise RuntimeError('Connexions officielles refusées (' + ','.join(failures) + '). Aucun contournement tenté.')


def check_source(conn):
    row = conn.execute("SELECT current_user,current_database(),current_setting('transaction_read_only'),current_setting('server_version_num')::int").fetchone()
    if row[:3] != (ROLE,'postgres','on') or not 170000 <= row[3] < 180000: raise SourceSecurityError('Identité SQL/version/lecture seule inattendue')
    flags = conn.execute("SELECT rolsuper,rolcreaterole,rolcreatedb,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=current_user").fetchone()
    if flags != (False,False,False,False,True): raise SourceSecurityError('Rôle sauvegarde non conforme ; aucune permission modifiée')
    unsafe = conn.execute("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN('r','p') AND n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema' AND (has_table_privilege(c.oid,'INSERT') OR has_table_privilege(c.oid,'UPDATE') OR has_table_privilege(c.oid,'DELETE') OR has_table_privilege(c.oid,'TRUNCATE') OR has_any_column_privilege(c.oid,'INSERT') OR has_any_column_privilege(c.oid,'UPDATE'))").fetchone()[0]
    if unsafe: raise SourceSecurityError('Rôle de sauvegarde possède un droit écriture : arrêt')
    if conn.execute("SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname IN('public','auth','storage') AND has_schema_privilege(oid,'CREATE'))").fetchone()[0]: raise SourceSecurityError('Droit CREATE inattendu')


def storage_state(conn):
    buckets = [x[0] for x in conn.execute('SELECT to_jsonb(b) FROM storage.buckets b ORDER BY id')]
    objects = [x[0] for x in conn.execute("SELECT to_jsonb(o)-'last_accessed_at' FROM storage.objects o ORDER BY bucket_id,name")]
    return {'buckets': buckets, 'objects': objects}


def capture(token, project, work):
    conn, env, mode = connect_source(token, project, work)
    try:
        # Exporter les rôles avant le dump : aucune nouvelle connexion après TTL.
        pg_call('pg_dumpall', ['--roles-only','--no-role-passwords','--role='+ROLE,'--file='+str(work/'roles.sql')], env)
        conn.execute('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
        snapshot = conn.execute('SELECT pg_export_snapshot()').fetchone()[0]
        preloads = conn.execute("SELECT current_setting('shared_preload_libraries')").fetchone()[0]
        state = storage_state(conn)
        pg_call('pg_dump', ['--format=custom','--role='+ROLE,'--snapshot='+snapshot,'--file='+str(work/'database.dump')], env)
        toc = pg_call('pg_restore', ['--list',str(work/'database.dump')], env)
        (work/'database-toc.txt').write_bytes(toc)
        expected = {'roles':[x[0] for x in conn.execute('SELECT rolname FROM pg_roles ORDER BY rolname')],
                    'role_attributes':[list(x) for x in conn.execute('SELECT rolname,rolsuper,rolbypassrls FROM pg_roles ORDER BY rolname')],
                    'catalog':conn.execute(catalog_query()).fetchone()[0], 'tables':[]}
        # catalog_query retourne du texte JSON, pas un objet selon l'adaptation.
        if isinstance(expected['catalog'],str): expected['catalog']=json.loads(expected['catalog'])
        if conn.execute("SELECT EXISTS(SELECT 1 FROM pg_class WHERE relkind='f')").fetchone()[0]: raise RuntimeError('Tables étrangères : plan de sauvegarde spécifique requis')
        tables = conn.execute("SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN('r','p','m') AND n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema' ORDER BY 1,2").fetchall()
        for schema, table in tables:
            h = hashlib.sha256(); count=0
            with conn.cursor(name='hash_'+uuid.uuid4().hex) as cursor:
                cursor.execute(table_hash_query(schema,table))
                for (row,) in cursor: h.update(row.encode()+b'\n'); count+=1
            expected['tables'].append({'schema':schema,'table':table,'rows':count,'sha256':h.hexdigest()})
        bucket_map={b['id']:b for b in state['buckets']}
        headers={}
        if any(not b['public'] for b in state['buckets']):
            keys=api(token,'/api-keys'); secret=next((k.get('api_key') for k in keys if k.get('name')=='service_role'),None)
            if not secret: raise RuntimeError('Accès serveur Storage privé absent ; aucune clé de navigateur utilisée')
            headers={'apikey':secret,'Authorization':'Bearer '+secret}
        rows=[]; (work/'objects').mkdir()
        for i,obj in enumerate(state['objects']):
            if obj['bucket_id'] in ('.','..') or any(part in ('','.','..') for part in obj['name'].split('/')):raise RuntimeError('Chemin Storage non canonique : arrêt avant téléchargement')
            path=urllib.parse.quote(obj['bucket_id'],safe='')+'/'+urllib.parse.quote(obj['name'],safe='/')
            public=bucket_map[obj['bucket_id']]['public']
            url='https://'+REF+'.supabase.co/storage/v1/object/'+('public/' if public else '')+path
            filename=f'objects/{i:08d}.bin'; target=work/filename
            with request(url,{} if public else headers) as stream, open(target,'xb') as out:
                shutil.copyfileobj(stream,out,CHUNK)
            size=(obj.get('metadata') or {}).get('size')
            if size is not None and target.stat().st_size!=int(size): raise RuntimeError('Taille objet différente de son inventaire')
            rows.append({'bucket_id':obj['bucket_id'],'object_path':obj['name'],'file':filename,'sha256':digest(target)})
        conn.execute('ROLLBACK')
        conn.execute('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
        if storage_state(conn)!=state: raise RuntimeError('Storage modifié pendant la capture : recommencer')
        conn.execute('ROLLBACK')
        for name,value in [('source-inventory.json',expected),('storage-inventory.json',state),('storage-files.json',rows)]:
            (work/name).write_text(json.dumps(value,sort_keys=True))
        # Ne jamais archiver pgpass ni les identifiants API temporaires.
        (work/'pgpass').unlink(missing_ok=True)
        (work/'ca.pem').unlink(missing_ok=True)
        names=[p for p in work.rglob('*') if p.is_file()]
        manifest={'project_ref':REF,'connection_mode':mode,'preloads':preloads,'files':{p.relative_to(work).as_posix():digest(p) for p in names}}
        (work/'manifest.json').write_text(json.dumps(manifest,sort_keys=True))
        return manifest
    finally: conn.close()


def restore_receipt(a, store, vault, root, receipt):
    if receipt.get('project_ref')!=REF or not re.fullmatch('[a-f0-9]{32}',receipt.get('backup_id','')):
        raise ValueError('Reçu de sauvegarde SHENA attendu')
    if receipt.get('provider')!='google-drive' or receipt.get('key_id')!=vault.key_id:raise RuntimeError('Destination ou coffre inattendu')
    receipt['storage_service_restore_verified']=False
    receipt['restoration_last_attempt_at']=datetime.now(timezone.utc).isoformat()
    receipt['database_restore_verified']=False
    receipt['storage_bytes_restore_verified']=False
    receipt['migration_gate_open']=False
    with tempfile.TemporaryDirectory(prefix='restore-',dir=root) as folder:
        restore=private_directory(folder); downloaded=restore/'remote.shena'
        store.download(receipt,downloaded)
        if digest(downloaded)!=receipt['archive_sha256']:raise RuntimeError('Archive distante altérée')
        receipt['durable_copy_readback_verified']=True
        plain=restore/'archive.tar.gz';decrypt_file(downloaded,plain,vault,vault.key_id,receipt['backup_id'])
        files=restore/'files';files.mkdir();manifest=extract_verified(plain,files)
        if manifest.get('project_ref')!=REF:raise RuntimeError('Projet archive inattendu')
        expected=json.loads((files/'source-inventory.json').read_text())
        image=a.restore_image or receipt.get('restore_image_candidate')
        if not image:raise RuntimeError('Image Supabase compatible à préciser ; aucune restauration présumée')
        receipt.update(restore_database(files,image,expected,manifest['preloads']))
        rows=json.loads((files/'storage-files.json').read_text())
        state=json.loads((files/'storage-inventory.json').read_text())
        if {(r['bucket_id'],r['object_path']) for r in rows}!={(r['bucket_id'],r['name']) for r in state['objects']} or len(rows)!=len(state['objects']):
            raise RuntimeError('Couverture Storage incomplète')
        for row in rows:
            path=(files/row['file']).resolve()
            if not path.is_relative_to(files.resolve()) or digest(path)!=row['sha256']:raise RuntimeError('Octets Storage restaurés différents')
        receipt['storage_bytes_restore_verified']=True
        receipt['storage_objects_verified']=len(rows)
        receipt['review_required']=['Service Storage isolé et ses RLS','Attributs/appartenances des rôles système','Secrets externes/Vault et intégrations','Tests des migrations déjà examinées sur la copie']


def execute(a):
    os.umask(0o077)
    root=private_directory(a.output)
    binary=ensure_rclone(root.parent/'backup-tools/rclone')
    with tempfile.TemporaryDirectory(prefix='access-',dir=root) as folder:
        access=private_directory(folder);config=access/'rclone.conf'
        if a.authorize_drive:
            authorize(binary,config)
        else:config.write_text(load_config())
        try:
            if a.configure_github:
                token=operator_token()
                configure_github(config,token)
                return
            store=DriveStore(binary,config);vault=LocalVault()
            if a.restore_latest:
                with tempfile.TemporaryDirectory(prefix='receipt-',dir=root) as folder:
                    receipt=store.latest_report(vault,private_directory(folder))
                report=root/(uuid.uuid4().hex+'-receipt.json')
                try:restore_receipt(a,store,vault,root,receipt)
                finally:
                    report.write_text(json.dumps(receipt,indent=2)+'\n')
                    store.save_report(receipt,vault)
                print('Copie Drive restaurée ; reçu privé : '+str(report))
                return
            if a.restore_receipt:
                receipt=json.loads(a.restore_receipt.read_text())
                try:restore_receipt(a,store,vault,root,receipt)
                finally:a.restore_receipt.write_text(json.dumps(receipt,indent=2)+'\n')
                print('Restauration vérifiée selon le rapport ; aucune migration automatique.')
                return
            prepare_pg_tools()
            token=operator_token();project=api(token)
            if project.get('id')!=REF or project.get('status')!='ACTIVE_HEALTHY':raise RuntimeError('Projet Production non identifié ou non sain')
            if a.test_connections:
                with tempfile.TemporaryDirectory(prefix='probe-',dir=root) as work:
                    conn,env,mode=connect_source(token,project,private_directory(work));conn.close()
                print('Connexion officielle et rôle lecture seule vérifiés.')
                return
            run_backup(a,root,store,vault,token,project)
        finally:
            # Préserver le renouvellement OAuth dans le coffre, jamais dans un artefact.
            if config.exists() and not os.environ.get('SHENA_RCLONE_CONFIG_B64'):save_config(config.read_text())


def operator_token():
    token=os.environ.get('SUPABASE_ACCESS_TOKEN')
    if not token and not os.environ.get('CI'):token=secret_get('supabase-operator')
    if not token:
        if not sys.stdin.isatty():raise RuntimeError('Jeton Supabase requis dans le coffre de secrets du runner')
        token=getpass.getpass('Jeton Supabase opérateur (masqué, conservé au coffre OS) : ')
        if token:secret_set('supabase-operator',token)
    if not token:raise RuntimeError('Jeton opérateur requis')
    return token


def run_backup(a,root,store,vault,token,project):
    backup_id=uuid.uuid4().hex
    key,wrapped=vault.new_data_key(backup_id)
    receipt={'project_ref':REF,'backup_id':backup_id,'provider':'google-drive','created_at':datetime.now(timezone.utc).isoformat(),
             'key_id':vault.key_id,'database_restore_verified':False,
             'storage_bytes_restore_verified':False,'storage_service_restore_verified':False,
             'migration_gate_open':False,'production_migrations_executed':False}
    source_version=project['database'].get('version','')
    if source_version and re.fullmatch(r'[0-9.]+',source_version):receipt['restore_image_candidate']='supabase/postgres:'+source_version
    receipt_file=root/(backup_id+'-receipt.json')
    try:
        with tempfile.TemporaryDirectory(prefix='plaintext-',dir=root) as folder:
            work=private_directory(folder);capture(token,project,work)
            archive=root/(backup_id+'.tar.gz');archive_created=False
            try:
                with open(archive,'xb') as raw:
                    archive_created=True
                    with tarfile.open(fileobj=raw,mode='w:gz') as tar:
                        for p in sorted(work.rglob('*')):
                            if p.is_file():tar.add(p,arcname=p.relative_to(work).as_posix(),recursive=False)
                encrypted=root/(backup_id+'.shena')
                encrypt_file(archive,encrypted,key,wrapped,vault.key_id,backup_id)
                del key
            finally:
                if archive_created:archive.unlink(missing_ok=True)
        receipt.update(store.upload(backup_id+'/backup.shena',encrypted))
        receipt['archive_sha256']=digest(encrypted)
        # Restauration depuis Drive ; altération de l'archive détectée avant déchiffrement.
        restore_receipt(a,store,vault,root,receipt)
        receipt['durable_copy_readback_verified']=True
    finally:
        # Un échec de pg_restore doit aussi laisser une preuve récupérable dans
        # Drive, chiffrée, puisque le runner ne publie aucun artefact GitHub.
        try:
            if receipt.get('drive_file_id'):
                receipt['encrypted_report_path']=store.save_report(receipt,vault)
        finally:
            receipt_file.write_text(json.dumps(receipt,indent=2)+'\n')
            print('Rapport privé : '+str(receipt_file))
    print('Base et octets restaurés ; aucune migration automatique. Rapport à examiner.')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--authorize-drive',action='store_true')
    parser.add_argument('--configure-github',action='store_true')
    parser.add_argument('--test-connections',action='store_true')
    parser.add_argument('--restore-receipt',type=Path)
    parser.add_argument('--restore-latest',action='store_true')
    parser.add_argument('--restore-image',help='Image Supabase PostgreSQL compatible ; empreinte résolue et enregistrée')
    default=Path(os.environ.get('LOCALAPPDATA',Path.home()/'.local/state'))/'SHENA/backups'
    parser.add_argument('--output',type=Path,default=default)
    a=parser.parse_args()
    try:execute(a)
    except Exception as e:
        # Ne pas imprimer les exceptions SDK, libpq ou SQL contenant des secrets.
        print('ARRÊT : '+(str(e) if isinstance(e,(RuntimeError,ValueError)) else type(e).__name__+' ; vérifier les accès/outils et le rapport privé'),file=sys.stderr)
        return 1
    return 0

if __name__=='__main__':sys.exit(main())
