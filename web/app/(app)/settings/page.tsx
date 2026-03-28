"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div>
      <h1 className={styles.title}>Settings</h1>
      <button className={styles.signOutButton} onClick={handleSignOut}>
        Sign Out
      </button>
    </div>
  );
}
