import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import styles from "./layout.module.css";
import SidebarNav from "./sidebar-nav";
import AvatarMenu from "./avatar-menu";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null; // middleware handles redirect
  }

  const initial = user.email?.charAt(0).toUpperCase() ?? "?";

  // Fetch pending invitation count for sidebar badge
  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", user.id)
    .single();

  const userEmail = profile?.email ?? user.email;

  const { count: pendingCount } = await supabase
    .from("collection_shares")
    .select("id", { count: "exact", head: true })
    .eq("shared_with_email", userEmail!)
    .eq("status", "pending");

  return (
    <div className={styles.shell}>
      {/* Top bar */}
      <header className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <Link href="/collections" className={styles.logo}>
            <span className={styles.logoIcon}>S</span>
            SaveIt
          </Link>
        </div>
        <div className={styles.searchWrap}>
          <svg className={styles.searchIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input className={styles.searchInput} type="text" placeholder="Search collections, items..." />
        </div>
        <div className={styles.topbarRight}>
          <button className={styles.iconBtn} aria-label="Notifications">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          </button>
          <AvatarMenu initial={initial} />
        </div>
      </header>

      <div className={styles.body}>
        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarProfile}>
            <div className={styles.sidebarAvatar}>{initial}</div>
            <div>
              <div className={styles.sidebarName}>{user.user_metadata?.display_name ?? "My Account"}</div>
              <div className={styles.sidebarEmail}>{user.email}</div>
            </div>
          </div>

          <SidebarNav pendingCount={pendingCount ?? 0} />

          <div className={styles.sidebarBottom}>
            <Link href="/get-extension" className={styles.extensionBanner}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
              <div>
                <div className={styles.extensionBannerTitle}>Get the Extension</div>
                <div className={styles.extensionBannerSub}>Save from any website</div>
              </div>
            </Link>
            <Link href="/collections" className={styles.addBookmarkBtn}>
              + Add New Bookmark
            </Link>
          </div>
        </aside>

        {/* Main content */}
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
