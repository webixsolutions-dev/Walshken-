import Link from "next/link";
import { Icon } from "./brand";
import { ServiceExplorer } from "./public-controls";
import { CountryLinks, ServiceGrid } from "./public-content";
import { marketList, type SiteCatalog } from "@/lib/walshken/public-catalog";

const steps = [
  { icon: "services", title: "Choose a service", description: "Start with the kind of help you need." },
  { icon: "globe", title: "Check your country", description: "See which services are available in your market." },
  { icon: "message", title: "Tell us what you need", description: "Share a few details so your inquiry reaches the right team." },
];

export function Corporate({ catalog }: { catalog: SiteCatalog }) {
  const activeMarkets = marketList(catalog).filter((market) => market.enabled).slice(0, 4);

  return <>
    <section className="public-hero">
      <div className="public-wrap">
        <div className="hero-grid">
          <div className="hero-copy">
            <div className="eyebrow hero-kicker"><span/> GLOBAL PROFESSIONAL SERVICES</div>
            <h1>{catalog.content.title}</h1>
            <p>{catalog.content.description}</p>
            <div className="hero-ctas">
              <Link className="btn btn-blue" href="#explore">Find a service <Icon name="right" size={18}/></Link>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-frame"><img src="/walshken-consultation.webp" srcSet="/walshken-consultation-small.webp 720w, /walshken-consultation.webp 1440w"
              sizes="(max-width: 780px) 94vw, (max-width: 1300px) 49vw, 610px" width="1440" height="960" fetchPriority="high"
              alt="Three people reviewing their plans together in a daylight-filled office"/></div>
          </div>
        </div>
        <ServiceExplorer services={catalog.services} floating/>
      </div>
    </section>
    <section id="services" className="public-section public-wrap">
      <div className="section-lead">
        <div><div className="section-kicker"><span/> OUR SERVICE DIVISIONS</div><h2>What can we help you with?</h2></div>
        <p>Explore the divisions that match your goals, from running a business to planning your next move.</p>
      </div>
      <ServiceGrid services={catalog.services} contactCard/>
    </section>
    <section id="countries" className="public-wrap market-wrap">
      <div className="market-band market-global">
        <div className="market-copy">
          <div className="section-kicker"><span/> LOCAL AVAILABILITY</div>
          <h2>Find services in your country.</h2>
          <p>Availability depends on where you need support. Search your country to see current services, contact options, and launch updates.</p>
          <Link className="btn btn-white" href="/countries">Explore countries <Icon name="right" size={17}/></Link>
        </div>
        {activeMarkets.length ? <CountryLinks markets={activeMarkets}/> : <div className="market-globe" aria-hidden="true"><Icon name="globe" size={124}/></div>}
      </div>
    </section>
    <section className="public-wrap inner-section home-next-steps" aria-labelledby="next-steps">
      <div className="about-photo"><img src="/walshken-service-advisers.webp" width="960" height="640" loading="lazy"
        alt="Two advisers working through a plan at a shared desk"/></div>
      <div>
        <div className="section-kicker"><span/> GETTING STARTED</div><h2 id="next-steps">From your question to the right team.</h2>
        <ol className="journey-steps">{steps.map((step) => <li key={step.title}>
          <span className="icon-tile"><Icon name={step.icon} size={21}/></span>
          <span><strong>{step.title}</strong><small>{step.description}</small></span>
        </li>)}</ol>
      </div>
    </section>
  </>;
}
