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
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setEmail(user.email ?? "");

      supabase
        .from("profiles")
        .select("referral_code")
        .eq("id", user.id)
        .single()
        .then(async ({ data }) => {
          if (data?.referral_code) {
            setReferralCode(data.referral_code);
          } else {
            // Generate a referral code if missing
            const code = Math.random().toString(36).substring(2, 10);
            await supabase
              .from("profiles")
              .update({ referral_code: code })
              .eq("id", user.id);
            setReferralCode(code);
          }
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

  async function handleChangePassword() {
    if (!newPassword || newPassword.length < 6) {
      setPasswordMsg("Password must be at least 6 characters.");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPasswordMsg(error.message);
    } else {
      setPasswordMsg("Password updated successfully.");
      setNewPassword("");
      setTimeout(() => {
        setShowPasswordForm(false);
        setPasswordMsg(null);
      }, 2000);
    }
  }

  function handleCopyLink() {
    const link = `${window.location.origin}/join?ref=${referralCode}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleShareInvite() {
    const link = `${window.location.origin}/join?ref=${referralCode}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join me on SaveIt",
          text: "Save products from any website, track prices, and share collections. Join me on SaveIt!",
          url: link,
        });
      } catch {
        // User cancelled share
      }
    } else {
      handleCopyLink();
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Settings</h1>
      <p className={styles.subtitle}>Manage your account</p>

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

      {/* Invite Friends — always visible */}
      <div className={styles.menuGroup}>
        <h4 className={styles.menuGroupLabel}>INVITE FRIENDS</h4>
        <div className={styles.referralCard}>
          <div className={styles.referralEmoji}>🎉</div>
          <p className={styles.referralHeading}>Share SaveIt with friends</p>
          <p className={styles.referralSubtext}>
            When friends join using your link, you both get credit.
          </p>
          {referralCount > 0 && (
            <p className={styles.referralStat}>
              <strong>{referralCount}</strong> friend{referralCount !== 1 ? "s" : ""} joined so far
            </p>
          )}
          {referralCode ? (
            <>
              <div className={styles.referralLinkRow}>
                <input
                  className={styles.referralLinkInput}
                  type="text"
                  readOnly
                  value={`${window.location.origin}/join?ref=${referralCode}`}
                />
                <button className={styles.copyButton} onClick={handleCopyLink}>
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <button className={styles.shareButton} onClick={handleShareInvite}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                Share Invite Link
              </button>
            </>
          ) : (
            <p className={styles.referralLoading}>Generating your link…</p>
          )}
        </div>
      </div>

      {/* Account */}
      <div className={styles.menuGroup}>
        <h4 className={styles.menuGroupLabel}>ACCOUNT</h4>
        <div className={styles.menuCard}>
          <button
            className={styles.menuItem}
            onClick={() => setShowPasswordForm(!showPasswordForm)}
          >
            <span>Change Password</span>
            <span className={styles.chevron}>›</span>
          </button>
          {showPasswordForm && (
            <div className={styles.inlineForm}>
              <input
                type="password"
                className={styles.inlineInput}
                placeholder="New password (min 6 chars)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              {passwordMsg && (
                <p className={styles.inlineMsg}>{passwordMsg}</p>
              )}
              <button className={styles.inlineBtn} onClick={handleChangePassword}>
                Update Password
              </button>
            </div>
          )}
        </div>
      </div>

      <button className={styles.signOutButton} onClick={handleSignOut}>
        Sign Out
      </button>

      <p className={styles.version}>SaveIt Version 1.0.0<br />© 2026 SaveIt</p>
    </div>
  );
}
