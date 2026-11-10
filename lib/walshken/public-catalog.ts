import { countries } from "./catalog";

export type SiteService = { id: string; name: string; description: string; icon: string };
export type SiteCatalog = {
  services: SiteService[];
  markets: { code: string; enabled: number; contact: string }[];
  availability: { country: string; service_id: string; enabled: number; destination: string }[];
  content: { title: string; description: string; about: string };
  acceptsInquiries?: boolean;
};

export type PublicQuery = Promise<Record<string, string | string[] | undefined>>;

export function findCountry(input: unknown) {
  return typeof input === "string" ? countries.find((item) => item.code === input.toUpperCase()) : undefined;
}

export function matchCountrySearch(input: unknown) {
  if (typeof input !== "string") return undefined;
  const query = input.trim().toLowerCase();
  return countries.find((item) => [item.code, item.alpha3, item.name].some((value) => value.toLowerCase() === query));
}

export function findService(catalog: SiteCatalog, input: unknown) {
  return catalog.services.find((item) => item.id === input);
}

export function countryPath(code: string, service?: string) {
  return `/countries/${code.toLowerCase()}${service ? `?service=${encodeURIComponent(service)}` : ""}`;
}

export function contactPath(country?: string, service?: string) {
  const query = new URLSearchParams();
  if (country) query.set("country", country);
  if (service) query.set("service", service);
  return query.size ? `/contact?${query}` : "/contact";
}

export function marketList(catalog: SiteCatalog, service?: string) {
  const available = new Set(catalog.availability
    .filter((item) => item.enabled === 1 && (!service || item.service_id === service))
    .map((item) => item.country));

  return catalog.markets.flatMap((market) => {
    const country = findCountry(market.code);
    if (!country) return [];
    return [{ ...country, enabled: market.enabled === 1 && available.has(country.code) }];
  }).sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.name.localeCompare(b.name));
}
