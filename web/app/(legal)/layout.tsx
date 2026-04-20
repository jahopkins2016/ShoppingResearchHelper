import Link from "next/link";
import styles from "./layout.module.css";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={styles.container}>
      <div className={styles.topBar} />

      <header className={styles.header}>
        <Link href="/" className={styles.logoLink}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={styles.logoIcon}
            src="/saveit-icon.svg"
            alt="SaveIt"
          />
          <span className={styles.logoText}>SaveIt</span>
        </Link>
      </header>

      <article className={styles.article}>{children}</article>

      <footer className={styles.footer}>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/">Home</Link>
      </footer>
    </div>
  );
}
