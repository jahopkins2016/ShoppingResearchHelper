"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState<string>("");
  const [referralCode, setReferralCode] = useState<string>("");
  const [referralCount, setReferralCount] = useState<number>(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setEmail(user.email ?? "");

      supabase
        .from("profiles")
        .select("referral_code")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (data?.referral_code) setReferralCode(data.referral_code);
        });

      supabase
        .from("referrals")
        .select("id", { count: "exact", head: true })
        .eq("referrer_id", user.id)
        .eq("status", "signed_up")
        .then(({ count }) => {
          setReferralCount(count ?? 0);
        });
    });
  }, [supabase]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function handleCopyLink() {
    const link = `https://saveit.app/join?ref=${referralCode}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
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

      {/* Referral section */}
      {referralCode && (
        <div className={styles.menuGroup}>
          <h4 className={styles.menuGroupLabel}>REFERRALS</h4>
          <div className={styles.referralCard}>
            <p className={styles.referralHeading}>Invite friends to SaveIt</p>
            <p className={styles.referralStat}>
              <strong>{referralCount}</strong> friend{referralCount !== 1 ? "s" : ""} joined
            </p>
            <div className={styles.referralLinkRow}>
              <input
                className={styles.referralLinkInput}
                type="text"
                readOnly
                value={`https://saveit.app/join?ref=${referralCode}`}
              />
              <button
                className={styles.copyButton}
                onClick={handleCopyLink}
              >
                {copied ? "Copied!" : "Copy Link"}
              </button>
            </div>
          </div>
        </div>
      )}

      <button className={styles.signOutButton} onClick={handleSignOut}>
        Sign Out
      </button>

      <p className={styles.version}>SaveIt Version 1.0.0<br />© 2026 SaveIt</p>
    </div>
  );
}
