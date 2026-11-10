"use client";
import { useState, useEffect } from "react";
import { Folder, FileText, CheckCircle2, Clock, Search } from "lucide-react";

export default function Library() {
  const [libraryFiles, setLibraryFiles] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);

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
                {/* Status Badge */}
                <div className="absolute top-4 right-4">
                  {file.status === "processed" ? (
                    <span className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 text-[10px] font-semibold rounded-md">
                      <CheckCircle2 className="w-3 h-3" /> Embedded
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-1 text-[10px] font-semibold rounded-md">
                      <Clock className="w-3 h-3" /> Pending AI
                    </span>
                  )}
                </div>

                <div>
                  <div className="bg-[#1b212f] p-2.5 rounded-lg w-fit mb-3">
                    <FileText className="w-5 h-5 text-purple-400" />
                  </div>

                  <h3
                    className="font-semibold text-base text-white mb-1 pr-16 truncate"
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
