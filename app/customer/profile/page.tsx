import { CustomerDashboard, requireCustomerPage } from "@/components/walshken/customer-pages";
import { CustomerForm } from "@/components/walshken/customer-form";

export const metadata = { title: "Customer profile" };

export default async function CustomerProfile() {
  const { customer } = await requireCustomerPage();
  return <CustomerDashboard current="profile" title="Profile" description="Manage your name and password.">
    <div className="customer-profile-grid">
      <section className="customer-panel" aria-labelledby="customer-details">
        <h2 id="customer-details">Account details</h2>
        <CustomerForm action="profile" label="Save profile">
          <label>Full name<input name="name" autoComplete="name" maxLength={100} required defaultValue={customer.name}/></label>
          <label>Email address<input type="email" readOnly value={customer.email}/></label>
        </CustomerForm>
      </section>
      <section className="customer-panel" aria-labelledby="customer-password">
        <h2 id="customer-password">Change password</h2>
        <CustomerForm action="password" label="Change password" to="/customer/sign-in?changed=1">
          <label>Current password<input name="currentPassword" type="password" autoComplete="current-password" required maxLength={160}/></label>
          <label>New password<input name="newPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={160}/></label>
          <label>Confirm new password<input name="confirmPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={160}/></label>
          <p className="form-note">Changing your password signs you out on all devices.</p>
        </CustomerForm>
      </section>
    </div>
  </CustomerDashboard>;
}
