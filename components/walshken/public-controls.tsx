"use client";

import { useId, useState, type FormEvent, type KeyboardEvent } from "react";
import { countries, countryName, searchCountries } from "@/lib/walshken/catalog";
import type { SiteService } from "@/lib/walshken/public-catalog";
import { Icon } from "./brand";

const displayFlag = (code: string) => String.fromCodePoint(...[...code].map((letter) => letter.charCodeAt(0) + 127397));

function CountrySearch({ value, onSelect }: { value: string; onSelect: (code: string) => void }) {
  const id = useId();
  const [query, setQuery] = useState(countryName(value));
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const choices = searchCountries(query === countryName(value) ? "" : query);
  function select(code: string) { onSelect(code); setQuery(countryName(code)); setOpen(false); setActive(0); }
  function key(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") { setOpen(false); setQuery(countryName(value)); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) { setActive(0); setOpen(true); return; }
      if (!choices.length) return;
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
    <input type="hidden" name="country" value={value}/>
    <label htmlFor={id}>Country or territory</label>
    <div className="explorer-field"><Icon name="globe" size={18}/><input id={id} role="combobox" aria-controls={open ? `${id}-list` : undefined} aria-expanded={open}
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

export function InquiryForm({ service, country, services, enabled, notify = false }: {
  service: string; country: string; services: SiteService[]; enabled: boolean; notify?: boolean;
}) {
  const formId = useId();
  const [status, setStatus] = useState("");
  const [failed, setFailed] = useState(false);
  const [sending, setSending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enabled || sending) return;
    const form = event.currentTarget;
    setSending(true); setFailed(false); setStatus("");
    try {
      const data = Object.fromEntries(new FormData(form));
      const response = await fetch("/api/public", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, kind: notify ? "interest" : "inquiry", country: notify ? country : data.country || country, service: notify ? service : data.service }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Please try again.");
      setStatus(notify ? "Your interest has been registered." : "Your inquiry has been received.");
      form.reset();
    } catch (error) { setFailed(true); setStatus(error instanceof Error ? error.message : "Please try again."); }
    finally { setSending(false); }
  }
  return <form className={notify ? "notify-form" : "inquiry-form"} method="post" action="/api/public" onSubmit={submit}>
    {notify ? <div className="inline-fields"><label className="sr-only" htmlFor={`${formId}-email`}>Email address</label>
      <input name="email" id={`${formId}-email`} type="email" placeholder="Your email address" required maxLength={254}/>
      <button className="btn btn-blue" disabled={!enabled || sending}>{sending ? "Saving…" : "Notify me"}</button>
    </div> : <>
      <div className="fields-two"><label>Full name<input name="name" autoComplete="name" maxLength={100} required placeholder="Your name"/></label>
        <label>Work or personal email<input name="email" type="email" autoComplete="email" maxLength={254} required placeholder="you@example.com"/></label></div>
      <div className="fields-two"><label>Service<select name="service" defaultValue={service}><option value="">General inquiry</option>
        {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label>Country<select name="country" defaultValue={country}>{countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select></label></div>
      <label>How can we help?<textarea name="message" rows={4} required maxLength={2000} placeholder="Tell us what you’re looking for."/></label>
      <p className="form-note">Use this form for general inquiries. Keep personal records and documents private.</p>
      <button className="btn btn-blue" disabled={!enabled || sending}>{sending ? "Sending…" : "Send inquiry"}<Icon name="right" size={17}/></button>
    </>}
    {!enabled && <p className="form-note preview-form-note"><Icon name="help" size={16}/> {notify ? "Launch notifications will open after the site is connected." : "Inquiry delivery will open after the site is connected."}</p>}
    {status && <p className={failed ? "form-error" : "form-success"} role="status">{status}</p>}
  </form>;
}

export function ServiceExplorer({ services, service = "", floating = false }: {
  services: SiteService[]; service?: string; floating?: boolean;
}) {
  const [country, setCountry] = useState("CA");
  const serviceId = useId();

  return <form id="explore" className={floating ? "explorer" : "explorer explorer-inline"} action="/countries" method="get">
    <div className="explore-intro"><span className="icon-tile"><Icon name="compass" size={23}/></span>
      <div><strong>Find a service</strong><small>Explore by country and division.</small></div></div>
    <div className="service-field"><label htmlFor={serviceId}>Professional service</label><div className="explorer-field">
      <Icon name="services" size={18}/><select id={serviceId} name="service" defaultValue={service}>
        <option value="">All services</option>{services.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select><Icon name="down" size={16}/></div>
    </div>
    <CountrySearch value={country} onSelect={setCountry}/>
    <button className="btn btn-blue explorer-submit">View availability <Icon name="right" size={18}/></button>
  </form>;
}
