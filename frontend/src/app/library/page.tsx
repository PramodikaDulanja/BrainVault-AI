"use client";
import { useState, useEffect } from "react";
import {
  Folder,
  FileText,
  CheckCircle2,
  Clock,
  Search,
  Trash2,
  Loader2,
  X,
} from "lucide-react";

export default function Library() {
  const [libraryFiles, setLibraryFiles] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    const fetchLibrary = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/api/resources");
        const data = await res.json();
        setLibraryFiles(data.resources || []);
      } catch (error) {
        console.error("Failed to fetch library", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLibrary();
  }, []);

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/resources/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete resource");
      }

      // Immediately remove the deleted item from UI state
      setLibraryFiles((prev) => prev.filter((file) => file.id !== id));
      setConfirmDeleteId(null);
    } catch (error) {
      console.error("Error deleting resource:", error);
      alert("Failed to delete resource. Check that your backend is running.");
    } finally {
      setDeletingId(null);
    }
  };

  // Filter files based on search input
  const filteredFiles = libraryFiles.filter(
    (file) =>
      file.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      file.category.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="p-10 max-w-6xl mx-auto text-gray-100">
      {/* Header & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-semibold mb-1 text-white">
            Knowledge Library
          </h1>
          <p className="text-gray-400 text-sm">
            Manage and review all your embedded documents, links, and assets.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search library..."
            className="w-full bg-[#1b212f] border border-gray-800 rounded-xl py-2 pl-9 pr-4 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#8b5cf6] transition-colors"
          />
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-[#1b212f] border border-gray-800 rounded-2xl p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
          <Folder className="w-5 h-5 text-purple-400" /> Stored Resources (
          {filteredFiles.length})
        </h2>

        {isLoading ? (
          <p className="text-center text-gray-500 py-16 animate-pulse">
            Loading your vault library...
          </p>
        ) : filteredFiles.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <FileText className="w-12 h-12 text-gray-600 mx-auto" />
            <p className="text-gray-400 font-medium">
              No resources found in your library yet.
            </p>
            <p className="text-xs text-gray-500">
              Head over to the Smart Inbox / Add Resource page to upload your
              first item.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredFiles.map((file) => (
              <div
                key={file.id}
                className="bg-[#0f111a] border border-gray-800 rounded-xl p-5 hover:border-purple-500/40 transition-all flex flex-col justify-between relative group"
              >
                {/* Top Row: File Icon + Status & Delete Controls */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="bg-[#1b212f] p-2.5 rounded-lg w-fit">
                      <FileText className="w-5 h-5 text-purple-400" />
                    </div>

                    <div className="flex items-center gap-2">
                      {file.status === "processed" ? (
                        <span className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 text-[10px] font-semibold rounded-md">
                          <CheckCircle2 className="w-3 h-3" /> Embedded
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-1 text-[10px] font-semibold rounded-md">
                          <Clock className="w-3 h-3" /> Pending AI
                        </span>
                      )}

                      {/* Two-Step Delete Action */}
                      {confirmDeleteId === file.id ? (
                        <div className="flex items-center gap-1 bg-red-500/10 border border-red-500/30 rounded-md px-1.5 py-0.5">
                          <button
                            onClick={() => handleDelete(file.id)}
                            disabled={deletingId === file.id}
                            className="text-[10px] font-bold text-red-400 hover:text-red-300 px-1 flex items-center gap-1"
                          >
                            {deletingId === file.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              "Confirm"
                            )}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            disabled={deletingId === file.id}
                            className="text-gray-400 hover:text-white p-0.5"
                            title="Cancel"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(file.id)}
                          className="p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Delete resource"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <h3
                    className="font-semibold text-base text-white mb-1 truncate"
                    title={file.title}
                  >
                    {file.title}
                  </h3>

                  <p className="text-xs font-medium text-purple-400 mb-3 bg-purple-500/10 px-2 py-0.5 rounded w-fit">
                    {file.category}
                  </p>
                </div>

                {file.sub_category && (
                  <p className="text-xs text-gray-400 line-clamp-2 mt-2 pt-2 border-t border-gray-800/80">
                    {file.sub_category}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
