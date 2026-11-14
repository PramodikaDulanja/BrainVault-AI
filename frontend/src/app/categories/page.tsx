"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Folder,
  Plus,
  Search,
  FileText,
  Globe,
  Image as ImageIcon,
  Trash2,
  X,
  CheckCircle2,
  Clock,
  Sparkles,
  Layers,
} from "lucide-react";

interface CategoryResource {
  id: number;
  title: string;
  source_type: string;
  status: string;
}

interface CategoryItem {
  id: number;
  name: string;
  description: string;
  resource_count: number;
  breakdown: {
    pdf: number;
    url: number;
    image: number;
  };
  resources: CategoryResource[];
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CategoryItem | null>(
    null,
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Create Category Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [createError, setCreateError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Delete Confirmation State
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const fetchCategories = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/categories");
      const data = await res.json();
      const loaded: CategoryItem[] = data.categories || [];
      setCategories(loaded);

      if (loaded.length > 0 && !selectedCategory) {
        setSelectedCategory(loaded[0]);
      } else if (selectedCategory) {
        const updatedSelected =
          loaded.find((c) => c.id === selectedCategory.id) || loaded[0] || null;
        setSelectedCategory(updatedSelected);
      }
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setIsCreating(true);
    setCreateError("");

    try {
      const res = await fetch("http://127.0.0.1:8000/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, description: newDescription }),
      });
      const data = await res.json();

      if (!res.ok) {
        setCreateError(data.detail || "Could not create category.");
        return;
      }

      setNewName("");
      setNewDescription("");
      setIsModalOpen(false);
      await fetchCategories();
    } catch (error) {
      setCreateError("Failed to connect to backend.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteCategory = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/categories/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setConfirmDeleteId(null);
        if (selectedCategory?.id === id) {
          setSelectedCategory(null);
        }
        await fetchCategories();
      }
    } catch (error) {
      console.error("Failed to delete category:", error);
    }
  };

  const filteredCategories = categories.filter(
    (cat) =>
      cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cat.description.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const getSourceIcon = (type: string) => {
    if (type === "url")
      return <Globe className="w-4 h-4 text-pink-400 shrink-0" />;
    if (type === "image")
      return <ImageIcon className="w-4 h-4 text-sky-400 shrink-0" />;
    return <FileText className="w-4 h-4 text-purple-400 shrink-0" />;
  };

  return (
    <div className="p-10 max-w-6xl mx-auto text-gray-100">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-semibold mb-1 text-white">
            Knowledge Categories
          </h1>
          <p className="text-gray-400 text-sm">
            Explore AI-organized topics, inspect grouped resources, or create
            custom collections.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search Input */}
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter categories..."
              className="w-full bg-[#1b212f] border border-gray-800 rounded-xl py-2 pl-9 pr-4 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#8b5cf6] transition-colors"
            />
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-[#8b5cf6] hover:bg-[#7c3aed] text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors shrink-0 shadow-lg shadow-purple-500/20"
          >
            <Plus className="w-4 h-4" /> New Category
          </button>
        </div>
      </div>

      {/* Category Cards Grid */}
      {isLoading ? (
        <div className="bg-[#1b212f] border border-gray-800 rounded-2xl p-16 text-center text-gray-500 animate-pulse">
          Loading categories from your vault...
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="bg-[#1b212f] border border-gray-800 rounded-2xl p-16 text-center space-y-3">
          <Folder className="w-12 h-12 text-gray-600 mx-auto" />
          <p className="text-gray-300 font-medium">No categories found.</p>
          <p className="text-xs text-gray-500">
            Upload resources in Smart Inbox to auto-generate topics, or create
            one manually.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {filteredCategories.map((cat) => {
            const isSelected = selectedCategory?.id === cat.id;
            return (
              <div
                key={cat.id}
                onClick={() => setSelectedCategory(cat)}
                className={`bg-[#1b212f] border rounded-2xl p-6 cursor-pointer transition-all flex flex-col justify-between ${
                  isSelected
                    ? "border-[#8b5cf6] ring-1 ring-[#8b5cf6]/40 shadow-lg shadow-purple-500/10"
                    : "border-gray-800 hover:border-gray-700"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <div className="bg-[#2a2b4a] p-2.5 rounded-xl">
                      <Folder className="w-5 h-5 text-[#a78bfa]" />
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="bg-[#0f111a] border border-gray-800 text-gray-300 text-xs font-semibold px-2.5 py-1 rounded-lg">
                        {cat.resource_count}{" "}
                        {cat.resource_count === 1 ? "item" : "items"}
                      </span>

                      {cat.id !== 0 && (
                        <>
                          {confirmDeleteId === cat.id ? (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1 bg-red-500/10 border border-red-500/30 rounded-md px-1.5 py-0.5"
                            >
                              <button
                                onClick={(e) => handleDeleteCategory(e, cat.id)}
                                className="text-[10px] font-bold text-red-400 hover:text-red-300 px-1"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="text-gray-400 hover:text-white p-0.5"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteId(cat.id);
                              }}
                              className="p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              title="Delete category"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <h2 className="text-lg font-semibold text-white mb-1">
                    {cat.name}
                  </h2>
                  <p className="text-xs text-gray-400 line-clamp-2 mb-5">
                    {cat.description}
                  </p>
                </div>

                {/* Source Type Breakdown Pills */}
                <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-gray-800/80 text-[11px] text-gray-400">
                  <span className="flex items-center gap-1 bg-[#0f111a] px-2 py-1 rounded-md">
                    <FileText className="w-3 h-3 text-purple-400" />{" "}
                    {cat.breakdown.pdf} PDF
                  </span>
                  <span className="flex items-center gap-1 bg-[#0f111a] px-2 py-1 rounded-md">
                    <Globe className="w-3 h-3 text-pink-400" />{" "}
                    {cat.breakdown.url} Links
                  </span>
                  <span className="flex items-center gap-1 bg-[#0f111a] px-2 py-1 rounded-md">
                    <ImageIcon className="w-3 h-3 text-sky-400" />{" "}
                    {cat.breakdown.image} Images
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected Category Inspector Panel */}
      {selectedCategory && (
        <div className="bg-[#1b212f] border border-gray-800 rounded-2xl p-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 mb-5 border-b border-gray-800">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Layers className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">
                  Category Contents
                </span>
              </div>
              <h3 className="text-xl font-semibold text-white">
                {selectedCategory.name}
              </h3>
            </div>

            <Link
              href={`/chat?q=${encodeURIComponent(
                `Summarize all the key insights from my ${selectedCategory.name} resources.`,
              )}`}
            >
              <button className="bg-[#0f111a] hover:bg-[#242b3d] border border-purple-500/30 text-purple-300 px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors">
                <Sparkles className="w-4 h-4 text-purple-400" /> Ask AI About
                This Category
              </button>
            </Link>
          </div>

          {selectedCategory.resources.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              No resources assigned to this category yet.
            </p>
          ) : (
            <div className="divide-y divide-gray-800/70">
              {selectedCategory.resources.map((res) => (
                <div
                  key={res.id}
                  className="py-3.5 flex items-center justify-between gap-4 hover:bg-[#0f111a]/50 px-3 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {getSourceIcon(res.source_type)}
                    <span className="text-sm text-gray-200 truncate">
                      {res.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] uppercase text-gray-500 font-medium">
                      {res.source_type}
                    </span>
                    {res.status === "processed" ? (
                      <span className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold rounded-md">
                        <CheckCircle2 className="w-3 h-3" /> Embedded
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 text-[10px] font-semibold rounded-md">
                        <Clock className="w-3 h-3" /> Pending AI
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* New Category Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-[#1b212f] border border-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">
                Create New Category
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Category Name
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., System Architecture, Research Papers"
                  className="w-full bg-[#0f111a] border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#8b5cf6]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Description (Optional)
                </label>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Short summary of what belongs in this category..."
                  className="w-full bg-[#0f111a] border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#8b5cf6]"
                />
              </div>

              {createError && (
                <p className="text-xs text-red-400">{createError}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="bg-[#8b5cf6] hover:bg-[#7c3aed] disabled:opacity-50 text-white px-5 py-2 rounded-xl text-sm font-medium transition-colors"
                >
                  {isCreating ? "Creating..." : "Create Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
