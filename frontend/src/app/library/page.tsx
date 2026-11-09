"use client";
import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";

export default function Library() {
  const [libraryFiles, setLibraryFiles] = useState<any[]>([]);

  useEffect(() => {
    const fetchLibrary = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/api/resources");
        const data = await res.json();
        setLibraryFiles(data.resources);
      } catch (error) {
        console.error("Failed to fetch library", error);
      }
    };
    fetchLibrary();
  }, []);

  return (
    <main className="p-8">
      <div className="max-w-6xl mx-auto">
        {/* Library Grid */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-2xl font-semibold mb-6">Your Saved Resources</h2>

          {libraryFiles.length === 0 ? (
            <p className="text-gray-500 text-center py-10">
              No files in your library yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {libraryFiles.map((file) => (
                <div
                  key={file.id}
                  className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow relative"
                >
                  <span
                    className={`absolute top-4 right-4 px-2 py-1 text-xs font-bold rounded ${file.status === "processed" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}
                  >
                    {file.status === "processed" ? "Embedded" : "Pending AI"}
                  </span>

                  <h3
                    className="font-semibold text-lg text-gray-800 mb-1 pr-16 truncate"
                    title={file.title}
                  >
                    {file.title}
                  </h3>
                  <p className="text-sm font-medium text-blue-600 mb-3">
                    {file.category}
                  </p>

                  {file.sub_category && (
                    <p className="text-xs text-gray-500 line-clamp-2">
                      {file.sub_category}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
