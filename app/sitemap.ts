import type { MetadataRoute } from "next";
import { countryPath, marketList } from "@/lib/walshken/public-catalog";
import { indexingEnabled, siteOrigin } from "@/lib/walshken/seo";
import { loadCatalog } from "@/lib/walshken/server";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!indexingEnabled || !siteOrigin) return [];
  const catalog = await loadCatalog();
  const paths = [
    "/", "/services", "/countries", "/about", "/contact",
    ...catalog.services.map((service) => `/services/${encodeURIComponent(service.id)}`),
    ...marketList(catalog).filter((market) => market.enabled).map((market) => countryPath(market.code)),
  ];

  return paths.map((path) => ({ url: new URL(path, siteOrigin).href }));
}
