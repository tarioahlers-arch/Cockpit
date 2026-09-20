"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { RequireAuth } from "@/components/RequireAuth";
import { api, apiErrorMessage, uploadUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { getSocket } from "@/lib/socket";
import { formatTime } from "@/lib/format";
import type { Conversation, Message } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { ErrorBox, Spinner } from "@/components/Ui";

function ChatContent({ conversationId }: { conversationId: string }) {
  const { user, token } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [typingUser, setTypingUser] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: conversations } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const res = await api.get<{ conversations: Conversation[] }>("/conversations");
      return res.data.conversations;
    },
  });
  const conversation = conversations?.find((c) => c.id === conversationId);
  const other = conversation
    ? conversation.customer?.id === user?.id
      ? conversation.tasker
      : conversation.customer
    : null;

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/conversations/${conversationId}/messages`)
      .then((res) => {
        if (!cancelled) setMessages(res.data.messages);
      })
      .catch((err) => setError(apiErrorMessage(err, "Nachrichten konnten nicht geladen werden.")));
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    socket.emit("conversation:join", conversationId);

    function onMessage(msg: Message) {
      if (msg.conversationId === conversationId) {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      }
    }
    function onTyping(payload: { userId: string }) {
      if (payload.userId !== user?.id) {
        setTypingUser(true);
        setTimeout(() => setTypingUser(false), 2000);
      }
    }
    socket.on("message:new", onMessage);
    socket.on("typing", onTyping);

    return () => {
      socket.emit("conversation:leave", conversationId);
      socket.off("message:new", onMessage);
      socket.off("typing", onTyping);
    };
  }, [conversationId, token, user?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function handleTyping() {
    if (!token) return;
    const socket = getSocket(token);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit("typing", { conversationId });
    }, 150);
  }

  function sendMessage(payload: { text?: string; attachmentUrl?: string }) {
    if (!token) return;
    const socket = getSocket(token);
    socket.emit(
      "message:send",
      { conversationId, ...payload },
      (res: { message?: Message; error?: string }) => {
        if (res?.error) {
          setError(res.error);
        } else if (res?.message) {
          setMessages((prev) =>
            prev.some((m) => m.id === res.message!.id) ? prev : [...prev, res.message!]
          );
        }
      }
    );
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    sendMessage({ text: text.trim() });
    setText("");
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post("/uploads", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      sendMessage({ attachmentUrl: res.data.url });
    } catch (err) {
      setError(apiErrorMessage(err, "Datei konnte nicht hochgeladen werden."));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="container-page py-6 max-w-2xl flex flex-col h-[calc(100vh-160px)]">
      <div className="mb-3 flex items-center gap-2">
        <Link href="/messages" className="text-sm text-primary-dark hover:underline">
          ← Nachrichten
        </Link>
      </div>
      <div className="card flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-border p-3 flex items-center gap-2">
          {other && (
            <>
              <Avatar name={`${other.firstName} ${other.lastName}`} avatarUrl={other.avatarUrl} size={32} />
              <div>
                <p className="font-medium text-sm">
                  {other.firstName} {other.lastName}
                </p>
                {conversation?.task && (
                  <Link href={`/tasks/${conversation.task.id}`} className="text-xs text-muted hover:underline">
                    {conversation.task.title}
                  </Link>
                )}
              </div>
            </>
          )}
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <p className="text-center text-sm text-muted py-8">
              Noch keine Nachrichten. Schreib die erste!
            </p>
          )}
          {messages.map((m) => {
            const isMine = m.senderId === user?.id;
            return (
              <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                    isMine ? "bg-primary text-white" : "bg-gray-100 text-foreground"
                  }`}
                >
                  {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
                  {m.attachmentUrl && (
                    <a
                      href={uploadUrl(m.attachmentUrl) || "#"}
                      target="_blank"
                      rel="noreferrer"
                      className={`underline text-xs block mt-1 ${isMine ? "text-white" : "text-primary-dark"}`}
                    >
                      📎 Anhang öffnen
                    </a>
                  )}
                  <span className={`block text-[10px] mt-1 ${isMine ? "text-white/70" : "text-muted"}`}>
                    {formatTime(m.createdAt)}
                  </span>
                </div>
              </div>
            );
          })}
          {typingUser && <p className="text-xs text-muted">Tippt gerade…</p>}
        </div>

        {error && (
          <div className="px-4">
            <ErrorBox message={error} />
          </div>
        )}

        <form onSubmit={handleSend} className="border-t border-border p-3 flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFile}
          />
          <button
            type="button"
            className="btn-ghost !p-2 text-lg"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            aria-label="Datei anhängen"
          >
            📎
          </button>
          <input
            className="input flex-1"
            placeholder="Nachricht schreiben…"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              handleTyping();
            }}
          />
          <button type="submit" className="btn-primary text-sm" disabled={!text.trim()}>
            Senden
          </button>
        </form>
      </div>
    </div>
  );
}

function ChatLoader({ conversationId }: { conversationId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const res = await api.get<{ conversations: Conversation[] }>("/conversations");
      return res.data.conversations;
    },
  });
  if (isLoading) {
    return (
      <div className="container-page py-16">
        <Spinner />
      </div>
    );
  }
  const found = data?.some((c) => c.id === conversationId);
  if (data && !found) {
    return (
      <div className="container-page py-16">
        <ErrorBox message="Diese Unterhaltung wurde nicht gefunden oder du hast keinen Zugriff." />
      </div>
    );
  }
  return <ChatContent conversationId={conversationId} />;
}

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequireAuth>
      <ChatLoader conversationId={id} />
    </RequireAuth>
  );
}
