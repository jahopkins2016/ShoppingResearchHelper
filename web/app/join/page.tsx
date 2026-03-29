import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import styles from "./page.module.css";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;

  if (!ref) {
    redirect("/login");
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("referral_code", ref)
    .single();

  const cookieStore = await cookies();
  cookieStore.set("saveit_ref", ref, {
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    httpOnly: true,
    sameSite: "lax",
  });

  const inviterName = profile?.display_name;

  return (
    <div className={styles.container}>
      <div className={styles.topBar} />

      <div className={styles.card}>
        <div className={styles.logoWrap}>
          <div className={styles.logoIcon}>↓</div>
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
