"""Google Drive privé via rclone ; clé dans le coffre OS, jamais dans Drive."""
import base64
import configparser
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import secrets
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import zipfile
import keyring
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from core import REF, CHUNK, digest, private_directory

SERVICE='SHENA Backup'
REMOTE='shena-drive'

# Codes publics connus seulement : jamais message, corps ou identifiant.
GOOGLE_REASONS=frozenset({
 'insufficientPermissions','insufficientFilePermissions','appNotAuthorizedToFile',
 'accessNotConfigured','forbidden','domainPolicy','rateLimitExceeded',
 'userRateLimitExceeded','dailyLimitExceeded','storageQuotaExceeded',
 'sharingRateLimitExceeded','notFound','authError','backendError',
 'ACCESS_TOKEN_SCOPE_INSUFFICIENT','SERVICE_DISABLED','API_KEY_SERVICE_BLOCKED',
 'USER_PROJECT_DENIED','RATE_LIMIT_EXCEEDED','ACCESS_DENIED',
})

class GoogleDriveError(RuntimeError):
    def __init__(self,status,operation,reasons):
        self.status=status;self.operation=operation
        self.reasons=tuple(sorted(set(r for r in reasons if isinstance(r,str) and r in GOOGLE_REASONS))) or ('unknown',)
        super().__init__('Google Drive HTTP '+str(status)+' ; requête='+operation+' ; reason='+','.join(self.reasons))


def google_operation(path,body=None):
    route=urllib.parse.urlsplit(path).path
    if route=='files':return 'files.create' if body is not None else 'files.list'
    if re.fullmatch(r'files/[A-Za-z0-9_-]+/permissions',route):return 'permissions.list'
    if re.fullmatch(r'files/[A-Za-z0-9_-]+',route):return 'files.get'
    return 'drive.request'


def safe_google_reasons(error):
    try:
        payload=json.loads(error.read(16384)).get('error',{})
        records=[*(payload.get('errors') or []),*(payload.get('details') or [])]
        return [r.get('reason') for r in records if isinstance(r,dict)]
    except Exception:return []


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):raise RuntimeError('Redirection refusée pour protéger OAuth')


def secret_get(name):
    backend=keyring.get_keyring()
    if not backend.__class__.__module__.startswith(('keyring.backends.Windows','keyring.backends.macOS','keyring.backends.SecretService')):
        raise RuntimeError('Coffre OS sécurisé requis ; aucun stockage de secrets en fichier texte')
    return keyring.get_password(SERVICE,name)


def secret_set(name,value):
    # Même contrôle que la lecture, sans accepter de backend plaintext.
    secret_get(name)
    keyring.set_password(SERVICE,name,value)


def save_config(value):
    parts=[value[i:i+700] for i in range(0,len(value),700)]
    for i,part in enumerate(parts):secret_set('rclone-'+str(i),part)
    secret_set('rclone-count',str(len(parts)))


def load_config():
    value=os.environ.get('SHENA_RCLONE_CONFIG_B64')
    if value:return base64.b64decode(value,validate=True).decode('utf-8')
    count=int(secret_get('rclone-count') or '0')
    if not 1<=count<=64:raise RuntimeError('Autorisation Google initiale nécessaire')
    parts=[secret_get('rclone-'+str(i)) for i in range(count)]
    if any(p is None for p in parts):raise RuntimeError('Configuration du coffre incomplète')
    return ''.join(parts)


class LocalVault:
    def __init__(self,create=False):
        raw=os.environ.get('SHENA_BACKUP_MASTER_KEY')
        if not raw:
            raw=secret_get('master-v1')
            if not raw and create:
                raw=base64.b64encode(secrets.token_bytes(32)).decode();secret_set('master-v1',raw)
        if not raw:raise RuntimeError('Clé absente du coffre séparé de Drive')
        self.master=base64.b64decode(raw,validate=True)
        if len(self.master)!=32:raise ValueError('Clé de coffre 256 bits requise')
        self.key_id='os-vault:'+hashlib.sha256(self.master).hexdigest()

    def new_data_key(self,backup_id):
        key=secrets.token_bytes(32);nonce=secrets.token_bytes(12)
        aad=json.dumps({'project_ref':REF,'backup_id':backup_id},sort_keys=True).encode()
        return key,nonce+AESGCM(self.master).encrypt(nonce,key,aad)

    def unwrap(self,wrapped,context,key_id):
        if key_id!=self.key_id or context.get('project_ref')!=REF:raise ValueError('Coffre ou projet différent')
        aad=json.dumps(context,sort_keys=True).encode()
        return AESGCM(self.master).decrypt(wrapped[:12],wrapped[12:],aad)


def ensure_rclone(directory):
    existing=shutil.which('rclone')
    if existing:return existing
    directory=Path(directory);directory.mkdir(parents=True,exist_ok=True)
    binary=directory/('rclone.exe' if os.name=='nt' else 'rclone')
    if binary.exists():return str(binary)
    def read(url):
        req=urllib.request.Request(url,headers={'User-Agent':'SHENA-backup/1.0'})
        with urllib.request.urlopen(req,timeout=90) as stream:return stream.read()
    system={'Windows':'windows','Linux':'linux','Darwin':'osx'}.get(platform.system())
    arch={'ARM64':'arm64','AMD64':'amd64','x86_64':'amd64','arm64':'arm64','aarch64':'arm64'}.get(platform.machine())
    if not system or not arch:raise RuntimeError('Installer rclone officiel pour cette plateforme')
    try:
        version=read('https://downloads.rclone.org/version.txt').decode().strip()
        if not re.fullmatch(r'rclone v\d+\.\d+\.\d+',version):raise RuntimeError('Version rclone officielle non reconnue')
        version=version.split()[1];filename=f'rclone-{version}-{system}-{arch}.zip'
        base='https://downloads.rclone.org/'+version+'/'
        checks=read(base+'SHA256SUMS').decode();data=read(base+filename)
    except urllib.error.HTTPError as e:
        if e.code not in (403,404,429,500,502,503):raise
        # Autre distribution officielle du MÊME projet, jamais un miroir tiers.
        release=json.loads(read('https://api.github.com/repos/rclone/rclone/releases/latest'))
        version=release['tag_name']
        if not re.fullmatch(r'v\d+\.\d+\.\d+',version) or release.get('prerelease') or release.get('draft'):
            raise RuntimeError('Version stable rclone requise')
        filename=f'rclone-{version}-{system}-{arch}.zip'
        assets={asset['name']:asset['browser_download_url'] for asset in release['assets']}
        prefix='https://github.com/rclone/rclone/releases/download/'+version+'/'
        for name in ('SHA256SUMS',filename):
            if not assets.get(name,'').startswith(prefix):raise RuntimeError('Distribution GitHub rclone non reconnue')
        checks=read(assets['SHA256SUMS']).decode();data=read(assets[filename])
    expected=next((line.split()[0] for line in checks.splitlines() if line.split() and line.split()[-1].lstrip('*').removeprefix('./')==filename),None)
    if not expected or hashlib.sha256(data).hexdigest()!=expected:raise RuntimeError('Téléchargement rclone non vérifié')
    import io
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        names=[name for name in archive.namelist() if name.endswith('/'+binary.name)]
        if len(names)!=1:raise RuntimeError('Archive rclone inattendue')
        with open(binary,'xb') as stream:stream.write(archive.read(names[0]))
    binary.chmod(0o700)
    return str(binary)


def rclone_environment():
    env=os.environ.copy()
    for name in ('SUPABASE_ACCESS_TOKEN','SHENA_BACKUP_MASTER_KEY','SHENA_RCLONE_CONFIG_B64'):env.pop(name,None)
    return env


class RcloneTransfer:
    """Transport commun également testé contre le backend local réel de rclone."""
    def __init__(self,binary,root,config=None):
        self.binary=binary;self.root=root.rstrip('/');self.config=config

    def call(self,*args,allow_missing=False):
        env=rclone_environment()
        command=[self.binary]
        if self.config:command+=['--config',str(self.config)]
        result=subprocess.run([*command,*args,'--log-level','ERROR'],env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        if result.returncode:
            if allow_missing and result.returncode in (3,4):return None
            raise RuntimeError('Échec transfert rclone ; aucun contenu OAuth publié')
        return result.stdout

    def path(self,key):
        if not re.fullmatch(r'[a-f0-9]{32}/(?:backup|receipt-[a-f0-9]{32})\.shena',key):raise ValueError('Chemin sauvegarde inattendu')
        return self.root+'/'+key if not self.root.endswith(':') else self.root+key

    def upload(self,key,source):
        target=self.path(key)
        if self.call('lsjson',target,'--stat',allow_missing=True) is not None:raise RuntimeError('Sauvegarde existante : aucun écrasement autorisé')
        self.call('copyto',str(source),target,'--immutable','--no-traverse')
        return json.loads(self.call('lsjson',target,'--stat'))

    def download(self,key,target):
        if Path(target).exists():raise FileExistsError('Copie de restauration doit être distincte')
        self.call('copyto',self.path(key),str(target),'--immutable','--no-traverse')


def owner_only(metadata,permissions):
    if metadata.get('trashed') or not metadata.get('ownedByMe') or metadata.get('driveId'):
        raise RuntimeError('Dossier/fichier personnel privé requis')
    if not permissions or any(p.get('type')!='user' or p.get('role')!='owner' or p.get('deleted') for p in permissions):
        raise RuntimeError('Partage Drive détecté : sauvegarde arrêtée sans modifier les permissions')


def private_metadata(meta):
    if meta.get('ownedByMe') is not True or meta.get('trashed') is not False or meta.get('driveId'):
        raise RuntimeError('Dossier/fichier personnel privé requis')
    if meta.get('shared') is not False:
        raise RuntimeError('Partage Drive présent ou état inconnu : arrêt sans modifier les permissions')
    if 'permissions' in meta:owner_only(meta,meta['permissions'])


class DriveStore:
    def __init__(self,binary,config):
        self.config=Path(config);self.binary=binary
        self.transport=RcloneTransfer(binary,REMOTE+':',config)
        self.transport.call('about',REMOTE+':','--json') # Rafraîchit OAuth avant les appels officiels.
        cfg=self.settings()
        if cfg.get('type')!='drive' or cfg.get('scope')!='drive.file':
            raise RuntimeError('Remote Google dédié drive.file et dossier privé requis')
        self.bind_folder();self.private(self.folder,is_folder=True)

    def settings(self):
        cfg=configparser.ConfigParser(interpolation=None);cfg.read(self.config,encoding='utf-8')
        if cfg.sections()!=[REMOTE]:raise RuntimeError('Configuration dédiée SHENA requise')
        return cfg[REMOTE]

    def api(self,path,body=None):
        token=json.loads(self.settings()['token'])['access_token']
        req=urllib.request.Request('https://www.googleapis.com/drive/v3/'+path,
              data=None if body is None else json.dumps(body).encode(),
              headers={'Authorization':'Bearer '+token,'Content-Type':'application/json','User-Agent':'SHENA-backup/1.0'})
        try:
            with urllib.request.build_opener(NoRedirect).open(req,timeout=60) as stream:return json.load(stream)
        except urllib.error.HTTPError as e:raise GoogleDriveError(e.code,google_operation(path,body),safe_google_reasons(e)) from None

    def private(self,file_id,is_folder=False):
        if not re.fullmatch(r'[A-Za-z0-9_-]+',file_id):raise ValueError('Identifiant Google non reconnu')
        # shared=false est l'indicateur officiel d'absence de partage My Drive.
        # Ne pas exiger permissions.list avec le scope minimal drive.file.
        meta=self.api('files/'+file_id+'?fields=id,ownedByMe,trashed,driveId,mimeType,parents,shared')
        private_metadata(meta)
        if is_folder and meta.get('mimeType')!='application/vnd.google-apps.folder':raise RuntimeError('Dossier Google requis')
        return meta

    def bind_folder(self,allow_create=False,preferred=None):
        cfg=self.settings()
        if cfg.get('type')!='drive' or cfg.get('scope')!='drive.file':raise RuntimeError('Remote Google dédié drive.file requis')
        folder=cfg.get('root_folder_id')
        if preferred and folder and preferred!=folder:raise RuntimeError('Un dossier est déjà lié : aucune substitution automatique')
        if preferred and not folder:
            self.private(preferred,is_folder=True)
            folder=preferred
            parser=configparser.ConfigParser(interpolation=None);parser.read(self.config,encoding='utf-8')
            parser[REMOTE]['root_folder_id']=folder
            with self.config.open('w',encoding='utf-8') as stream:parser.write(stream)
            if not os.environ.get('SHENA_RCLONE_CONFIG_B64'):save_config(self.config.read_text(encoding='utf-8'))
        if not folder:
            query="name = 'SHENA encrypted backups' and mimeType = 'application/vnd.google-apps.folder' and trashed = false and 'me' in owners"
            path='files?q='+urllib.parse.quote(query,safe='')+'&spaces=drive&fields=nextPageToken,files(id)'
            folders=[];page=''
            while True:
                data=self.api(path+('&pageToken='+urllib.parse.quote(page,safe='') if page else ''))
                folders.extend(data.get('files',[]));page=data.get('nextPageToken')
                if not page:break
            if len(folders)>1:raise RuntimeError('Plusieurs dossiers SHENA existent : indiquer -DriveFolderId ; aucun dossier créé ou modifié')
            if folders:folder=folders[0]['id']
            elif allow_create:folder=self.api('files?fields=id',{'name':'SHENA encrypted backups','mimeType':'application/vnd.google-apps.folder'})['id']
            else:raise RuntimeError('Aucun dossier autorisé trouvé ; reprendre avec -AuthorizeDrive')
            # Persister le contexte AVANT les contrôles : pas de dossier perdu
            # ni de nouvelle création lors de la reprise d'un ancien 403.
            parser=configparser.ConfigParser(interpolation=None);parser.read(self.config,encoding='utf-8')
            parser[REMOTE]['root_folder_id']=folder
            with self.config.open('w',encoding='utf-8') as stream:parser.write(stream)
            if not os.environ.get('SHENA_RCLONE_CONFIG_B64'):save_config(self.config.read_text(encoding='utf-8'))
        self.folder=folder
        return folder


    def locate(self,key):
        self.transport.call('about',REMOTE+':','--json')
        self.private(self.folder,is_folder=True)
        meta=json.loads(self.transport.call('lsjson',self.transport.path(key),'--stat'))
        file=self.private(meta['ID'])
        if len(file.get('parents',[]))!=1:raise RuntimeError('Parent Drive ambigu')
        parent=self.private(file['parents'][0],is_folder=True)
        if parent.get('parents')!=[self.folder]:raise RuntimeError('Dossier hors racine privée')
        return {'drive_file_id':meta['ID'],'drive_backup_folder_id':file['parents'][0],'drive_folder_id':self.folder,'object_key':key}

    def upload(self,key,source):
        self.transport.call('about',REMOTE+':','--json')
        self.private(self.folder,is_folder=True)
        self.transport.upload(key,source)
        return self.locate(key)

    def save_report(self,receipt,vault):
        from core import encrypt_file
        import uuid
        name=receipt['backup_id']+'/receipt-'+uuid.uuid4().hex+'.shena'
        with tempfile.TemporaryDirectory(prefix='report-',dir=self.config.parent) as folder:
            root=private_directory(folder);plain=root/'receipt.json';encrypted=root/'receipt.shena'
            plain.write_text(json.dumps(receipt,sort_keys=True))
            key,wrapped=vault.new_data_key(receipt['backup_id'])
            encrypt_file(plain,encrypted,key,wrapped,vault.key_id,receipt['backup_id'])
            self.upload(name,encrypted)
        return name

    def latest_report(self,vault,root):
        from core import decrypt_file
        entries=json.loads(self.transport.call('lsjson',self.transport.root,'--recursive','--files-only'))
        reports=[r for r in entries if re.fullmatch(r'[a-f0-9]{32}/receipt-[a-f0-9]{32}\.shena',r.get('Path',''))]
        if not reports:raise RuntimeError('Aucun reçu chiffré dans ce dossier Drive')
        key=max(reports,key=lambda r:r.get('ModTime',''))['Path'];meta=self.locate(key)
        encrypted=Path(root)/'receipt.shena';self.download(meta,encrypted)
        plain=Path(root)/'receipt.json'
        decrypt_file(encrypted,plain,vault,vault.key_id,key.split('/')[0])
        receipt=json.loads(plain.read_text())
        if receipt.get('backup_id')!=key.split('/')[0] or receipt.get('project_ref')!=REF:raise RuntimeError('Reçu ne correspond pas au projet/chemin')
        return receipt

    def download(self,receipt,target):
        self.transport.call('about',REMOTE+':','--json')
        if receipt.get('drive_folder_id')!=self.folder:raise RuntimeError('Autre dossier Google : arrêt')
        self.private(self.folder,is_folder=True)
        file=self.private(receipt['drive_file_id'])
        parent=self.private(receipt['drive_backup_folder_id'],is_folder=True)
        if file.get('parents')!=[receipt['drive_backup_folder_id']] or parent.get('parents')!=[self.folder]:
            raise RuntimeError('Fichier déplacé ou parent différent')
        meta=json.loads(self.transport.call('lsjson',self.transport.path(receipt['object_key']),'--stat'))
        if meta.get('ID')!=receipt['drive_file_id']:raise RuntimeError('Identité du fichier distant modifiée')
        self.transport.download(receipt['object_key'],target)


def authorize(binary,config,allow_create=True,folder_id=None):
    if not sys.stdin.isatty():raise RuntimeError('Autorisation Google à faire sur votre ordinateur avec navigateur')
    LocalVault(create=True)
    previous=None;old_config=None
    if secret_get('rclone-count'):
        old_config=load_config()
        old=configparser.ConfigParser(interpolation=None);old.read_string(old_config)
        previous=old[REMOTE].get('root_folder_id')
    print('Autorisez rclone dans le navigateur Google. Aucun code OAuth à envoyer dans le chat.')
    if old_config:
        old[REMOTE]['scope']='drive.file'
        with open(config,'w',encoding='utf-8') as stream:old.write(stream)
    command=[binary,'config','reconnect',REMOTE+':','--config',str(config)] if old_config else [binary,'config','create',REMOTE,'drive','scope','drive.file','--config',str(config)]
    result=subprocess.run(command,
                          stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=600,env=rclone_environment())
    if result.returncode:raise RuntimeError('Autorisation Google non terminée ; aucun jeton affiché')
    if previous:
        parser=configparser.ConfigParser(interpolation=None);parser.read(config,encoding='utf-8')
        parser[REMOTE]['root_folder_id']=previous
        with open(config,'w',encoding='utf-8') as stream:parser.write(stream)
    # Ne plus perdre OAuth/le dossier existant si un contrôle Google échoue.
    save_config(Path(config).read_text(encoding='utf-8'))
    temp=object.__new__(DriveStore);temp.config=Path(config);temp.binary=binary
    temp.bind_folder(allow_create=allow_create,preferred=folder_id)
    DriveStore(binary,config)
    save_config(Path(config).read_text(encoding='utf-8'))
    print('Google Drive autorisé ; dossier privé conservé, clé inchangée dans le coffre OS.')


def configure_github(config,operator_token):
    """Valeurs uniquement sur stdin de gh ; jamais dans Git, argv ou artefacts."""
    if not shutil.which('gh'):raise RuntimeError('GitHub CLI authentifié nécessaire pour configurer les secrets privés')
    existing=subprocess.run(['gh','secret','list','--repo','github.com/richesman25-beep/SHENA','--json','name'],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    if existing.returncode:raise RuntimeError('GitHub refuse les accès au coffre ; sauvegarde locale disponible')
    if any(item.get('name')=='SHENA_BACKUP_MASTER_KEY' for item in json.loads(existing.stdout)):
        raise RuntimeError('Clé Actions déjà présente : aucune clé remplacée automatiquement')
    vault=LocalVault()
    values={'SHENA_BACKUP_SUPABASE_TOKEN':operator_token,
            'SHENA_RCLONE_CONFIG_B64':base64.b64encode(Path(config).read_bytes()).decode(),
            'SHENA_BACKUP_MASTER_KEY':base64.b64encode(vault.master).decode()}
    for name,value in values.items():
        if not value:raise RuntimeError('Accès Supabase opérateur absent du coffre')
        r=subprocess.run(['gh','secret','set',name,'--repo','github.com/richesman25-beep/SHENA'],input=value.encode(),stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        if r.returncode:raise RuntimeError('GitHub refuse la configuration des secrets ; sauvegarde locale disponible')
    # Déclenchement avant fusion : commit VIDE sur la branche déjà autorisée.
    # Aucun fichier, secret ou dump n'est ajouté au dépôt.
    def gh(path,body=None,method=None):
        args=['gh','api','--hostname','github.com',path]
        if method:args+=['--method',method]
        if body is not None:args+=['--input','-']
        result=subprocess.run(args,input=None if body is None else json.dumps(body).encode(),stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        if result.returncode:raise RuntimeError('Déclenchement GitHub refusé ; secrets conservés dans leur coffre chiffré')
        return json.loads(result.stdout)
    base='repos/richesman25-beep/SHENA/'
    ref='heads/feat/shena-production-activation'
    head=gh(base+'git/ref/'+ref)['object']['sha']
    tree=gh(base+'git/commits/'+head)['tree']['sha']
    commit=gh(base+'git/commits',{'message':'SHENA private backup [shena-backup-run]','tree':tree,'parents':[head]},'POST')
    gh(base+'git/refs/'+ref,{'sha':commit['sha'],'force':False},'PATCH')
    print('Secrets Actions chiffrés configurés et sauvegarde déclenchée ; aucune valeur publiée.')


def diagnose_drive(binary,config):
    """GET uniquement : ni création Google ni requête Supabase."""
    temp=object.__new__(DriveStore);temp.config=Path(config);temp.binary=binary
    temp.transport=RcloneTransfer(binary,REMOTE+':',config)
    temp.transport.call('about',REMOTE+':','--json')
    folder=temp.bind_folder(allow_create=False)
    requests=[('files.get.metadata','files/'+folder+'?fields=id,ownedByMe,trashed,driveId,mimeType,parents'),
              ('permissions.list','files/'+folder+'/permissions?fields=permissions(type,role,deleted),nextPageToken'),
              ('files.get.private','files/'+folder+'?fields=id,ownedByMe,trashed,driveId,mimeType,parents,shared')]
    for label,path in requests:
        try:
            meta=temp.api(path)
            if label=='files.get.private':private_metadata(meta)
            print(json.dumps({'request':label,'http':200,'reason':None}))
        except GoogleDriveError as error:
            print(json.dumps({'request':label,'http':error.status,'reason':','.join(error.reasons)}))
    temp.private(folder,is_folder=True)
    print('Confidentialité vérifiée ; aucun dossier ou fichier supprimé, partagé ou déplacé.')


def select_existing_folder(binary,config,folder_id):
    temp=object.__new__(DriveStore);temp.config=Path(config);temp.binary=binary
    temp.bind_folder(allow_create=False,preferred=folder_id)
