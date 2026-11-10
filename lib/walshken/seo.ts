import type { Metadata } from "next";

function httpsOrigin(value?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && url.pathname === "/" && !url.search && !url.hash && !url.username && !url.password) return url;
  } catch { /* An incomplete launch configuration stays unindexed. */ }
  return undefined;
}

export const siteOrigin = httpsOrigin(process.env.WALSHKEN_SITE_URL);
export const metadataOrigin = siteOrigin ?? httpsOrigin(process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
export const indexingEnabled = Boolean(siteOrigin && process.env.WALSHKEN_INDEX_PUBLIC === "1"
  && (process.env.VERCEL_ENV ? process.env.VERCEL_ENV === "production" : process.env.NODE_ENV === "production"));

export function publicMetadata(path: string, title: string, description: string, published = true): Metadata {
  const url = siteOrigin ? new URL(path, siteOrigin) : undefined;
  const socialTitle = path === "/" ? title : `${title} | Walshken`;
  const index = indexingEnabled && published;
  const image = metadataOrigin ? {
    url: new URL("/walshken-consultation.webp", metadataOrigin), width: 1440, height: 960, alt: "Professional consultation at Walshken",
  } : undefined;

  return {
    title: path === "/" ? { absolute: title } : title,
    description,
    robots: { index, follow: indexingEnabled },
    alternates: url ? { canonical: url } : undefined,
    openGraph: { type: "website", siteName: "Walshken", title: socialTitle, description, url, images: image ? [image] : undefined },
    twitter: { card: "summary_large_image", title: socialTitle, description, images: image ? [image.url] : undefined },
  };
}
