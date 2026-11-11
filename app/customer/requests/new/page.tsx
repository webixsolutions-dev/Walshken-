import { CustomerDashboard, requireCustomerPage } from "@/components/walshken/customer-pages";
import { CustomerForm } from "@/components/walshken/customer-form";
import { countries } from "@/lib/walshken/catalog";
import { id, loadCatalog } from "@/lib/walshken/server";

export const metadata = { title: "New customer request" };

export default async function NewCustomerRequest() {
  const [{ customer }, catalog] = await Promise.all([requireCustomerPage(), loadCatalog()]);
  return <CustomerDashboard current="new" title="New request" description="Tell us what you need and where you need support.">
    <section className="customer-panel customer-form-panel" aria-label="New inquiry">
      <CustomerForm action="request" label="Send request" to="/customer?sent=1" enabled={catalog.acceptsInquiries === true}>
        <input type="hidden" name="requestId" value={id()}/>
        <p className="form-note">Sending as {customer.email}</p>
        <div className="fields-two">
          <label>Service<select name="service"><option value="">General inquiry</option>
            {catalog.services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
          </select></label>
          <label>Country<select name="country" required defaultValue=""><option value="">Choose a country</option>
            {countries.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
          </select></label>
        </div>
        <label>How can we help?<textarea name="message" rows={5} required maxLength={2000}/></label>
        <p className="form-note">Keep personal records and documents private.</p>
        {!catalog.acceptsInquiries && <p className="form-note">Requests are temporarily unavailable.</p>}
      </CustomerForm>
    </section>
  </CustomerDashboard>;
}
