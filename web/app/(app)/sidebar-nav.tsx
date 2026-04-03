"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./layout.module.css";

export default function SidebarNav({
  pendingCount,
}: {
  pendingCount: number;
}) {
  const pathname = usePathname();

  return (
    <nav className={styles.sidebarNav}>
      <Link
        href="/collections"
        className={`${styles.sidebarLink} ${
          pathname.startsWith("/collections") ? styles.sidebarLinkActive : ""
        }`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
        Collections
      </Link>
      <Link
        href="/shared"
        className={`${styles.sidebarLink} ${
          pathname.startsWith("/shared") ? styles.sidebarLinkActive : ""
        }`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        Shared With Me
        {pendingCount > 0 && (
          <span className={styles.navBadge}>{pendingCount}</span>
        )}
      </Link>
    </nav>
  );
}
