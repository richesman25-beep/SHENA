"""Audit distant NON DESTRUCTIF : métadonnées seulement, aucun DDL/DML/restore."""
import argparse,json,os,urllib.request,urllib.error
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
REF='xxadpoebcslutlevzdsy'
API='https://api.supabase.com'

def main():
 p=argparse.ArgumentParser(description=__doc__)
 p.add_argument('--output',type=Path,required=True)
 a=p.parse_args()
 out=a.output.resolve()
 if out.is_relative_to(ROOT):p.error('Stocker le rapport privé hors du dépôt Git')
 token=os.environ.get('SUPABASE_ACCESS_TOKEN')
 if not token:raise SystemExit('BLOQUÉ : accès opérateur SUPABASE_ACCESS_TOKEN absent. Aucune requête effectuée.')
 def request(path,body=None):
  req=urllib.request.Request(API+path,data=None if body is None else json.dumps(body).encode(),headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'})
  return json.load(urllib.request.urlopen(req,timeout=45))
 try:
  project=request('/v1/projects/'+REF)
  if project.get('id')!=REF:raise SystemExit('Cible non identifiée : arrêt avant requête SQL')
  # Le fichier audité ne contient que SELECT, SET et frontières READ ONLY.
  # Pour l'API, agréger les SELECT en UNE requête sans perdre les résultats au ROLLBACK.
  lines=[x for x in (ROOT/'docs/proposals/production-activation/00-inventory-readonly.sql').read_text().splitlines() if not x.lstrip().startswith('--')]
  statements=[x.strip() for x in '\n'.join(lines).split(';') if x.strip().startswith('SELECT')]
  if not statements:raise SystemExit('Inventaire SELECT manquant')
  parts=[]
  for i,sql in enumerate(statements):parts.append(f"'query_{i}',(SELECT COALESCE(json_agg(q),'[]'::json) FROM ({sql}) q)")
  inventory=request('/v1/projects/'+REF+'/database/query',{'query':"SELECT json_build_object("+','.join(parts)+") AS inventory"})
  try:backups=request('/v1/projects/'+REF+'/database/backups')
  except urllib.error.HTTPError as e:backups={'unavailable_http_status':e.code}
  try:
   config=request('/v1/projects/'+REF+'/config/auth')
   auth={key:config.get(key) for key in ['mailer_autoconfirm','disable_signup','external_email_enabled','security_captcha_enabled','password_min_length','rate_limit_email_sent','site_url','uri_allow_list']}
   auth['custom_smtp_configured']=bool(config.get('smtp_host'))
  except urllib.error.HTTPError as e:auth={'unavailable_http_status':e.code}
  report={'project_ref':REF,'project_status':project.get('status'),'inventory':inventory,'auth_config_non_secret':auth,'provider_backups':backups,'storage_object_bytes_backed_up':False,'database_restore_verified':False,'storage_restore_verified':False}
  with out.open('x',opener=lambda path,flags:os.open(path,flags,0o600)) as f:json.dump(report,f,indent=2)
  print(json.dumps({'project_ref':REF,'metadata_report_saved':True,'restoration_verified':False,'note':'Les sauvegardes DB Supabase ne sauvegardent pas les octets Storage ; inventaire privé hors Git.'}))
 except urllib.error.HTTPError as e:raise SystemExit('Accès opérateur refusé/indisponible : HTTP '+str(e.code)) from None
 except urllib.error.URLError:raise SystemExit('Réseau opérateur indisponible ; aucun état de sauvegarde certifié') from None

if __name__=='__main__':main()
