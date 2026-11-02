"""Vérifie fichiers et octets Storage restaurés. Ne certifie PAS une restauration PostgreSQL."""
import argparse,hashlib,json,re
from pathlib import Path

def digest(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
 return h.hexdigest()

def verify(manifest_path):
 path=Path(manifest_path).resolve();root=path.parent
 if root.is_relative_to(Path(__file__).resolve().parents[1]):raise ValueError('Sauvegarde hors du dépôt Git requise')
 data=json.loads(path.read_text())
 if not isinstance(data,dict):raise ValueError('Manifeste structuré requis')
 if data.get('project_ref')!='xxadpoebcslutlevzdsy':raise ValueError('Projet inattendu')
 def file(entry):
  if not isinstance(entry,dict):raise ValueError('Description d’archive requise')
  raw=entry.get('path','')
  if not raw or Path(raw).is_absolute():raise ValueError('Chemin relatif requis')
  p=(root/raw).resolve()
  if not p.is_relative_to(root) or not p.is_file():raise ValueError('Fichier absent ou hors archive')
  expected=entry.get('sha256','')
  if not re.fullmatch('[a-f0-9]{64}',expected) or digest(p)!=expected:raise ValueError('Checksum invalide')
  return p
 file(data['database_dump']);file(data['database_restore_evidence'])
 inventory=json.loads(file(data['storage_inventory']).read_text())
 if not isinstance(inventory,list) or any(not isinstance(r,dict) or not isinstance(r.get('bucket_id'),str) or not isinstance(r.get('object_path'),str) for r in inventory):raise ValueError('Inventaire Storage invalide')
 objects=data.get('storage_objects')
 if not isinstance(objects,list) or any(not isinstance(r,dict) or not isinstance(r.get('bucket_id'),str) or not isinstance(r.get('object_path'),str) for r in objects):raise ValueError('Inventaire Storage requis, même vide')
 expected={(r['bucket_id'],r['object_path']) for r in inventory}
 actual={(r['bucket_id'],r['object_path']) for r in objects}
 if len(inventory)!=len(expected) or len(objects)!=len(actual) or actual!=expected:raise ValueError('Couverture Storage incomplète ou doublons')
 for row in objects:
  saved=file(row['backup']);restored=file(row['restored_copy'])
  if row['backup']['sha256']!=row['restored_copy']['sha256'] or saved.stat().st_size!=restored.stat().st_size:raise ValueError('Octets restaurés différents')
 return {'artifact_integrity':True,'storage_objects_covered':len(actual),'restored_storage_bytes_match':True,'database_restore_verified':False,'storage_service_restore_verified':False,'approval_granted':False,'note':'La preuve de restauration DB doit être examinée et les services restaurés testés ; aucun SET de validation généré.'}

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('manifest',type=Path);a=p.parse_args()
 try:print(json.dumps(verify(a.manifest)))
 except (ValueError,KeyError,OSError,json.JSONDecodeError) as e:raise SystemExit('NON VÉRIFIÉ : '+str(e)) from None

if __name__=='__main__':main()
