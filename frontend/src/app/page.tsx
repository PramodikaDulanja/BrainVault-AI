"use client";
import { Layers, Folder, Database, Send, Zap } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const [query, setQuery] = useState("");
  const [stats, setStats] = useState({
    resources: 0,
    categories: 0,
    chunks: 0,
  });
  const router = useRouter();

  // Fetch real stats on load
  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/stats")
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch((err) => console.error("Failed to fetch stats", err));
  }, []);

  const handleSearch = () => {
    if (!query.trim()) return;
    // Route to the chat page and pass the question in the URL
    router.push(`/chat?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="p-10 max-w-6xl mx-auto">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold text-white mb-2">
          Welcome to BrainVault
        </h1>
        <p className="text-gray-400 text-sm">
          Your vault holds {stats.resources} resources across {stats.categories}{" "}
          categories
        </p>
      </header>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-[#1b212f] border border-gray-800 rounded-2xl p-6 flex items-start gap-4">
          <div className="bg-[#2a2b4a] p-3 rounded-xl mt-1">
            <Layers className="text-[#a78bfa] w-6 h-6" />
          </div>
          <div>
            <p className="text-gray-400 text-sm font-medium mb-1">Resources</p>
            <h2 className="text-3xl font-bold text-white mb-1">
              {stats.resources}
            </h2>
            <p className="text-[#34d399] text-xs font-medium">
              Tracking all files
            </p>
          </div>
        </div>

        <div className="bg-[#1b212f] border border-gray-800 rounded-2xl p-6 flex items-start gap-4">
          <div className="bg-[#1e3445] p-3 rounded-xl mt-1">
            <Folder className="text-[#38bdf8] w-6 h-6" />
          </div>
          <div>
            <p className="text-gray-400 text-sm font-medium mb-1">Categories</p>
            <h2 className="text-3xl font-bold text-white mb-1">
              {stats.categories}
            </h2>
            <p className="text-gray-500 text-xs font-medium">AI auto-created</p>
          </div>
        </div>

        <div className="bg-[#1b212f] border border-gray-800 rounded-2xl p-6 flex items-start gap-4">
          <div className="bg-[#42203e] p-3 rounded-xl mt-1">
            <Database className="text-[#f472b6] w-6 h-6" />
          </div>
          <div>
            <p className="text-gray-400 text-sm font-medium mb-1">
              Chunks indexed
            </p>
            <h2 className="text-3xl font-bold text-white mb-1">
              {stats.chunks}
            </h2>
            <p className="text-[#34d399] text-xs font-medium">
              Vector DB healthy
            </p>
          </div>
        </div>
      </div>

      {/* Ask Your Brain Section */}
      <div className="bg-[#1b212f] border border-gray-800 rounded-2xl p-8">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <Zap className="text-[#a78bfa] w-5 h-5" />
            <h2 className="text-lg font-semibold text-white">Ask your brain</h2>
          </div>
        </div>

        <div className="relative mb-6">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Ask anything across everything you've saved..."
            className="w-full bg-[#0f111a] border border-[#2d2354] rounded-xl py-4 pl-6 pr-16 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#8b5cf6] transition-colors"
          />
          <button
            onClick={handleSearch}
            className="absolute right-3 top-2.5 bg-[#8b5cf6] hover:bg-[#7c3aed] p-2 rounded-lg text-white transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
