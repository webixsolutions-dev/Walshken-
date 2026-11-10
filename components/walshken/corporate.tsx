"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Brand, Icon } from "./brand";
import { countries, countryName, searchCountries } from "@/lib/walshken/catalog";

export type SiteService = { id: string; name: string; description: string; icon: string };
export type SiteCatalog = {
  services: SiteService[];
  markets: { code: string; enabled: number; contact: string }[];
  availability: { country: string; service_id: string; enabled: number; destination: string }[];
  content: { title: string; description: string; about: string };
};

const displayFlag = (code: string) => String.fromCodePoint(...[...code].map((c) => c.charCodeAt(0) + 127397));
const links = [["Services", "#services"], ["Countries", "#countries"], ["About", "#about"], ["Contact", "#contact"]];

function CountrySearch({ value, onSelect }: { value: string; onSelect: (code: string) => void }) {
  const id = useId();
  const [query, setQuery] = useState(countryName(value));
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  useEffect(() => { setQuery(countryName(value)); }, [value]);
  const choices = searchCountries(query === countryName(value) ? "" : query);
  function select(code: string) { onSelect(code); setQuery(countryName(code)); setOpen(false); setActive(0); }
  function key(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") { setOpen(false); setQuery(countryName(value)); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) { setOpen(true); return; }
      const next = Math.min(Math.max(active + (event.key === "ArrowDown" ? 1 : -1), 0), choices.length - 1);
      setActive(next);
      document.getElementById(`${id}-${next}`)?.scrollIntoView({ block: "nearest" });
    }
    if (event.key === "Enter" && open) {
      event.preventDefault();
      if (choices[active]) select(choices[active].code);
    }
  }
  return <div className="country-search" onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node)) { setOpen(false); setQuery(countryName(value)); }
  }}>
    <label htmlFor={id}>Country or territory</label>
    <div className="explorer-field"><Icon name="globe" size={18}/><input id={id} role="combobox" aria-controls={`${id}-list`} aria-expanded={open}
      aria-autocomplete="list" aria-activedescendant={open && choices[active] ? `${id}-${active}` : undefined}
      placeholder="Search countries" autoComplete="off" value={query} onKeyDown={key}
      onFocus={(event) => { setOpen(true); event.target.select(); }} onChange={(event) => { setQuery(event.target.value); setActive(0); setOpen(true); }}/>
      <Icon name="down" size={16}/></div>
    {open && <div className="country-options" id={`${id}-list`} role="listbox" aria-label="Countries and territories">
      {choices.length === 0 && <span className="option-empty">No matching countries</span>}
      {choices.map((c, i) => <button type="button" id={`${id}-${i}`} role="option" aria-selected={c.code === value} tabIndex={-1}
        className={i === active ? "highlighted" : ""} onMouseDown={(event) => event.preventDefault()} onClick={() => select(c.code)} key={c.code}>
        <span>{displayFlag(c.code)} &nbsp;{c.name}</span><small>{c.code}</small>
      </button>)}
    </div>}
  </div>;
}

function InquiryForm({ service, country, services, notify = false }: { service: string; country: string; services: SiteService[]; notify?: boolean }) {
  const formId = useId();
  const [status, setStatus] = useState("");
  const [failed, setFailed] = useState(false);
  const [sending, setSending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setSending(true); setFailed(false); setStatus("");
    try {
      const data = Object.fromEntries(new FormData(form));
      const response = await fetch("/api/public", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, kind: notify ? "interest" : "inquiry", country: notify ? country : data.country || country, service: data.service || service }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Please try again.");
      setStatus(notify ? "Your interest has been registered." : "Your inquiry has been received.");
      form.reset();
    } catch (error) { setFailed(true); setStatus(error instanceof Error ? error.message : "Please try again."); }
    finally { setSending(false); }
  }
  return <form className={notify ? "notify-form" : "inquiry-form"} key={`${country}-${service}`} onSubmit={submit}>
    {notify ? <div className="inline-fields"><label className="sr-only" htmlFor={`${formId}-email`}>Email address</label>
      <input name="email" id={`${formId}-email`} type="email" placeholder="Your email address" required maxLength={254}/>
      <button className="btn btn-blue" disabled={sending}>{sending ? "Saving…" : "Notify me"}</button>
    </div> : <>
      <div className="fields-two"><label>Full name<input name="name" autoComplete="name" maxLength={100} required placeholder="Your name"/></label>
        <label>Work or personal email<input name="email" type="email" autoComplete="email" maxLength={254} required placeholder="you@example.com"/></label></div>
      <div className="fields-two"><label>Service<select name="service" defaultValue={service}><option value="">General inquiry</option>
        {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label>Country<select name="country" defaultValue={country}>{countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select></label></div>
      <label>How can we help?<textarea name="message" rows={4} required maxLength={2000} placeholder="Tell us what you’re looking for."/></label>
      <p className="form-note">Use this form for general inquiries. Keep personal records and documents private.</p>
      <button className="btn btn-blue" disabled={sending}>{sending ? "Sending…" : "Send inquiry"}<Icon name="right" size={17}/></button>
    </>}
    {status && <p className={failed ? "form-error" : "form-success"} role="status">{status}</p>}
  </form>;
}

export function Corporate({ catalog }: { catalog: SiteCatalog }) {
  const [service, setService] = useState("");
  const [country, setCountry] = useState("CA");
  const [filter, setFilter] = useState<{ service: string; country: string } | null>(null);
  const [menu, setMenu] = useState(false);
  const resultRef = useRef<HTMLElement>(null);
  const [headline, last] = catalog.content.title === "Your global partner for professional services."
    ? ["Your global partner for", "professional services."] : [catalog.content.title, ""];
  const selectedMarket = catalog.markets.find((market) => market.code === filter?.country);
  const marketEnabled = selectedMarket?.enabled === 1;
  const visible = catalog.services.filter((s) => !filter?.service || s.id === filter.service);
  const activeMarketCount = catalog.markets.filter((m) => m.enabled).length;

  function explore(nextService: string, nextCountry: string) {
    setFilter({ service: nextService, country: nextCountry });
    requestAnimationFrame(() => { resultRef.current?.focus({ preventScroll: true }); resultRef.current?.scrollIntoView({ block: "start" }); });
  }

  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="corporate-header">
      <div className="public-wrap topbar">
        <Brand/>
        <button type="button" className="icon-button mobile-menu" aria-label={menu ? "Close navigation" : "Open navigation"} aria-expanded={menu} onClick={() => setMenu(!menu)}><Icon name={menu ? "close" : "menu"}/></button>
        <nav className={menu ? "public-nav open" : "public-nav"} aria-label="Main navigation">
          {links.map(([title, href]) => <a href={href} onClick={() => setMenu(false)} key={href}>{title}</a>)}
          <a className="btn btn-outline staff-entry" href="/staff"><Icon name="lock" size={15}/> Staff login <Icon name="external" size={15}/></a>
        </nav>
      </div>
    </header>
    <main id="main">
      <section className="public-hero">
        <div className="public-wrap">
          <div className="hero-grid">
            <div className="hero-copy">
              <div className="eyebrow hero-kicker"><span/> WALSHKEN PROFESSIONAL SERVICES</div>
              <h1>{headline} {last && <em>{last}</em>}</h1>
              <p>{catalog.content.description}</p>
              <div className="hero-ctas">
                <a className="btn btn-blue" href="#explore">Explore services <Icon name="right" size={18}/></a>
                <a className="text-link" href="#about">About Walshken <Icon name="external" size={16}/></a>
              </div>
            </div>
            <div className="hero-visual">
              <div className="hero-frame"><img src="/walshken-editorial.webp" srcSet="/walshken-editorial-small.webp 720w, /walshken-editorial.webp 1440w"
                sizes="(max-width: 780px) 94vw, 52vw" width="1440" height="960" fetchPriority="high"
                alt="Three professionals in a working discussion in a daylight-filled city office"/></div>
              <div className="hero-photo-label"><span className="hero-label-icon"><Icon name="globe" size={24}/></span><span><strong>Built for a global reach</strong><small>Starting in Canada</small></span></div>
            </div>
          </div>
          <form id="explore" className="explorer" onSubmit={(event) => { event.preventDefault(); explore(service, country); }}>
            <div className="explore-intro"><span className="icon-tile"><Icon name="compass" size={23}/></span><div><strong>Find a service</strong><small>Explore by country and division.</small></div></div>
            <div className="service-field"><label htmlFor="hero-service">Professional service</label><div className="explorer-field">
              <Icon name="services" size={18}/><select id="hero-service" value={service} onChange={(event) => setService(event.target.value)}>
                <option value="">All services</option>{catalog.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select><Icon name="down" size={16}/></div>
            </div>
            <CountrySearch value={country} onSelect={setCountry}/>
            <button className="btn btn-blue explorer-submit">View availability <Icon name="right" size={18}/></button>
          </form>
        </div>
      </section>
      {filter && <section className="public-wrap results-section" ref={resultRef} tabIndex={-1} aria-labelledby="results-title">
        <div className="result-box">
          <div className="section-kicker"><Icon name="pin" size={16}/> COUNTRY AVAILABILITY</div>
          <h2 id="results-title">{displayFlag(filter.country)} {countryName(filter.country)}</h2>
          {marketEnabled ? <>
            {selectedMarket?.contact && <p>{selectedMarket.contact}</p>}
            <div className="result-items">{visible.map((s) => {
              const available = catalog.availability.find((row) => row.country === filter.country && row.service_id === s.id && row.enabled);
              return <div className="result-item" key={s.id}><Icon name={s.icon}/><strong>{s.name}</strong>
                {available ? <a className="text-link" href={available.destination || "#contact"}>Explore service <Icon name="external" size={15}/></a>
                  : <span className="status-tag">Coming Soon</span>}</div>;
            })}</div><a className="text-link" href="#contact">Ask about availability <Icon name="right" size={16}/></a>
          </> : <><p>Walshken services are coming soon to your country. We’re expanding our international network. Please check back regularly for updates.</p>
            <InquiryForm country={filter.country} service={filter.service} services={catalog.services} notify/></>}
        </div>
      </section>}
      <section id="services" className="public-section public-wrap">
        <div className="section-lead">
          <div><div className="section-kicker"><span/> OUR SERVICE DIVISIONS</div><h2>Find the right expertise.</h2></div>
          <p>From running a business to planning your next move, start with the division that fits what you need.</p>
        </div>
        <div className="service-grid">
          {catalog.services.map((s) => <article className="service-card" key={s.id}>
            <div className="service-card-top"><span className="icon-tile"><Icon name={s.icon} size={23}/></span>
              <button type="button" className="icon-button card-arrow" aria-label={`Explore ${s.name} availability`} onClick={() => { setService(s.id); explore(s.id, country); }}><Icon name="external" size={18}/></button></div>
            <h3>{s.name}</h3><p>{s.description}</p>
          </article>)}
          <a className="service-card service-last" href="#contact"><div><div className="section-kicker">HERE TO HELP</div><h3>Have a question?</h3><p>Tell us what you need and we’ll point you to the right division.</p></div><span className="circle-arrow"><Icon name="right" size={19}/></span></a>
        </div>
      </section>
      <section id="countries" className="public-wrap market-wrap">
        <div className="market-band">
          <div className="market-copy"><div className="section-kicker"><span/> OUR MARKETS</div>
            <h2>Starting in Canada.</h2><p>Find out which Walshken services are available in your country and see where we’re expanding next.</p>
            <button type="button" className="btn btn-white" onClick={() => { setCountry("CA"); explore(service, "CA"); }}>Check Canada availability <Icon name="right" size={17}/></button>
          </div>
          <div className="market-orbit"><span className="orbit orbit-1"/><span className="orbit orbit-2"/><span className="orbit orbit-3"/>
            <div className="market-chip"><span className="market-flag" aria-hidden="true">🇨🇦</span><div><strong>Canada</strong><small>{activeMarketCount > 1 ? "First launch market" : "Initial launch market"}</small></div></div></div>
        </div>
      </section>
      <section id="about" className="public-section public-wrap about-row">
        <div><div className="section-kicker"><span/> ABOUT WALSHKEN</div><h2>One group, many specialties.</h2></div>
        <p>{catalog.content.about}</p>
      </section>
      <section id="contact" className="contact-section">
        <div className="public-wrap contact-grid">
          <div><div className="section-kicker"><span/> CONTACT WALSHKEN</div><h2>Tell us what you’re looking for.</h2>
            <p>Share a few details and we’ll direct your inquiry to the appropriate division.</p></div>
          <InquiryForm service={service} country={country} services={catalog.services}/>
        </div>
      </section>
    </main>
    <footer className="corporate-footer"><div className="public-wrap footer-inner"><Brand/><span>© {new Date().getFullYear()} Walshken.</span>
      <nav aria-label="Footer"><a href="#services">Services</a><a href="#contact">Contact</a><a href="/staff">Staff workspace <Icon name="external" size={13}/></a></nav></div></footer>
  </>;
}
