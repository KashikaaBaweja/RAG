import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "DocMind — AI Knowledge Base for Your Documents",
    template: "%s · DocMind",
  },
  description:
    "Upload PDFs and documents. Get instant, cited answers from your private knowledge base. Built for teams.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans text-slate-100 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
