"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

type Feedback = {
  id: string;
  category: string;
  message: string;
  status: string;
  created_at: string;
};

const CATEGORIES = [
  { value: "bug", label: "Bug Report" },
  { value: "feature", label: "Feature Request" },
  { value: "general", label: "General" },
  { value: "complaint", label: "Complaint" },
] as const;

const categoryClass: Record<string, string> = {
  bug: styles.categoryBug,
  feature: styles.categoryFeature,
  general: styles.categoryGeneral,
  complaint: styles.categoryComplaint,
};

const categoryLabel: Record<string, string> = {
  bug: "Bug Report",
  feature: "Feature Request",
  general: "General",
  complaint: "Complaint",
};

const statusClass: Record<string, string> = {
  open: styles.statusOpen,
  reviewed: styles.statusReviewed,
  resolved: styles.statusResolved,
};

export default function FeedbackPage() {
  const supabase = createClient();
  const [category, setCategory] = useState("bug");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFeedback();
  }, []);

  async function loadFeedback() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("feedback")
      .select("id, category, message, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    setFeedbackList(data ?? []);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;

    setSubmitting(true);
    setSuccess(false);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.from("feedback").insert({
      user_id: user.id,
      category,
      message: message.trim(),
      status: "open",
    });

    setSubmitting(false);

    if (!error) {
      setMessage("");
      setCategory("bug");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      loadFeedback();
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Feedback</h1>
      <p className={styles.subtitle}>
        Let us know how we can improve SaveIt
      </p>

      <form className={styles.formCard} onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="category">
            Category
          </label>
          <select
            id="category"
            className={styles.select}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="message">
            Message
          </label>
          <textarea
            id="message"
            className={styles.textarea}
            placeholder="Describe your feedback…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>

        <button
          type="submit"
          className={styles.submitBtn}
          disabled={submitting || !message.trim()}
        >
          {submitting ? "Submitting…" : "Submit Feedback"}
        </button>

        {success && (
          <p className={styles.successMsg}>
            Thanks for your feedback!
          </p>
        )}
      </form>

      <p className={styles.sectionLabel}>Your Submissions</p>

      {loading ? null : feedbackList.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>No feedback yet</p>
          <p className={styles.emptySubtext}>
            Submit your first feedback above
          </p>
        </div>
      ) : (
        <div className={styles.feedbackList}>
          {feedbackList.map((fb) => (
            <div key={fb.id} className={styles.feedbackCard}>
              <div className={styles.cardHeader}>
                <span
                  className={`${styles.categoryBadge} ${categoryClass[fb.category] ?? ""}`}
                >
                  {categoryLabel[fb.category] ?? fb.category}
                </span>
                <span
                  className={`${styles.statusBadge} ${statusClass[fb.status] ?? ""}`}
                >
                  {fb.status}
                </span>
              </div>
              <p className={styles.cardMessage}>{fb.message}</p>
              <p className={styles.cardDate}>{formatDate(fb.created_at)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
