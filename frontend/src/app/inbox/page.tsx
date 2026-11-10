"use client";
import { useState } from "react";
import {
  Upload,
  Globe,
  Image as ImageIcon,
  CheckCircle2,
  Loader2,
} from "lucide-react";

export default function AddResource() {
  const [status, setStatus] = useState("Ready for ingestion...");
  const [isLoading, setIsLoading] = useState(false);
  const [resourceInfo, setResourceInfo] = useState<any>(null);

  // URL Input State
  const [url, setUrl] = useState("");

  // 1. PDF or Image Handler
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "pdf" | "image",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setResourceInfo(null);
    setStatus(
      type === "image"
        ? "Vision AI analyzing image..."
        : "Uploading and processing PDF...",
    );

    const endpoint =
      type === "image"
        ? "http://127.0.0.1:8000/api/resources/image"
        : "http://127.0.0.1:8000/api/resources/upload";

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(endpoint, { method: "POST", body: formData });
      const data = await res.json();

      if (data.error) {
        setStatus(`Error: ${data.error}`);
      } else {
        setStatus("Successfully ingested and embedded into BrainVault!");
        setResourceInfo({
          title: file.name,
          category: data.category || data.verified_category,
          tags: data.tags || [],
        });
      }
    } catch (err) {
      setStatus("Connection error during upload.");
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Web URL Handler
  const handleUrlSubmit = async () => {
    if (!url.trim()) return;

    setIsLoading(true);
    setResourceInfo(null);
    setStatus("Scraping webpage and indexing content...");

    try {
      const res = await fetch("http://127.0.0.1:8000/api/resources/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();

      if (data.error) {
        setStatus(`Error: ${data.error}`);
      } else {
        setStatus("Web article scraped & embedded successfully!");
        setResourceInfo({
          title: data.title,
          category: data.category,
          tags: data.tags || [],
        });
        setUrl("");
      }
    } catch (err) {
      setStatus("Failed to connect to backend.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-10 max-w-5xl mx-auto text-gray-100">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold mb-2">Add New Resource</h1>
        <p className="text-gray-400 text-sm">
          Ingest documents, web articles, or visual diagrams into your Second
          Brain.
        </p>
      </header>

      {/* Grid of Ingestion Options */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* PDF Box */}
        <div className="bg-[#1b212f] border border-gray-800 rounded-2xl p-6 flex flex-col justify-between relative hover:border-purple-500/50 transition-colors">
          <div>
            <div className="bg-[#2a2b4a] p-3 rounded-xl w-fit mb-4">
              <Upload className="text-[#a78bfa] w-6 h-6" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-1">
              Upload PDF
            </h2>
            <p className="text-gray-400 text-xs mb-6">
              Deep OCR and hybrid text extraction for documents.
            </p>
          </div>
          <div className="relative">
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => handleFileUpload(e, "pdf")}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <button className="w-full bg-[#8b5cf6] hover:bg-[#7c3aed] text-white py-2 rounded-xl text-sm font-medium transition-colors">
              Select PDF
            </button>
          </div>
        </div>

        {/* Image / Diagram Box */}
        <div className="bg-[#1b212f] border border-gray-800 rounded-2xl p-6 flex flex-col justify-between relative hover:border-purple-500/50 transition-colors">
          <div>
            <div className="bg-[#1e3445] p-3 rounded-xl w-fit mb-4">
              <ImageIcon className="text-[#38bdf8] w-6 h-6" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-1">
              Visual & Images
            </h2>
            <p className="text-gray-400 text-xs mb-6">
              Extract text from diagrams, screenshots, or notes.
            </p>
          </div>
          <div className="relative">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleFileUpload(e, "image")}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <button className="w-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white py-2 rounded-xl text-sm font-medium transition-colors">
              Select Image
            </button>
          </div>
        </div>

        {/* Web Link Box */}
        <div className="bg-[#1b212f] border border-gray-800 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="bg-[#42203e] p-3 rounded-xl w-fit mb-4">
              <Globe className="text-[#f472b6] w-6 h-6" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-1">
              Web Article URL
            </h2>
            <p className="text-gray-400 text-xs mb-4">
              Scrape and index live web pages automatically.
            </p>
          </div>
          <div className="space-y-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full bg-[#0f111a] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8b5cf6]"
            />
            <button
              onClick={handleUrlSubmit}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-xl text-sm font-medium transition-colors"
            >
              Scrape & Save
            </button>
          </div>
        </div>
      </div>

      {/* Status & Feedback Card */}
      <div className="bg-[#1b212f] border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center gap-3">
          {isLoading ? (
            <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          )}
          <div>
            <p className="text-xs text-gray-400 font-medium">Status Log</p>
            <p className="text-sm font-semibold text-white">{status}</p>
          </div>
        </div>

        {resourceInfo && (
          <div className="mt-4 pt-4 border-t border-gray-800 text-sm space-y-1">
            <p>
              <strong>Title:</strong> {resourceInfo.title}
            </p>
            <p>
              <strong>Assigned Category:</strong>{" "}
              <span className="text-purple-400">{resourceInfo.category}</span>
            </p>
            {resourceInfo.tags?.length > 0 && (
              <p>
                <strong>Tags:</strong> {resourceInfo.tags.join(", ")}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
