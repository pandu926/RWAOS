import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Confidential RWA OS",
    template: "%s | Confidential RWA OS",
  },
  description:
    "Confidential asset infrastructure for tokenized finance with private transfers, selective disclosure, and audit-ready workflows.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
