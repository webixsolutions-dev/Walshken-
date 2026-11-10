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

export function findService(catalog: SiteCatalog, input: unknown) {
  return catalog.services.find((item) => item.id === input);
}

export function countryPath(code: string, service?: string) {
  return `/countries/${code.toLowerCase()}${service ? `?service=${encodeURIComponent(service)}` : ""}`;
}

export function contactPath(country: string, service?: string) {
  const query = new URLSearchParams({ country });
  if (service) query.set("service", service);
  return `/contact?${query}`;
}

export function marketList(catalog: SiteCatalog) {
  const codes = new Set(["CA", ...catalog.markets.map((market) => market.code)]);
  return [...codes].flatMap((code) => {
    const country = findCountry(code);
    if (!country) return [];
    return [{ ...country, enabled: catalog.markets.some((market) => market.code === code && market.enabled === 1) }];
  });
}
