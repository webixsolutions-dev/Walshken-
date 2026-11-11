import Link from "next/link";
import { CustomerDashboard, requireCustomerPage } from "@/components/walshken/customer-pages";
import { Icon } from "@/components/walshken/brand";
import { countryName } from "@/lib/walshken/catalog";
import { customerInquiries } from "@/lib/walshken/customer";

export const metadata = { title: "My requests" };
const formatDate = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export default async function CustomerPage({ searchParams }: { searchParams: Promise<{ page?: string; sent?: string }> }) {
  const [{ db, customer }, query] = await Promise.all([requireCustomerPage(), searchParams]);
  const requestedPage = Number(query.page);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 && requestedPage <= 1000 ? requestedPage : 1;
  const inquiries = await customerInquiries(db, customer.id, page);

  return <CustomerDashboard current="requests" title="My requests" description={`Welcome, ${customer.name}. Follow your requests and read updates from Walshken.`}>
    {query.sent === "1" && <p className="form-success customer-notice" role="status">Your request has been received.</p>}
    <section className="customer-panel" aria-labelledby="request-history">
      <div className="customer-panel-heading">
        <h2 id="request-history">Request history</h2>
        <Link href="/customer/requests/new" className="btn btn-blue"><Icon name="plus" size={17}/> New request</Link>
      </div>
      {!inquiries.length && <p className="customer-empty">{page === 1 ? "Your requests will appear here after you send one from your account." : "There are no requests on this page."}</p>}
      <div className="customer-request-list">
        {inquiries.slice(0, 20).map((inquiry) => <details className="customer-request" key={inquiry.id}>
          <summary>
            <span><strong>{inquiry.service_name ?? "General inquiry"}</strong>
              <small>{countryName(inquiry.country)} · {formatDate.format(new Date(inquiry.created_at))}</small></span>
            <span className={`customer-status ${inquiry.status === "Resolved" ? "is-resolved" : ""}`}>{inquiry.status}</span>
          </summary>
          <div className="customer-request-detail">
            <small>Reference {inquiry.id.slice(0, 8).toUpperCase()}</small>
            <h3>Your message</h3><p>{inquiry.message}</p>
            {inquiry.customer_update && <div className="customer-request-update">
              <h3>Update from Walshken</h3><p>{inquiry.customer_update}</p>
              {inquiry.updated_at && <small>{formatDate.format(new Date(inquiry.updated_at))}</small>}
            </div>}
          </div>
        </details>)}
      </div>
      {(page > 1 || inquiries.length > 20) && <nav className="customer-pagination" aria-label="Request history pages">
        {page > 1 && <Link className="text-link" href={`/customer?page=${page - 1}`}>Previous</Link>}
        {inquiries.length > 20 && page < 1000 && <Link className="text-link" href={`/customer?page=${page + 1}`}>Next</Link>}
      </nav>}
    </section>
  </CustomerDashboard>;
}
