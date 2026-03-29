"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email ?? "");
    });
  }, [supabase.auth]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Settings</h1>
      <p className={styles.subtitle}>Manage your gallery and account</p>

      {/* Profile card */}
      <div className={styles.profileCard}>
        <div className={styles.avatar}>
          {email.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className={styles.profileName}>{email.split("@")[0]}</p>
          <p className={styles.profileEmail}>{email}</p>
        </div>
      </div>

      {/* Menu groups */}
      <div className={styles.menuGroup}>
        <h4 className={styles.menuGroupLabel}>APP PREFERENCES</h4>
        <div className={styles.menuCard}>
          <button className={styles.menuItem}>
            <span>Notifications</span>
            <span className={styles.chevron}>›</span>
          </button>
          <button className={styles.menuItem}>
            <span>Appearance</span>
            <span className={styles.chevron}>›</span>
          </button>
          <button className={styles.menuItem}>
            <span>Storage &amp; Sync</span>
            <span className={styles.chevron}>›</span>
          </button>
        </div>
      </div>

      <div className={styles.menuGroup}>
        <h4 className={styles.menuGroupLabel}>SECURITY</h4>
        <div className={styles.menuCard}>
          <button className={styles.menuItem}>
            <span>Privacy &amp; Security</span>
            <span className={styles.chevron}>›</span>
          </button>
          <button className={styles.menuItem}>
            <span>Help &amp; Support</span>
            <span className={styles.chevron}>›</span>
          </button>
        </div>
      </div>

      <button className={styles.signOutButton} onClick={handleSignOut}>
        Sign Out
      </button>

      <p className={styles.version}>SaveIt Version 1.0.0<br />© 2026 SaveIt</p>
    </div>
  );
}
