import { adminView } from "@/lib/admin/auth";
import { ChangePasswordForm } from "@/components/admin-recovery-forms";
export default async function Password() {
  if (!(await adminView())) return null;
  return (
    <>
      <div className="workspace-page-heading">
        <div>
          <span className="eyebrow">SÉCURITÉ DE VOTRE COMPTE</span>
          <h1>Changer votre mot de passe</h1>
          <p>Cette action concerne uniquement votre compte personnel.</p>
        </div>
      </div>
      <section className="workspace-panel">
        <h2>Un accès qui vous appartient</h2>
        <ChangePasswordForm />
      </section>
    </>
  );
}
