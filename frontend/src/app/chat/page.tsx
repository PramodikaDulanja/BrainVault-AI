"use client";
import { useState, useRef, useEffect } from "react";
import { Send, Plus, MessageSquare, Bot, User } from "lucide-react";

export default function AIChat() {
  const [sessions, setSessions] = useState([
    { id: "default_session", name: "General Knowledge Chat" },
    { id: "session_2", name: "Architecture & Notes" },
  ]);
  const [currentSession, setCurrentSession] = useState("default_session");
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<{ role: string; content: string }[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!query.trim()) return;

    const userMsg = query;
    const newMessages = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);
    setQuery("");
    setIsLoading(true);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userMsg, session_id: currentSession }),
      });
      const data = await res.json();

      setMessages([
        ...newMessages,
        { role: "ai", content: data.answer || data.error },
      ]);
    } catch (error) {
      setMessages([
        ...newMessages,
        { role: "ai", content: "Error connecting to BrainVault backend." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const createNewChat = () => {
    const newId = `session_${Date.now()}`;
    setSessions([...sessions, { id: newId, name: `New Chat Session` }]);
    setCurrentSession(newId);
    setMessages([]);
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
          Recent Chats
        </p>

        <div className="flex-1 space-y-1 overflow-y-auto">
          {sessions.map((sess) => (
            <button
              key={sess.id}
              onClick={() => setCurrentSession(sess.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                currentSession === sess.id
                  ? "bg-[#1e2333] text-white font-medium"
                  : "text-gray-400 hover:text-gray-200 hover:bg-[#151923]"
              }`}
            >
              <MessageSquare className="w-4 h-4 text-purple-400" />
              <span className="truncate">{sess.name}</span>
            </button>
          ))}
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
                className={`flex items-start gap-4 max-w-3xl mx-auto w-full ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "ai" && (
                  <div className="bg-[#8b5cf6] p-2 rounded-xl text-white mt-1">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`p-4 rounded-2xl text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-[#2563eb] text-white rounded-br-xs"
                      : "bg-[#1b212f] border border-gray-800 text-gray-200 rounded-bl-xs w-full"
                  }`}
                >
                  {msg.content}
                </div>

                {msg.role === "user" && (
                  <div className="bg-gray-700 p-2 rounded-xl text-white mt-1">
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
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder="Ask anything across your stored vault..."
              className="flex-1 bg-transparent px-4 py-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none"
            />
            <button
              onClick={handleSendMessage}
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
