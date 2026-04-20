import type { Metadata } from "next";
import { APP_VERSION_LABEL } from "@/lib/version";
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
        <span className="version-badge">{APP_VERSION_LABEL}</span>
      </body>
    </html>
  );
}
