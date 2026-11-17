import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "./novya.css";
import "./support.css";
import "./assistant.css";
import "./learn.css";
import "./ops.css";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "NOVYA · Support",
  description: "Your queue, cases and customers, connected. NOVYA Support workspace.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${inter.variable}`}>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
