import { PublicShell } from "@/components/walshken/public-shell";
import { Corporate } from "@/components/walshken/corporate";
import { publicMetadata } from "@/lib/walshken/seo";
import { loadCatalog } from "@/lib/walshken/server";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { content } = await loadCatalog();
  return publicMetadata("/", "Walshken | Global Professional Services", content.description);
}

export default async function HomePage() {
  const catalog = await loadCatalog();
  return <PublicShell><Corporate catalog={catalog}/></PublicShell>;
}
