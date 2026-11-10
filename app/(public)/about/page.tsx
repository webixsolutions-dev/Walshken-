import { PublicShell } from "@/components/walshken/public-shell";
import { publicMetadata } from "@/lib/walshken/seo";
import Link from "next/link";
import { Icon } from "@/components/walshken/brand";
import { PageHero } from "@/components/walshken/public-content";
import { loadCatalog } from "@/lib/walshken/server";

export const dynamic = "force-dynamic";
export const metadata = publicMetadata("/about", "About Walshken",
  "Learn how Walshken organizes professional services by division and country, and where to start with your inquiry.");

const steps = [
  { icon: "services", title: "Choose a division", body: "Start with the type of support you need, whether it’s for your business or a personal plan.", href: "/services", label: "See our services" },
  { icon: "globe", title: "Check your country", body: "See what’s available in your country and which services are planned for later.", href: "/countries", label: "Explore countries" },
  { icon: "message", title: "Tell us what you need", body: "Share your question and location so it can reach the relevant division.", href: "/contact", label: "Contact Walshken" },
];

export default async function AboutPage() {
  const catalog = await loadCatalog();
  return <PublicShell services={catalog.services}>
    <PageHero label="ABOUT WALSHKEN" title="One group, many specialties." description={catalog.content.about} icon="building">
      <Link className="btn btn-blue" href="/services">Explore our divisions <Icon name="right" size={17}/></Link>
    </PageHero>
    <div className="public-wrap inner-section">
      <section className="about-story" aria-labelledby="about-story">
        <div className="about-photo"><img src="/walshken-colleagues.webp" width="960" height="640" loading="lazy"
          alt="Three colleagues in conversation in a bright office atrium"/></div>
        <div><div className="section-kicker"><span/> HOW WALSHKEN IS ORGANIZED</div><h2 id="about-story">A starting point for your next step.</h2>
          <p>Every division has its own area of focus. The service directory helps you narrow down where to start, and the country pages show which divisions are available in your market.</p>
          <p>When your question spans more than one area, the contact page lets you describe the full situation in one place.</p>
        </div>
      </section>
      <section className="country-directory" aria-labelledby="about-steps">
        <div className="section-kicker"><span/> HOW TO GET STARTED</div><h2 id="about-steps">Find the right place to begin.</h2>
        <div className="public-step-grid">{steps.map((step) => <article className="public-panel" key={step.href}>
          <span className="icon-tile"><Icon name={step.icon} size={22}/></span><h3>{step.title}</h3><p>{step.body}</p>
          <Link className="text-link" href={step.href}>{step.label} <Icon name="right" size={16}/></Link>
        </article>)}</div>
      </section>
    </div>
  </PublicShell>;
}
