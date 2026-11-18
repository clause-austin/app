import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Shell } from "@/components/Shell";

const jb = JetBrains_Mono({ variable: "--font-jb", subsets: ["latin"], weight: ["400", "500", "700", "800"] });

export const metadata: Metadata = {
  title: "CLAUSE — Pay less if they lose",
  description: "A checkout where any price can carry a real-world condition. Hedged on Gemini prediction markets, settled in USDC on Solana.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jb.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
