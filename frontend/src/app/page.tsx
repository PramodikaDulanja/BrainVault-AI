"use client";
import { useState } from "react";

export default function Home() {
  const [status, setStatus] = useState("Waiting for file or link...");
  const [resourceId, setResourceId] = useState<number | null>(null);
  const [categoryInfo, setCategoryInfo] = useState<any>(null);

  // New URL State
  const [url, setUrl] = useState("");

  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<{ role: string; content: string }[]>(
    [],
  );
  const [isChatLoading, setIsChatLoading] = useState(false);

  // --- API FUNCTIONS ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus("Uploading and analyzing PDF...");
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
    }
  };

  const triggerDeepProcessing = async () => {
    if (!resourceId) return;
    setStatus("Running deep OCR and AI verification...");

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
    }
  };

  // New Link Ingestion Handler
  const handleUrlSubmit = async () => {
    if (!url.trim()) return;

    setStatus("Scraping webpage and analyzing content...");
    setCategoryInfo(null);
    setResourceId(null);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/resources/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url }),
      });
      const data = await res.json();

      if (data.error) {
        setStatus(`Error: ${data.error}`);
        return;
      }

      setStatus(`Link embedded! Title: ${data.title}`);
      setCategoryInfo({ category: data.category, tags: data.tags || [] });
      setUrl(""); // Clear input
    } catch (error) {
      setStatus("Error ingesting link.");
    }
  };

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
    <main className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Smart Inbox */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-full">
            <h2 className="text-2xl font-semibold mb-4">Smart Inbox</h2>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center relative hover:bg-gray-50 transition-colors">
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

            {/* URL Input Area */}
            <div className="flex items-center my-5">
              <div className="flex-1 border-t border-gray-200"></div>
              <span className="px-4 text-xs text-gray-400 font-medium uppercase tracking-wider">
                Or
              </span>
              <div className="flex-1 border-t border-gray-200"></div>
            </div>

            <div className="flex gap-2 mb-4">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
                placeholder="Paste an article or Wikipedia link..."
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleUrlSubmit}
                className="px-4 py-2 bg-gray-800 text-white rounded-lg font-medium text-sm hover:bg-gray-900 transition-colors"
              >
                Save Link
              </button>
            </div>

            {/* Status Panel */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex-1">
              <p className="font-medium text-sm text-gray-500 mb-2">
                System Status:
              </p>
              <p className="text-blue-700 font-semibold mb-4">{status}</p>

              {categoryInfo && (
                <div className="bg-white p-3 rounded border border-gray-200 text-sm">
                  <p>
                    <strong>Category:</strong> {categoryInfo.category}
                  </p>
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

              {resourceId && status.includes("Fast upload complete") && (
                <button
                  onClick={triggerDeepProcessing}
                  className="mt-4 w-full px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
                >
                  Verify & Embed into BrainVault
                </button>
              )}
            </div>
          </div>

          {/* AI Chat Area */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-[600px]">
            <h2 className="text-2xl font-semibold mb-4">Knowledge Assistant</h2>
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
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                placeholder="Ask about your documents or links..."
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
