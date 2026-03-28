import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SaveIt",
  description: "Save anything. Find it later.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
