"""Prépare une activation explicitement paramétrée, jamais exécutée par ce script."""
import argparse,importlib.util,json,os
from pathlib import Path
spec=importlib.util.spec_from_file_location('release',Path(__file__).with_name('prepare-production-activation.py'))
release=importlib.util.module_from_spec(spec);spec.loader.exec_module(release)

def prepare(minutes,accounts,manual=False,digital=False):
 if not isinstance(minutes,int) or isinstance(minutes,bool) or not 1<=minutes<=1440:raise ValueError('Durée de réservation explicite : 1 à 1440 minutes')
 if not isinstance(accounts,list) or any(not isinstance(a,dict) for a in accounts):raise ValueError('Liste de comptes structurée requise')
 if manual and not accounts:raise ValueError('Coordonnées de compte marchand approuvées requises')
 if digital and not manual:raise ValueError('Validation du parcours de paiement requise avant livraison')
 def quote(v,minimum,maximum):
  if not isinstance(v,str) or not minimum<=len(v.strip())<=maximum or any(ord(c)<32 for c in v):raise ValueError('Coordonnée ou preuve marchande invalide')
  return "'"+v.strip().replace("'","''")+"'"
 rows=[];providers=set()
 for a in accounts:
  provider=a.get('provider')
  if provider not in ('moncash','natcash') or provider in providers:raise ValueError('Fournisseur inconnu ou dupliqué')
  providers.add(provider)
  rows.append("("+','.join([quote(provider,1,20),quote(a.get('display_name'),2,120),quote(a.get('account_identifier'),4,160),quote(a.get('approval_evidence'),10,2000),'true'])+")")
 sql="-- ACTIVATION PERSISTANTE POUR REVUE, NON EXÉCUTÉE. Données marchandes : hors Git.\nBEGIN;\nSET LOCAL lock_timeout='3s';\nSET LOCAL statement_timeout='60s';\n"+release.guard('06-enable-commerce')+"""
DO $safety$ BEGIN
 IF (SELECT count(*) FROM public.commerce_settings WHERE singleton)<>1 OR EXISTS(SELECT 1 FROM public.commerce_settings WHERE orders_enabled OR manual_payments_enabled OR digital_delivery_enabled) THEN RAISE EXCEPTION 'Réglages initiaux désactivés attendus, audit si déjà actifs'; END IF;
 IF current_setting('shena.auth_email_confirmation_verified',true) IS DISTINCT FROM 'yes' THEN RAISE EXCEPTION 'Configuration Auth réelle et propriété des emails vérifiées requises'; END IF;
 IF current_setting('shena.security_tests_verified',true) IS DISTINCT FROM 'yes' THEN RAISE EXCEPTION 'Résultats de sécurité examinés et approuvés requis'; END IF;
 IF (SELECT count(*) FROM auth.users WHERE email_confirmed_at IS NOT NULL AND raw_app_meta_data->'shena_role'='"admin"'::jsonb)<2 THEN RAISE EXCEPTION 'Deux administrateurs vérifiés requis'; END IF;
 IF EXISTS(SELECT 1 FROM public.products WHERE active AND product_type IN('physical','stock','physical_stock','physique','in_stock'))
 AND NOT EXISTS(SELECT 1 FROM public.commerce_delivery_zones WHERE active) THEN RAISE EXCEPTION 'Zones et frais marchands réels requis pour les produits physiques'; END IF;
 IF to_regprocedure('cron.schedule(text,text,text)') IS NULL THEN RAISE EXCEPTION 'pg_cron audité et disponible requis ; aucune extension installée automatiquement'; END IF;
 IF EXISTS(SELECT 1 FROM cron.job WHERE jobname='shena-expire-unpaid-reservations') THEN RAISE EXCEPTION 'Tâche existante à examiner, aucun remplacement'; END IF;
END $safety$;
"""
 if rows:sql+="INSERT INTO public.commerce_payment_accounts(provider,display_name,account_identifier,approval_evidence,active) VALUES "+','.join(rows)+";\n"
 if digital:sql+="DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM public.digital_releases WHERE status='approved') THEN RAISE EXCEPTION 'Fichier privé réel approuvé et tests de livraison requis'; END IF; END $$;\n"
 sql+="SELECT cron.schedule('shena-expire-unpaid-reservations','* * * * *','SELECT public.shena_expire_unpaid_reservations(100)');\n"
 sql+=f"UPDATE public.commerce_settings SET reservation_minutes={minutes},orders_enabled=true,manual_payments_enabled={'true' if manual else 'false'},digital_delivery_enabled={'true' if digital else 'false'} WHERE singleton;\nCOMMIT;\n"
 return sql

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--reservation-minutes',type=int,required=True);p.add_argument('--accounts-json',type=Path);p.add_argument('--manual-payments',action='store_true');p.add_argument('--digital-delivery',action='store_true');p.add_argument('--output',type=Path,required=True);a=p.parse_args()
 if a.output.resolve().is_relative_to(Path(__file__).resolve().parents[1]):p.error('Fichier marchand hors du dépôt Git requis')
 try:s=prepare(a.reservation_minutes,json.loads(a.accounts_json.read_text()) if a.accounts_json else [],a.manual_payments,a.digital_delivery)
 except (ValueError,OSError) as e:p.error(str(e))
 with open(a.output,'x',opener=lambda path,flags:os.open(path,flags,0o600)) as f:f.write(s)
 print('Script nominatif/marchand écrit pour revue. Aucun SQL, tâche cron ou paiement exécuté.')

if __name__=='__main__':main()
