import type { ReactNode } from "react";
import { PublicShell } from "@/components/walshken/public-shell";

export default function CorporateLayout({ children }: { children: ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}
