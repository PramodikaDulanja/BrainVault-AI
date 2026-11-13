"use client";
import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Send, Plus, MessageSquare, Bot, User, Trash2 } from "lucide-react";

interface ChatSession {
  id: string;
  title: string;
}

interface Message {
  role: string;
  content: string;
}

function ChatWorkspace() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] =
    useState<string>("default_session");
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialQueryHandled = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch all persisted sessions from PostgreSQL
  const fetchSessions = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/chat/sessions");
      const data = await res.json();
      if (data.sessions) {
        setSessions(data.sessions);
        return data.sessions as ChatSession[];
      }
    } catch (error) {
      console.error("Failed to load chat sessions:", error);
    }
    return [];
  };

  // Load messages for a specific session
  const loadSessionMessages = async (sessionId: string) => {
    setCurrentSession(sessionId);
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/chat/sessions/${sessionId}`,
      );
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (error) {
      console.error("Failed to load session history:", error);
    }
  };

  // Send a message (supports both manual input and Dashboard auto-query)
  const sendMessage = async (textToSend: string, targetSessionId: string) => {
    if (!textToSend.trim()) return;

    const userMsg = textToSend.trim();
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setQuery("");
    setIsLoading(true);

    // Ensure session appears immediately in sidebar
    setSessions((prev) => {
      const exists = prev.some((s) => s.id === targetSessionId);
      const previewTitle =
        userMsg.slice(0, 45) + (userMsg.length > 45 ? "..." : "");
      if (!exists) {
        return [{ id: targetSessionId, title: previewTitle }, ...prev];
      }
      return prev.map((s) =>
        s.id === targetSessionId && s.title === "New Chat"
          ? { ...s, title: previewTitle }
          : s,
      );
    });

    try {
      const res = await fetch("http://127.0.0.1:8000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userMsg, session_id: targetSessionId }),
      });
      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          content: data.answer || data.error || "No response received.",
        },
      ]);
      await fetchSessions();
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: "Error connecting to BrainVault backend." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // On initial mount: handle Dashboard ?q= redirect OR load most recent session
  useEffect(() => {
    const initChat = async () => {
      const incomingQuery = searchParams.get("q");
      const existingSessions = await fetchSessions();

      if (incomingQuery && !initialQueryHandled.current) {
        initialQueryHandled.current = true;
        const freshSessionId = `session_${Date.now()}`;
        setCurrentSession(freshSessionId);
        setMessages([]);
        router.replace("/chat");
        await sendMessage(incomingQuery, freshSessionId);
      } else if (existingSessions.length > 0 && !incomingQuery) {
        await loadSessionMessages(existingSessions[0].id);
      } else {
        const defaultId = `session_${Date.now()}`;
        setCurrentSession(defaultId);
      }
    };

    initChat();
  }, []);

  const createNewChat = () => {
    const newId = `session_${Date.now()}`;
    setSessions((prev) => [{ id: newId, title: "New Chat" }, ...prev]);
    setCurrentSession(newId);
    setMessages([]);
  };

  const handleDeleteSession = async (
    e: React.MouseEvent,
    sessionId: string,
  ) => {
    e.stopPropagation();
    try {
      await fetch(`http://127.0.0.1:8000/api/chat/sessions/${sessionId}`, {
        method: "DELETE",
      });
      const remaining = sessions.filter((s) => s.id !== sessionId);
      setSessions(remaining);

      if (currentSession === sessionId) {
        if (remaining.length > 0) {
          await loadSessionMessages(remaining[0].id);
        } else {
          createNewChat();
        }
      }
    } catch (error) {
      console.error("Failed to delete chat session:", error);
    }
  };

  return (
    <div className="flex h-screen bg-[#151923] text-gray-100 overflow-hidden">
      {/* Secondary Chat Sidebar */}
      <aside className="w-72 bg-[#0f111a] border-r border-gray-800 flex flex-col p-4">
        <button
          onClick={createNewChat}
          className="w-full bg-[#8b5cf6] hover:bg-[#7c3aed] text-white flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium mb-6 transition-colors shadow-lg shadow-purple-500/10"
        >
          <Plus className="w-4 h-4" /> New Chat
        </button>

        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-2">
          Saved Chats ({sessions.length})
        </p>

        <div className="flex-1 space-y-1 overflow-y-auto">
          {sessions.length === 0 ? (
            <p className="text-xs text-gray-500 px-2 py-4">
              No saved conversations yet.
            </p>
          ) : (
            sessions.map((sess) => (
              <div
                key={sess.id}
                onClick={() => loadSessionMessages(sess.id)}
                className={`group w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm cursor-pointer transition-colors ${
                  currentSession === sess.id
                    ? "bg-[#1e2333] text-white font-medium"
                    : "text-gray-400 hover:text-gray-200 hover:bg-[#151923]"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <MessageSquare className="w-4 h-4 text-purple-400 shrink-0" />
                  <span className="truncate">{sess.title}</span>
                </div>

                <button
                  onClick={(e) => handleDeleteSession(e, sess.id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 p-1 rounded transition-opacity"
                  title="Delete chat"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main Chat Interface */}
      <div className="flex-1 flex flex-col h-full bg-[#151923] relative">
        {/* Top Header */}
        <div className="h-16 border-b border-gray-800 flex items-center px-8 bg-[#151923]/80 backdrop-blur z-10">
          <h2 className="text-lg font-semibold text-white">
            Knowledge Assistant
          </h2>
        </div>

        {/* Message History Feed */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6 pb-32">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 space-y-3">
              <Bot className="w-12 h-12 text-purple-400 opacity-60" />
              <p className="text-lg font-medium text-gray-300">
                How can I help you explore your vault today?
              </p>
              <p className="text-xs max-w-sm">
                Ask questions about your uploaded PDFs, indexed web articles, or
                visual diagrams.
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-4 max-w-3xl mx-auto w-full ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {msg.role === "ai" && (
                  <div className="bg-[#8b5cf6] p-2 rounded-xl text-white mt-1 shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`p-4 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-[#2563eb] text-white rounded-br-xs"
                      : "bg-[#1b212f] border border-gray-800 text-gray-200 rounded-bl-xs w-full"
                  }`}
                >
                  {msg.content}
                </div>

                {msg.role === "user" && (
                  <div className="bg-gray-700 p-2 rounded-xl text-white mt-1 shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))
          )}

          {isLoading && (
            <div className="flex items-center gap-4 max-w-3xl mx-auto w-full">
              <div className="bg-[#8b5cf6] p-2 rounded-xl text-white">
                <Bot className="w-4 h-4 animate-bounce" />
              </div>
              <div className="bg-[#1b212f] border border-gray-800 p-4 rounded-2xl text-sm text-gray-400 animate-pulse">
                Searching your BrainVault knowledge base...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Floating Bottom Chat Input Bar */}
        <div className="absolute bottom-6 left-0 right-0 px-8 max-w-4xl mx-auto z-20">
          <div className="bg-[#1b212f] border border-gray-700/80 rounded-2xl p-2 flex items-center shadow-2xl backdrop-blur">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && sendMessage(query, currentSession)
              }
              placeholder="Ask anything across your stored vault..."
              className="flex-1 bg-transparent px-4 py-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none"
            />
            <button
              onClick={() => sendMessage(query, currentSession)}
              disabled={isLoading}
              className="bg-[#8b5cf6] hover:bg-[#7c3aed] disabled:opacity-50 text-white p-3 rounded-xl transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AIChat() {
  return (
    <Suspense
      fallback={
        <div className="p-10 text-gray-400">Loading Knowledge Assistant...</div>
      }
    >
      <ChatWorkspace />
    </Suspense>
  );
}
