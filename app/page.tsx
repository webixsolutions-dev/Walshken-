import { PublicShell } from "@/components/walshken/public-shell";
import { Corporate } from "@/components/walshken/corporate";
import { loadCatalog } from "@/lib/walshken/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  return <PublicShell><Corporate catalog={await loadCatalog()}/></PublicShell>;
}
