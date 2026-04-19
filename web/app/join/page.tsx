import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import styles from "./page.module.css";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; share_id?: string }>;
}) {
  const { ref, share_id } = await searchParams;

  // Handle share invitation links
  if (share_id) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      // Logged in — redirect to collections where pending invitations appear.
      redirect("/collections");
    }

    // Not logged in — cookie is set by middleware; fetch share details for display
    // Use a new client since user isn't logged in — share info from public join context
    const { data: share } = await supabase
      .from("collection_shares")
      .select("id, role, collections(name), profiles!collection_shares_shared_by_fkey(display_name)")
      .eq("id", share_id)
      .single();

    const collectionName = (share as any)?.collections?.name;
    const sharerName = (share as any)?.profiles?.display_name;

    return (
      <div className={styles.container}>
        <div className={styles.topBar} />

        <div className={styles.card}>
          <div className={styles.logoWrap}>
            <img className={styles.logoIcon} src="/saveit-icon.svg" alt="SaveIt" />
            <h1 className={styles.logo}>SaveIt</h1>
          </div>

          <div className={styles.inviteMessage}>
            {sharerName && collectionName ? (
              <p className={styles.headline}>
                <strong>{sharerName}</strong> shared{" "}
                <strong>&ldquo;{collectionName}&rdquo;</strong> with you!
              </p>
            ) : (
              <p className={styles.headline}>
                You&apos;ve been invited to a collection!
              </p>
            )}
            <p className={styles.subtext}>
              Sign in or create an account to view the collection.
            </p>
          </div>

          <Link href="/login" className={styles.signUpButton}>
            Sign In →
          </Link>

          <p className={styles.loginNote}>
            Don&apos;t have an account?{" "}
            <Link href="/login?mode=signup">Sign up</Link>
          </p>
        </div>
      </div>
    );
  }

  // Handle referral links (existing behavior)
  if (!ref) {
    redirect("/login");
  }

  // Cookie is set by middleware; fetch referrer name for display
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("referral_code", ref)
    .single();

  const inviterName = profile?.display_name;

  return (
    <div className={styles.container}>
      <div className={styles.topBar} />

      <div className={styles.card}>
        <div className={styles.logoWrap}>
          <img className={styles.logoIcon} src="/saveit-icon.svg" alt="SaveIt" />
          <h1 className={styles.logo}>SaveIt</h1>
        </div>

        <div className={styles.inviteMessage}>
          {inviterName ? (
            <p className={styles.headline}>
              You were invited by <strong>{inviterName}</strong>!
            </p>
          ) : (
            <p className={styles.headline}>You were invited to join SaveIt!</p>
          )}
          <p className={styles.subtext}>
            Save products from any website, track prices, and organize
            everything into collections.
          </p>
        </div>

        <Link href="/login?mode=signup" className={styles.signUpButton}>
          Sign Up →
        </Link>

        <p className={styles.loginNote}>
          Already have an account? <Link href="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
