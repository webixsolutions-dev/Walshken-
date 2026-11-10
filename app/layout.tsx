import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Walshken | Global Professional Services", template: "%s | Walshken" },
  description: "Explore Walshken professional services and find the right starting point in your country.",
  icons: { icon: "/favicon.svg" },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
