import type { Metadata } from "next";
import { APP_VERSION } from "@/lib/version";
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
      <body>
        {children}
        <span className="version-badge">v{APP_VERSION}</span>
      </body>
    </html>
  );
}
