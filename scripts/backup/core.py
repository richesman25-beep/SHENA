"""Primitives locales : aucune connexion Production, aucune migration."""
import base64
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import struct
import subprocess
import tarfile
import time
import uuid
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

REF = 'xxadpoebcslutlevzdsy'
MAGIC = b'SHENA-BACKUP-1\n'
CHUNK = 1024 * 1024
REPO = Path(__file__).resolve().parents[2]


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(CHUNK), b''): h.update(chunk)
    return h.hexdigest()


def private_directory(path):
    path = Path(path).resolve()
    if path.is_relative_to(REPO): raise ValueError('Répertoire privé hors Git obligatoire')
    path.mkdir(mode=0o700, parents=True, exist_ok=True)
    if os.name == 'nt':
        # SID du compte courant ; pas de nom localisé, ni secret dans la commande.
        import re
        raw = subprocess.check_output(['whoami', '/user', '/fo', 'csv', '/nh'])
        matches = re.findall(rb'S-1-[0-9-]+', raw)
        if not matches: raise RuntimeError('SID Windows introuvable')
        sid = matches[-1].decode('ascii')
        subprocess.run(['icacls', str(path), '/inheritance:r', '/grant:r', '*' + sid + ':(OI)(CI)F'], check=True, stdout=subprocess.DEVNULL)
    else: path.chmod(0o700)
    return path


def encrypt_file(source, target, key, wrapped_key, key_id, backup_id):
    header = {'project_ref': REF, 'backup_id': backup_id, 'key_id': key_id,
              'wrapped_key': base64.b64encode(wrapped_key).decode(),
              'nonce': base64.b64encode(os.urandom(12)).decode()}
    raw = json.dumps(header, sort_keys=True, separators=(',', ':')).encode()
    cipher = Cipher(algorithms.AES(key), modes.GCM(base64.b64decode(header['nonce']))).encryptor()
    cipher.authenticate_additional_data(raw)
    with open(target, 'xb') as out, open(source, 'rb') as inp:
        out.write(MAGIC + struct.pack('>I', len(raw)) + raw)
        for chunk in iter(lambda: inp.read(CHUNK), b''): out.write(cipher.update(chunk))
        out.write(cipher.finalize()); out.write(cipher.tag)
    return header


def decrypt_file(source, target, key_provider, expected_key_id, expected_backup_id):
    target = Path(target)
    created = False
    try:
        with open(source, 'rb') as inp:
            if inp.read(len(MAGIC)) != MAGIC: raise ValueError('Format archive inconnu')
            size_bytes = inp.read(4)
            if len(size_bytes) != 4: raise ValueError('Archive tronquée')
            size = struct.unpack('>I', size_bytes)[0]
            if not 1 <= size <= 16384: raise ValueError('En-tête invalide')
            raw = inp.read(size); header = json.loads(raw)
            if header['project_ref'] != REF or header['key_id'] != expected_key_id or header['backup_id'] != expected_backup_id:
                raise ValueError('Cible ou clé inattendue')
            key = key_provider.unwrap(base64.b64decode(header['wrapped_key']),
                              {'project_ref': REF, 'backup_id': expected_backup_id},expected_key_id)
            start = inp.tell(); inp.seek(0, 2); end = inp.tell() - 16
            if end < start: raise ValueError('Archive tronquée')
            inp.seek(end); tag = inp.read(16); inp.seek(start)
            dec = Cipher(algorithms.AES(key), modes.GCM(base64.b64decode(header['nonce']), tag)).decryptor()
            dec.authenticate_additional_data(raw)
            with open(target, 'xb') as out:
                created = True
                remaining = end - start
                while remaining:
                    chunk = inp.read(min(CHUNK, remaining))
                    if not chunk: raise ValueError('Archive tronquée')
                    remaining -= len(chunk); out.write(dec.update(chunk))
                out.write(dec.finalize())
    except Exception:
        if created: target.unlink(missing_ok=True)
        raise


def extract_verified(archive, directory):
    root = Path(directory).resolve()
    with tarfile.open(archive, 'r:gz') as tar:
        members = tar.getmembers()
        names = set()
        for member in members:
            path = (root / member.name).resolve()
            canonical = PurePosixPath(member.name)
            if canonical.is_absolute() or '..' in canonical.parts or canonical.as_posix()!=member.name or ':' in member.name or '\\' in member.name or not path.is_relative_to(root) or not member.isfile() or str(path) in names:
                raise ValueError('Archive contient un chemin, lien ou doublon non autorisé')
            names.add(str(path))
        # Python 3.12+ : ne jamais restaurer liens, appareils ou permissions source.
        tar.extractall(root, members=members, filter='data')
    manifest = json.loads((root / 'manifest.json').read_text())
    expected = set(manifest['files']) | {'manifest.json'}
    names = {Path(p).relative_to(root).as_posix() for p in names}
    if names != expected: raise ValueError('Inventaire archive incomplet ou inattendu')
    for name, sha in manifest['files'].items():
        if digest(root / name) != sha: raise ValueError('Checksum de fichier invalide')
    return manifest


def sql_ident(value): return '"' + value.replace('"', '""') + '"'


def checked(args, **kwargs):
    result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, **kwargs)
    if result.returncode:
        # stderr SQL peut contenir une ligne Auth ou un secret : jamais dans les logs.
        raise RuntimeError('Échec outil ' + Path(args[0]).name + ' ; détails SQL non publiés')
    return result.stdout


def restore_database(root, image, expected, preloads):
    """Restauration Docker sans réseau/port/montage hôte ; ne cible jamais une URL."""
    root = Path(root); name = 'shena-restore-' + uuid.uuid4().hex[:12]
    checked(['docker', 'pull', image])
    info = json.loads(checked(['docker', 'image', 'inspect', image]))[0]
    digests = info.get('RepoDigests') or []
    if not digests: raise RuntimeError('Image sans empreinte immuable')
    pinned = digests[0]
    args = ['docker', 'run', '-d', '--name', name, '--network', 'none', '--read-only',
            '--tmpfs', '/tmp:rw,nosuid,nodev,mode=1777', '--user', 'postgres', '--entrypoint', '/bin/sh', pinned,
            '-c', 'umask 077; initdb -D /tmp/shena-pg -A trust >/dev/null && exec postgres -D /tmp/shena-pg -c listen_addresses= -c unix_socket_directories=/tmp "$@"',
            'shena', '-c', 'shared_preload_libraries=' + preloads, '-c', 'cron.launch_active_jobs=off']
    started = False
    try:
        checked(args); started = True
        for _ in range(60):
            ready = subprocess.run(['docker', 'exec', name, 'pg_isready', '-h', '/tmp', '-U', 'postgres'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if ready.returncode == 0: break
            time.sleep(0.5)
        else: raise RuntimeError('Image incompatible ou démarrage isolé échoué')
        def psql(query):
            return checked(['docker', 'exec', '-i', name, 'psql', '-X', '-h', '/tmp', '-U', 'postgres', '-d', 'postgres', '-Atq', '-v', 'ON_ERROR_STOP=1'], input=("SET search_path=pg_catalog; SET TIME ZONE 'UTC';"+query).encode()).decode()
        # Aucun rejeu aveugle de roles.sql : seuls les noms nécessaires sont créés.
        existing = set(psql('SELECT rolname FROM pg_roles').splitlines())
        for role in expected['roles']:
            if role not in existing:
                psql('CREATE ROLE ' + sql_ident(role) + ' NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;')
        # Adaptation explicite des rôles fournisseur dans CE conteneur sans réseau.
        # Les event triggers Supabase appartiennent à supabase_admin : PostgreSQL
        # exige que leur propriétaire soit superuser, même pendant la restauration.
        allowed_bypass = {'postgres','supabase_admin','service_role','supabase_auth_admin','supabase_storage_admin','supabase_read_only_user'}
        adapted = []
        for role, superuser, bypass in expected.get('role_attributes', []):
            if superuser and role not in {'postgres','supabase_admin'}:
                raise RuntimeError('Rôle superuser non examiné dans la source : arrêt isolé')
            if bypass and role not in allowed_bypass:
                raise RuntimeError('Rôle BYPASSRLS non examiné dans la source : arrêt isolé')
            if role == 'supabase_admin' and superuser:
                psql('ALTER ROLE supabase_admin SUPERUSER NOLOGIN;')
                adapted.append('supabase_admin:SUPERUSER:NOLOGIN')
            if role != 'postgres' and bypass:
                psql('ALTER ROLE '+sql_ident(role)+' BYPASSRLS NOLOGIN;')
                adapted.append(role+':BYPASSRLS:NOLOGIN')
        with (root / 'database.dump').open('rb') as inp:
            checked(['docker', 'exec', '-i', name, 'pg_restore', '-h', '/tmp', '-U', 'postgres', '--exit-on-error', '--single-transaction', '--dbname=postgres'], stdin=inp)
        for table in expected['tables']:
            query = table_hash_query(table['schema'], table['table'])
            result = checked(['docker', 'exec', name, 'psql', '-X', '-h', '/tmp', '-U', 'postgres', '-d', 'postgres', '-Atq', '-v', 'ON_ERROR_STOP=1', '-c', "SET search_path=pg_catalog; SET TIME ZONE 'UTC';" + query]).decode().split('\n')
            result = [row for row in result if row]
            if result and result[0] == 'SET': result = result[1:]
            h = hashlib.sha256()
            for row in result: h.update(row.encode() + b'\n')
            if len(result) != table['rows'] or h.hexdigest() != table['sha256']:
                raise RuntimeError('Données restaurées différentes : arrêt')
        catalog = json.loads(psql(catalog_query()))
        if catalog != expected['catalog']: raise RuntimeError('Contraintes/ACL/RLS/fonctions restaurées différentes')
        return {'database_restore_verified': True, 'restore_image': pinned,
                'tables_verified': len(expected['tables']), 'system_role_attributes_replayed': False, 'isolated_platform_role_adapter': adapted}
    finally:
        if started:
            subprocess.run(['docker', 'rm', '-f', '-v', name], check=True, stdout=subprocess.DEVNULL)


def table_hash_query(schema, table):
    return 'SELECT to_jsonb(t)::text FROM ONLY ' + sql_ident(schema) + '.' + sql_ident(table) + ' t ORDER BY to_jsonb(t)::text COLLATE "C"'


def catalog_query():
    # Noms de rôle et de table, pas les OID locaux qui changent à la restauration.
    return """SELECT jsonb_build_object(
 'tables',(SELECT COALESCE(jsonb_agg(x ORDER BY x->>'schema',x->>'name'),'[]'::jsonb) FROM
 (SELECT jsonb_build_object('schema',n.nspname,'name',c.relname,'rls',c.relrowsecurity,'force',c.relforcerowsecurity,'owner',pg_get_userbyid(c.relowner),
 'acl',(SELECT COALESCE(jsonb_agg(jsonb_build_array(CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable) ORDER BY a.grantee=0,pg_get_userbyid(a.grantee),pg_get_userbyid(a.grantor),a.privilege_type),'[]'::jsonb) FROM aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner))) a),
 'columns',(SELECT jsonb_agg(jsonb_build_array(attname,format_type(atttypid,atttypmod),attnotnull,pg_get_expr(d.adbin,d.adrelid),attidentity,attgenerated,(SELECT COALESCE(jsonb_agg(jsonb_build_array(CASE WHEN a2.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a2.grantee) END,pg_get_userbyid(a2.grantor),a2.privilege_type,a2.is_grantable) ORDER BY pg_get_userbyid(a2.grantee),pg_get_userbyid(a2.grantor),a2.privilege_type),'[]'::jsonb) FROM aclexplode(a.attacl) a2)) ORDER BY attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
 'constraints',(SELECT COALESCE(jsonb_agg(jsonb_build_array(conname,pg_get_constraintdef(oid),convalidated) ORDER BY conname),'[]'::jsonb) FROM pg_constraint WHERE conrelid=c.oid)) AS x
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN('r','p','m') AND n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema') q),
 'schemas',(SELECT COALESCE(jsonb_agg(jsonb_build_array(n.nspname,pg_get_userbyid(n.nspowner),(SELECT COALESCE(jsonb_agg(jsonb_build_array(CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable) ORDER BY pg_get_userbyid(a.grantee),pg_get_userbyid(a.grantor),a.privilege_type),'[]'::jsonb) FROM aclexplode(COALESCE(n.nspacl,acldefault('n',n.nspowner))) a)) ORDER BY n.nspname),'[]'::jsonb) FROM pg_namespace n WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema'),
 'defaults',(SELECT COALESCE(jsonb_agg(jsonb_build_array(pg_get_userbyid(d.defaclrole),COALESCE(n.nspname,''),d.defaclobjtype,(SELECT COALESCE(jsonb_agg(jsonb_build_array(CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable) ORDER BY pg_get_userbyid(a.grantee),pg_get_userbyid(a.grantor),a.privilege_type),'[]'::jsonb) FROM aclexplode(d.defaclacl) a)) ORDER BY pg_get_userbyid(d.defaclrole),n.nspname,d.defaclobjtype),'[]'::jsonb) FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace),
 'sequences',(SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY schemaname,sequencename),'[]'::jsonb) FROM pg_sequences s WHERE schemaname NOT LIKE 'pg_%'),
 'indexes',(SELECT COALESCE(jsonb_agg(to_jsonb(i) ORDER BY schemaname,indexname),'[]'::jsonb) FROM pg_indexes i WHERE schemaname NOT LIKE 'pg_%' AND schemaname<>'information_schema'),
 'event_triggers',(SELECT COALESCE(jsonb_agg(jsonb_build_array(e.evtname,e.evtevent,pg_get_userbyid(e.evtowner),e.evtfoid::regproc::text,e.evtenabled,e.evttags) ORDER BY e.evtname),'[]'::jsonb) FROM pg_event_trigger e),
 'views',(SELECT COALESCE(jsonb_agg(to_jsonb(v) ORDER BY schemaname,viewname),'[]'::jsonb) FROM pg_views v WHERE schemaname NOT LIKE 'pg_%' AND schemaname<>'information_schema'),
 'extensions',(SELECT COALESCE(jsonb_agg(jsonb_build_array(extname,extversion) ORDER BY extname),'[]'::jsonb) FROM pg_extension),
 'triggers',(SELECT COALESCE(jsonb_agg(jsonb_build_array(n.nspname,c.relname,t.tgname,pg_get_triggerdef(t.oid),t.tgenabled) ORDER BY n.nspname,c.relname,t.tgname),'[]'::jsonb) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal),
 'policies',(SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY schemaname,tablename,policyname),'[]'::jsonb) FROM pg_policies p WHERE schemaname NOT LIKE 'pg_%'),
 'functions',(SELECT COALESCE(jsonb_agg(jsonb_build_array(n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),p.prosecdef,p.proconfig,pg_get_userbyid(p.proowner),p.prosrc,p.probin,p.prokind,p.provolatile,(SELECT COALESCE(jsonb_agg(jsonb_build_array(CASE WHEN a2.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a2.grantee) END,pg_get_userbyid(a2.grantor),a2.privilege_type,a2.is_grantable) ORDER BY pg_get_userbyid(a2.grantee),pg_get_userbyid(a2.grantor),a2.privilege_type),'[]'::jsonb) FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a2)) ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)),'[]'::jsonb) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema')
)::text;"""
