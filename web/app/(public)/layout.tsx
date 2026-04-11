import Link from "next/link";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 32px",
          borderBottom: "1px solid var(--color-ghost-border)",
          background: "var(--color-surface-container-lowest)",
        }}
      >
        <Link
          href="/collections/public"
          style={{
            fontFamily: "var(--font-headline)",
            fontSize: "20px",
            fontWeight: 800,
            color: "var(--color-text)",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <img src="/saveit-icon.svg" alt="SaveIt" width={28} height={28} />
          SaveIt
        </Link>
        <Link
          href="/login"
          style={{
            padding: "8px 20px",
            borderRadius: "var(--radius-full)",
            background: "linear-gradient(135deg, #4F7EFF, #6B93FF)",
            color: "#fff",
            fontSize: "14px",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Sign In
        </Link>
      </header>
      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 24px" }}>
        {children}
      </main>
    </div>
  );
}
