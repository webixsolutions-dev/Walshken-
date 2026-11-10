"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "./brand";

const pages = [["Home", "/"], ["Services", "/services"], ["Countries", "/countries"], ["About", "/about"], ["Contact", "/contact"]] as const;

export function PublicNav() {
  const current = usePathname();
  const navigation = useId();
  const toggle = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [current]);

  return <div className="public-nav-group" onKeyDown={(event) => {
    if (event.key === "Escape" && open) {
      setOpen(false);
      toggle.current?.focus();
    }
  }}>
    <button ref={toggle} type="button" className="icon-button mobile-menu" aria-controls={navigation}
      aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} onClick={() => setOpen(!open)}>
      <Icon name={open ? "close" : "menu"}/>
    </button>
    <nav id={navigation} className={open ? "public-nav open" : "public-nav"} aria-label="Main navigation">
      {pages.map(([label, href]) => {
        const exact = current === href;
        const active = exact || (href !== "/" && current.startsWith(`${href}/`));
        return <Link key={href} href={href} className={active ? "current" : undefined} aria-current={exact ? "page" : undefined}
          onClick={() => setOpen(false)}>{label}</Link>;
      })}
      <Link className="btn btn-outline staff-entry" href="/staff" prefetch={false} onClick={() => setOpen(false)}>
        <Icon name="lock" size={15}/> Staff login <Icon name="external" size={15}/>
      </Link>
    </nav>
  </div>;
}
