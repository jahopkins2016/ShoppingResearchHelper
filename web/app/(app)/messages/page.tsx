"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

type Profile = {
  id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
};

type Conversation = {
  id: string;
  updated_at: string;
  partner: Profile;
  lastMessage: string | null;
  lastMessageTime: string | null;
  unread: boolean;
};

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export default function MessagesPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [friends, setFriends] = useState<Profile[]>([]);
  const [friendSearch, setFriendSearch] = useState("");
  const [loadingFriends, setLoadingFriends] = useState(false);
  const messageEndRef = useRef<HTMLDivElement>(null);

  const selectedConversation = conversations.find((c) => c.id === selectedId);

  // ── Init: get user and load conversations ──
  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      await loadConversations(user.id);
    }
    init();
  }, []);

  const loadConversations = useCallback(
    async (uid: string) => {
      setLoading(true);

      // Get all conversations this user participates in
      const { data: participantRows } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", uid);

      if (!participantRows || participantRows.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const conversationIds = participantRows.map((r) => r.conversation_id);

      // Get conversation details
      const { data: convos } = await supabase
        .from("conversations")
        .select("id, updated_at")
        .in("id", conversationIds)
        .order("updated_at", { ascending: false });

      if (!convos) {
        setConversations([]);
        setLoading(false);
        return;
      }

      // Get all participants for these conversations to find partners
      const { data: allParticipants } = await supabase
        .from("conversation_participants")
        .select("conversation_id, user_id")
        .in("conversation_id", conversationIds);

      // Get partner user ids
      const partnerIds = new Set<string>();
      for (const p of allParticipants ?? []) {
        if (p.user_id !== uid) partnerIds.add(p.user_id);
      }

      // Fetch partner profiles
      let profileMap: Record<string, Profile> = {};
      if (partnerIds.size > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, email, avatar_url")
          .in("id", Array.from(partnerIds));

        for (const p of profiles ?? []) {
          profileMap[p.id] = p;
        }
      }

      // Get last message for each conversation
      const { data: lastMessages } = await supabase
        .from("messages")
        .select("conversation_id, body, created_at, sender_id, read_at")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false });

      // Build a map of last message per conversation and unread status
      const lastMsgMap: Record<
        string,
        { body: string; time: string; unread: boolean }
      > = {};
      for (const cid of conversationIds) {
        const msgs = (lastMessages ?? []).filter(
          (m) => m.conversation_id === cid
        );
        if (msgs.length > 0) {
          const last = msgs[0];
          const hasUnread = msgs.some(
            (m) => m.sender_id !== uid && !m.read_at
          );
          lastMsgMap[cid] = {
            body: last.body,
            time: last.created_at,
            unread: hasUnread,
          };
        }
      }

      // Build conversation partner map
      const conversationPartnerMap: Record<string, string> = {};
      for (const p of allParticipants ?? []) {
        if (p.user_id !== uid) {
          conversationPartnerMap[p.conversation_id] = p.user_id;
        }
      }

      const result: Conversation[] = convos.map((c) => {
        const partnerId = conversationPartnerMap[c.id];
        const partner = profileMap[partnerId] ?? {
          id: partnerId,
          display_name: null,
          email: null,
          avatar_url: null,
        };
        const lm = lastMsgMap[c.id];
        return {
          id: c.id,
          updated_at: c.updated_at,
          partner,
          lastMessage: lm?.body ?? null,
          lastMessageTime: lm?.time ?? null,
          unread: lm?.unread ?? false,
        };
      });

      setConversations(result);
      setLoading(false);
    },
    [supabase]
  );

  // ── Load messages when selecting a conversation ──
  useEffect(() => {
    if (!selectedId || !userId) return;

    async function loadMessages() {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", selectedId)
        .order("created_at", { ascending: true });

      setMessages(data ?? []);

      // Mark unread messages as read
      const unread = (data ?? []).filter(
        (m) => m.sender_id !== userId && !m.read_at
      );
      if (unread.length > 0) {
        const unreadIds = unread.map((m) => m.id);
        await supabase
          .from("messages")
          .update({ read_at: new Date().toISOString() })
          .in("id", unreadIds);

        // Update conversation unread indicator
        setConversations((prev) =>
          prev.map((c) => (c.id === selectedId ? { ...c, unread: false } : c))
        );
      }
    }

    loadMessages();
  }, [selectedId, userId]);

  // ── Scroll to bottom on messages change ──
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send message ──
  async function handleSend() {
    const body = messageInput.trim();
    if (!body || !selectedId || !userId) return;

    setSending(true);
    try {
      const { data, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: selectedId,
          sender_id: userId,
          body,
        })
        .select()
        .single();

      if (error || !data) return;

      setMessages((prev) => [...prev, data]);
      setMessageInput("");

      // Update conversation updated_at
      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", selectedId);

      // Update conversation list preview
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedId
            ? {
                ...c,
                lastMessage: body,
                lastMessageTime: data.created_at,
                updated_at: data.created_at,
              }
            : c
        )
      );
    } finally {
      setSending(false);
    }
  }

  // ── New message modal: load friends ──
  async function openNewMessageModal() {
    setShowNewModal(true);
    setFriendSearch("");
    setLoadingFriends(true);

    if (!userId) return;

    const { data: friendRows } = await supabase
      .from("friends")
      .select("friend_id")
      .eq("user_id", userId);

    if (!friendRows || friendRows.length === 0) {
      setFriends([]);
      setLoadingFriends(false);
      return;
    }

    const friendIds = friendRows.map((r) => r.friend_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, email, avatar_url")
      .in("id", friendIds);

    setFriends(profiles ?? []);
    setLoadingFriends(false);
  }

  // ── Start or open conversation with a friend ──
  async function startConversation(friendId: string) {
    if (!userId) return;

    // Check if a conversation already exists between these two users
    const { data: myConvos } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", userId);

    const { data: friendConvos } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", friendId);

    const mySet = new Set((myConvos ?? []).map((r) => r.conversation_id));
    const sharedConvoId = (friendConvos ?? []).find((r) =>
      mySet.has(r.conversation_id)
    )?.conversation_id;

    if (sharedConvoId) {
      // Existing conversation found — select it
      setSelectedId(sharedConvoId);
      setShowNewModal(false);
      return;
    }

    // Create new conversation — generate ID client-side because the
    // SELECT RLS policy requires the user to be a participant, which
    // hasn't been added yet at insert time.
    const newConvoId = crypto.randomUUID();
    const { error: convoError } = await supabase
      .from("conversations")
      .insert({ id: newConvoId, updated_at: new Date().toISOString() });

    if (convoError) return;

    // Add both participants
    await supabase.from("conversation_participants").insert([
      { conversation_id: newConvoId, user_id: userId },
      { conversation_id: newConvoId, user_id: friendId },
    ]);

    // Refresh conversations and select the new one
    await loadConversations(userId);
    setSelectedId(newConvoId);
    setShowNewModal(false);
  }

  // ── Helpers ──
  function getInitial(profile: Profile): string {
    if (profile.display_name) return profile.display_name.charAt(0).toUpperCase();
    if (profile.email) return profile.email.charAt(0).toUpperCase();
    return "?";
  }

  function getDisplayName(profile: Profile): string {
    return profile.display_name || profile.email || "Unknown";
  }

  function formatTime(iso: string): string {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      });
    }
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) {
      return date.toLocaleDateString(undefined, { weekday: "short" });
    }
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  }

  function formatMessageTime(iso: string): string {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  const filteredFriends = friends.filter((f) => {
    const q = friendSearch.toLowerCase();
    if (!q) return true;
    return (
      (f.display_name?.toLowerCase().includes(q) ?? false) ||
      (f.email?.toLowerCase().includes(q) ?? false)
    );
  });

  // ── Render ──
  return (
    <div className={styles.container}>
      {/* Left panel: conversation list */}
      <div className={styles.leftPanel}>
        <div className={styles.leftHeader}>
          <span className={styles.leftTitle}>Messages</span>
          <button
            className={styles.newMessageBtn}
            onClick={openNewMessageModal}
          >
            + New
          </button>
        </div>

        {loading ? (
          <div className={styles.emptyConversations}>
            <p className={styles.emptySubtext}>Loading…</p>
          </div>
        ) : conversations.length === 0 ? (
          <div className={styles.emptyConversations}>
            <div className={styles.emptyIcon}>💬</div>
            <p className={styles.emptyText}>No conversations yet</p>
            <p className={styles.emptySubtext}>
              Start a conversation with one of your friends.
            </p>
          </div>
        ) : (
          <div className={styles.conversationList}>
            {conversations.map((convo) => (
              <div
                key={convo.id}
                className={`${styles.conversationItem} ${
                  selectedId === convo.id ? styles.conversationItemActive : ""
                }`}
                onClick={() => setSelectedId(convo.id)}
              >
                {convo.unread && <div className={styles.unreadDot} />}
                <div className={styles.avatar}>
                  {getInitial(convo.partner)}
                </div>
                <div className={styles.conversationInfo}>
                  <div className={styles.conversationName}>
                    {getDisplayName(convo.partner)}
                  </div>
                  {convo.lastMessage && (
                    <div className={styles.conversationPreview}>
                      {convo.lastMessage.length > 50
                        ? convo.lastMessage.slice(0, 50) + "…"
                        : convo.lastMessage}
                    </div>
                  )}
                </div>
                {convo.lastMessageTime && (
                  <span className={styles.conversationTime}>
                    {formatTime(convo.lastMessageTime)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right panel: chat area */}
      <div className={styles.rightPanel}>
        {!selectedConversation ? (
          <div className={styles.chatEmpty}>
            <p className={styles.chatEmptyText}>Select a conversation</p>
            <p className={styles.chatEmptySubtext}>
              Choose a conversation from the left or start a new one.
            </p>
          </div>
        ) : (
          <>
            <div className={styles.chatHeader}>
              <div className={styles.avatar}>
                {getInitial(selectedConversation.partner)}
              </div>
              <span className={styles.chatHeaderName}>
                {getDisplayName(selectedConversation.partner)}
              </span>
            </div>

            {messages.length === 0 ? (
              <div className={styles.noMessages}>
                No messages yet — say hello!
              </div>
            ) : (
              <div className={styles.messageList}>
                {messages.map((msg) => {
                  const isMine = msg.sender_id === userId;
                  return (
                    <div key={msg.id}>
                      <div
                        className={`${styles.messageRow} ${
                          isMine
                            ? styles.messageRowMine
                            : styles.messageRowTheirs
                        }`}
                      >
                        {!isMine && (
                          <div className={styles.messageAvatar}>
                            {getInitial(selectedConversation.partner)}
                          </div>
                        )}
                        <div
                          className={`${styles.messageBubble} ${
                            isMine ? styles.bubbleMine : styles.bubbleTheirs
                          }`}
                        >
                          {msg.body}
                        </div>
                      </div>
                      <div
                        className={`${styles.messageTime} ${
                          isMine
                            ? styles.messageTimeMine
                            : styles.messageTimeTheirs
                        }`}
                      >
                        {formatMessageTime(msg.created_at)}
                      </div>
                    </div>
                  );
                })}
                <div ref={messageEndRef} />
              </div>
            )}

            <div className={styles.inputArea}>
              <input
                className={styles.messageInput}
                type="text"
                placeholder="Type a message…"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <button
                className={styles.sendBtn}
                onClick={handleSend}
                disabled={sending || !messageInput.trim()}
                aria-label="Send message"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          </>
        )}
      </div>

      {/* New Message Modal */}
      {showNewModal && (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowNewModal(false)}
        >
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className={styles.modalTitle}>New Message</h2>
            <input
              className={styles.modalInput}
              type="text"
              placeholder="Search friends…"
              value={friendSearch}
              onChange={(e) => setFriendSearch(e.target.value)}
              autoFocus
            />
            <div className={styles.friendList}>
              {loadingFriends ? (
                <div className={styles.noFriends}>Loading…</div>
              ) : filteredFriends.length === 0 ? (
                <div className={styles.noFriends}>
                  {friendSearch
                    ? "No friends match your search."
                    : "No friends yet."}
                </div>
              ) : (
                filteredFriends.map((friend) => (
                  <div
                    key={friend.id}
                    className={styles.friendItem}
                    onClick={() => startConversation(friend.id)}
                  >
                    <div className={styles.avatar}>
                      {getInitial(friend)}
                    </div>
                    <div>
                      <div className={styles.friendName}>
                        {getDisplayName(friend)}
                      </div>
                      {friend.email && friend.display_name && (
                        <div className={styles.friendEmail}>
                          {friend.email}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className={styles.modalActions}>
              <button
                className={styles.modalCancel}
                onClick={() => setShowNewModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
