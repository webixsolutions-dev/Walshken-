import Link from "next/link";
import { Icon } from "./brand";
import { ServiceExplorer } from "./public-controls";
import { ServiceGrid } from "./public-content";
import { countryPath, type SiteCatalog } from "@/lib/walshken/public-catalog";

export function Corporate({ catalog }: { catalog: SiteCatalog }) {
  const [headline, last] = catalog.content.title === "Your global partner for professional services."
    ? ["Your global partner for", "professional services."] : [catalog.content.title, ""];
  const activeMarketCount = catalog.markets.filter((market) => market.enabled === 1).length;

  return <>
    <section className="public-hero">
      <div className="public-wrap">
        <div className="hero-grid">
          <div className="hero-copy">
            <div className="eyebrow hero-kicker"><span/> WALSHKEN PROFESSIONAL SERVICES</div>
            <h1>{headline} {last && <em>{last}</em>}</h1>
            <p>{catalog.content.description}</p>
            <div className="hero-ctas">
              <Link className="btn btn-blue" href="/services">Explore services <Icon name="right" size={18}/></Link>
              <Link className="text-link" href="/about">About Walshken <Icon name="external" size={16}/></Link>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-frame"><img src="/walshken-editorial.webp" srcSet="/walshken-editorial-small.webp 720w, /walshken-editorial.webp 1440w"
              sizes="(max-width: 780px) 94vw, 52vw" width="1440" height="960" fetchPriority="high"
              alt="Three professionals in a working discussion in a daylight-filled city office"/></div>
            <div className="hero-photo-label"><span className="hero-label-icon"><Icon name="globe" size={24}/></span>
              <span><strong>Built for a global reach</strong><small>Starting in Canada</small></span></div>
          </div>
        </div>
        <ServiceExplorer services={catalog.services} floating/>
      </div>
    </section>
    <section id="services" className="public-section public-wrap">
      <div className="section-lead">
        <div><div className="section-kicker"><span/> OUR SERVICE DIVISIONS</div><h2>Find the right expertise.</h2></div>
        <p>From running a business to planning your next move, start with the division that fits what you need.</p>
      </div>
      <ServiceGrid services={catalog.services} contactCard/>
    </section>
    <section id="countries" className="public-wrap market-wrap">
      <div className="market-band">
        <div className="market-copy"><div className="section-kicker"><span/> OUR MARKETS</div>
          <h2>Starting in Canada.</h2><p>Check which services are available in your country and see where we’re expanding.</p>
          <Link className="btn btn-white" href={countryPath("CA")}>Check Canada availability <Icon name="right" size={17}/></Link>
        </div>
        <div className="market-orbit"><span className="orbit orbit-1"/><span className="orbit orbit-2"/><span className="orbit orbit-3"/>
          <div className="market-chip"><span className="market-flag" aria-hidden="true">🇨🇦</span>
            <div><strong>Canada</strong><small>{activeMarketCount > 1 ? "First launch market" : "Initial launch market"}</small></div></div>
        </div>
      </div>
    </section>
    <section id="about" className="public-section public-wrap about-row">
      <div><div className="section-kicker"><span/> ABOUT WALSHKEN</div><h2>One group, many specialties.</h2></div>
      <div className="summary-copy"><p>{catalog.content.about}</p><Link className="text-link" href="/about">Learn about Walshken <Icon name="right" size={16}/></Link></div>
    </section>
    <section id="contact" className="contact-section">
      <div className="public-wrap public-callout"><div><div className="section-kicker"><span/> CONTACT WALSHKEN</div>
        <h2>Tell us what you’re looking for.</h2><p>Share a few details so your inquiry can reach the right division.</p></div>
        <Link className="btn btn-blue" href="/contact">Contact us <Icon name="right" size={17}/></Link>
      </div>
    </section>
  </>;
}
