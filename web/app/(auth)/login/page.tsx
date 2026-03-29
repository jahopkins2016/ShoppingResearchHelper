"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"login" | "signup">(
    searchParams.get("mode") === "signup" ? "signup" : "login"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleGoogleSignIn() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/collections`,
      },
    });
    if (error) setError(error.message);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      router.push("/collections");
      router.refresh();
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      // After successful signup, check for referral code
      const refCode = document.cookie
        .split('; ')
        .find(row => row.startsWith('saveit_ref='))
        ?.split('=')[1];

      if (refCode) {
        // Look up the referrer by their referral_code
        const { data: referrer } = await supabase
          .from('profiles')
          .select('id')
          .eq('referral_code', refCode)
          .single();

        if (referrer) {
          await supabase.from('referrals').insert({
            referrer_id: referrer.id,
            referred_email: email,
            status: 'signed_up',
          });
        }
        // Clear the cookie
        document.cookie = 'saveit_ref=; Max-Age=0; path=/';
      }

      setMessage("Check your email for a confirmation link!");
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      {/* Top gradient bar */}
      <div className={styles.topBar} />

      <form className={styles.card} onSubmit={handleSubmit}>
        {/* Logo */}
        <div className={styles.logoWrap}>
          <div className={styles.logoIcon}>↓</div>
          <h1 className={styles.logo}>SaveIt</h1>
          <p className={styles.tagline}>Curate your personal gallery of inspiration.</p>
        </div>

        {/* Mode toggle */}
        <div className={styles.modeToggle}>
          <button
            type="button"
            className={`${styles.modeButton} ${mode === "login" ? styles.modeButtonActive : ""}`}
            onClick={() => { setMode("login"); setError(null); setMessage(null); }}
          >
            Log In
          </button>
          <button
            type="button"
            className={`${styles.modeButton} ${mode === "signup" ? styles.modeButtonActive : ""}`}
            onClick={() => { setMode("signup"); setError(null); setMessage(null); }}
          >
            Sign Up
          </button>
        </div>

        {error && <p className={styles.error}>{error}</p>}
        {message && <p className={styles.message}>{message}</p>}

        <label className={styles.label} htmlFor="email">Email Address</label>
        <input
          className={styles.input}
          type="email"
          id="email"
          placeholder="name@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />

        <label className={styles.label} htmlFor="password">Password</label>
        <input
          className={styles.input}
          type="password"
          id="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />

        {mode === "login" && (
          <div className={styles.forgotRow}>
            <a className={styles.forgotLink} href="#">Forgot password?</a>
          </div>
        )}

        <button
          className={styles.button}
          type="submit"
          disabled={loading}
        >
          {loading ? "Loading..." : "Continue →"}
        </button>

        {/* Divider */}
        <div className={styles.divider}>
          <span className={styles.dividerLine} />
          <span className={styles.dividerText}>OR</span>
          <span className={styles.dividerLine} />
        </div>

        {/* Google OAuth */}
        <button type="button" className={styles.googleButton} onClick={handleGoogleSignIn}>
          Continue with Google
        </button>

        <p className={styles.terms}>
          By continuing, you agree to the SaveIt{" "}
          <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.
        </p>
      </form>
    </div>
  );
}
