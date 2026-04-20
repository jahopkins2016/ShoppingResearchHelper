import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import styles from "./page.module.css";

export default async function Home() {
  // If already signed in, go straight to the app.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/collections");

  return (
    <div className={styles.container}>
      <div className={styles.topBar} />

      <main className={styles.main}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={styles.logoIcon}
          src="/saveit-icon.svg"
          alt="SaveIt"
        />
        <h1 className={styles.heading}>SaveIt</h1>
        <p className={styles.tagline}>
          Curate your personal gallery of inspiration. Bookmark products
          from any site — sync across iPhone, Android, and web.
        </p>

        <Link href="/login?mode=signup" className={styles.primaryCta}>
          Get started &rarr;
        </Link>

        <p className={styles.signInNote}>
          Already have an account?{" "}
          <Link href="/login" className={styles.signInLink}>
            Sign in
          </Link>
        </p>
      </main>

      <footer className={styles.footer}>
        <Link href="/privacy">Privacy Policy</Link>
        <span aria-hidden>·</span>
        <Link href="/terms">Terms of Service</Link>
      </footer>
    </div>
  );
}
