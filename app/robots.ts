import type { MetadataRoute } from "next";
import { indexingEnabled, siteOrigin } from "@/lib/walshken/seo";

export default function robots(): MetadataRoute.Robots {
  return indexingEnabled && siteOrigin ? {
    rules: { userAgent: "*", allow: "/", disallow: ["/staff", "/preview", "/api"] },
    sitemap: new URL("/sitemap.xml", siteOrigin).href,
  } : { rules: { userAgent: "*", disallow: "/" } };
}
