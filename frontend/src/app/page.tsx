"use client";
import { useState } from "react";

export default function Home() {
  // Inbox State
  const [status, setStatus] = useState("Waiting for file...");
  const [resourceId, setResourceId] = useState<number | null>(null);
  const [categoryInfo, setCategoryInfo] = useState<any>(null);

  // Chat State
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<{ role: string; content: string }[]>(
    [],
  );
  const [isChatLoading, setIsChatLoading] = useState(false);

  // 1. FAST UPLOAD TIER
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus("Uploading and analyzing (Fast Step)...");
    setCategoryInfo(null);
    setResourceId(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/resources/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      setResourceId(data.resource_id);
      setStatus(`Fast upload complete! Status: ${data.status}`);
      setCategoryInfo({ category: data.category, tags: [] });
    } catch (error) {
      setStatus("Error uploading file.");
      console.error(error);
    }
  };

  // 2. DEEP PROCESSING TIER
  const triggerDeepProcessing = async () => {
    if (!resourceId) return;
    setStatus("Running deep OCR and AI verification (this takes a minute)...");

    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/resources/${resourceId}/process`,
        {
          method: "POST",
        },
      );
      const data = await res.json();

      setStatus("Processing complete & saved to Qdrant!");
      setCategoryInfo({
        category: data.verified_category,
        subCategory: data.sub_category,
        tags: data.tags || [],
      });
    } catch (error) {
      setStatus("Error during deep processing.");
      console.error(error);
    }
  };

  // 3. AI CHAT LOGIC
  const handleSendMessage = async () => {
    if (!query.trim()) return;

    const newMessages = [...messages, { role: "user", content: query }];
    setMessages(newMessages);
    setQuery("");
    setIsChatLoading(true);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query, session_id: "default_session" }),
      });
      const data = await res.json();

      setMessages([
        ...newMessages,
        { role: "ai", content: data.answer || data.error },
      ]);
    } catch (error) {
      setMessages([
        ...newMessages,
        { role: "ai", content: "Error connecting to AI." },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-8 text-gray-900">
      <div className="max-w-6xl mx-auto">
        <header className="mb-10">
          <h1 className="text-4xl font-bold text-blue-600">BrainVault AI</h1>
          <p className="text-gray-500 mt-2">
            Your Personal Second Brain & Smart Inbox
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Smart Inbox Upload */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-full">
            <h2 className="text-2xl font-semibold mb-4">Smart Inbox</h2>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-10 text-center relative hover:bg-gray-50 transition-colors">
              <p className="text-gray-500 mb-4">Select a PDF to upload</p>
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <button className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg font-medium">
                Browse Files
              </button>
            </div>

            <div className="mt-6 bg-gray-50 p-4 rounded-lg border border-gray-200 flex-1">
              <p className="font-medium text-sm text-gray-500 mb-2">
                System Status:
              </p>
              <p className="text-blue-700 font-semibold mb-4">{status}</p>

              {categoryInfo && (
                <div className="bg-white p-3 rounded border border-gray-200 text-sm">
                  <p>
                    <strong>Category:</strong> {categoryInfo.category}
                  </p>
                  {categoryInfo.subCategory && (
                    <p>
                      <strong>Sub-Category:</strong> {categoryInfo.subCategory}
                    </p>
                  )}
                  {categoryInfo.tags?.length > 0 && (
                    <p className="mt-1">
                      <strong>Tags:</strong>{" "}
                      <span className="text-blue-600">
                        {categoryInfo.tags.join(", ")}
                      </span>
                    </p>
                  )}
                </div>
              )}

              {resourceId && (
                <button
                  onClick={triggerDeepProcessing}
                  className="mt-4 w-full px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
                >
                  Verify & Embed into BrainVault
                </button>
              )}
            </div>
          </div>

          {/* Right Column: AI Chat Interface */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-[600px]">
            <h2 className="text-2xl font-semibold mb-4">Knowledge Assistant</h2>

            {/* Chat Messages Area */}
            <div className="flex-1 bg-gray-50 rounded-lg p-4 mb-4 overflow-y-auto border border-gray-100 flex flex-col gap-3">
              {messages.length === 0 ? (
                <p className="text-center text-gray-400 text-sm mt-20">
                  Ask a question to search your vault...
                </p>
              ) : (
                messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg max-w-[85%] text-sm ${msg.role === "user" ? "bg-blue-600 text-white self-end" : "bg-white border border-gray-200 text-gray-800 self-start"}`}
                  >
                    {msg.content}
                  </div>
                ))
              )}
              {isChatLoading && (
                <div className="bg-white border border-gray-200 text-gray-500 p-3 rounded-lg max-w-[85%] self-start animate-pulse text-sm">
                  Searching BrainVault...
                </div>
              )}
            </div>

            {/* Chat Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                placeholder="Ask about your documents..."
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <button
                onClick={handleSendMessage}
                disabled={isChatLoading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-blue-300"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
