import { CustomerLoginForm } from "@/components/customer-login-form";
import { commerceContext } from "@/lib/commerce/server";
export const metadata = { title: "Connexion client" };
export default async function CustomerLogin() {
  const context = await commerceContext();
  return (
    <div className="shell checkout-auth">
      <span className="eyebrow">VOTRE ESPACE CLIENT</span>
      <h1>Se connecter</h1>
      <p>Utilisez votre compte existant pour suivre vos commandes.</p>
      {!context?.capabilities.orders && (
        <p className="catalog-status">
          Les commandes et la connexion client ne sont pas encore activées sur
          cet environnement.
        </p>
      )}
      <CustomerLoginForm enabled={context?.capabilities.orders === true} />
    </div>
  );
}
