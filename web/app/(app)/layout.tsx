import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import styles from "./layout.module.css";

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

  return (
    <div className={styles.shell}>
      <nav className={styles.nav}>
        <div className={styles.navLeft}>
          <Link href="/collections" className={styles.logo}>
            The Gallery
          </Link>
        </div>
        <div className={styles.links}>
          <Link href="/collections" className={styles.link}>
            Collections
          </Link>
          <Link href="/shared" className={styles.link}>
            Shared
          </Link>
          <Link href="/settings" className={styles.link}>
            Settings
          </Link>
        </div>
        <div className={styles.navRight}>
          <div className={styles.avatar}>
            {user.email?.charAt(0).toUpperCase()}
          </div>
        </div>
      </nav>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
