"use client";
import { useState, useEffect, useRef } from "react";
import {
  Folder,
  FileText,
  CheckCircle2,
  Clock,
  Search,
  Trash2,
  Loader2,
  X,
  ChevronDown,
  Check,
  Plus,
  Tag,
} from "lucide-react";

interface CategoryTag {
  id: number;
  name: string;
}

interface LibraryResource {
  id: number;
  title: string;
  source_type: string;
  status: string;
  categories: CategoryTag[];
  category: string;
  sub_category?: string;
}

export default function Library() {
  const [libraryFiles, setLibraryFiles] = useState<LibraryResource[]>([]);
  const [allCategories, setAllCategories] = useState<CategoryTag[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Delete state
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Multi-select Category Dropdown state
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [savingResourceId, setSavingResourceId] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchLibraryAndCategories = async () => {
    try {
      const [resFiles, resCats] = await Promise.all([
        fetch("http://127.0.0.1:8000/api/resources"),
        fetch("http://127.0.0.1:8000/api/categories"),
      ]);
      const filesData = await resFiles.json();
      const catsData = await resCats.json();

      setLibraryFiles(filesData.resources || []);
      const validCats = (catsData.categories || [])
        .filter((c: any) => c.id !== 0)
        .map((c: any) => ({ id: c.id, name: c.name }));
      setAllCategories(validCats);
    } catch (error) {
      console.error("Failed to fetch library or categories:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLibraryAndCategories();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpenDropdownId(null);
        setNewCategoryInput("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggleCategory = async (
    resource: LibraryResource,
    categoryId: number,
  ) => {
    const currentIds = resource.categories.map((c) => c.id);
    const updatedIds = currentIds.includes(categoryId)
      ? currentIds.filter((id) => id !== categoryId)
      : [...currentIds, categoryId];

    setSavingResourceId(resource.id);
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/resources/${resource.id}/categories`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category_ids: updatedIds }),
        },
      );
      const data = await res.json();

      if (res.ok) {
        setLibraryFiles((prev) =>
          prev.map((item) =>
            item.id === resource.id
              ? {
                  ...item,
                  categories: data.categories,
                  category: data.categories[0]?.name || "Uncategorized",
                }
              : item,
          ),
        );
      }
    } catch (error) {
      console.error("Failed to update resource categories:", error);
    } finally {
      setSavingResourceId(null);
    }
  };

  const handleCreateAndAssignCategory = async (
    e: React.FormEvent,
    resource: LibraryResource,
  ) => {
    e.preventDefault();
    if (!newCategoryInput.trim()) return;

    const currentIds = resource.categories.map((c) => c.id);
    setSavingResourceId(resource.id);

    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/resources/${resource.id}/categories`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category_ids: currentIds,
            new_category_name: newCategoryInput.trim(),
          }),
        },
      );
      const data = await res.json();

      if (res.ok) {
        setNewCategoryInput("");
        await fetchLibraryAndCategories();
      }
    } catch (error) {
      console.error("Failed to create and assign category:", error);
    } finally {
      setSavingResourceId(null);
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/resources/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete resource");

      setLibraryFiles((prev) => prev.filter((file) => file.id !== id));
      setConfirmDeleteId(null);
    } catch (error) {
      console.error("Error deleting resource:", error);
      alert("Failed to delete resource. Check that your backend is running.");
    } finally {
      setDeletingId(null);
    }
  };

  // Search across title OR any assigned category name
  const filteredFiles = libraryFiles.filter((file) => {
    const q = searchTerm.toLowerCase();
    const matchesTitle = file.title.toLowerCase().includes(q);
    const matchesAnyCategory =
      file.categories?.some((c) => c.name.toLowerCase().includes(q)) ||
      file.category.toLowerCase().includes(q);
    return matchesTitle || matchesAnyCategory;
  });

  return (
    <div className="p-10 max-w-6xl mx-auto text-gray-100">
      {/* Header & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-semibold mb-1 text-white">
            Knowledge Library
          </h1>
          <p className="text-gray-400 text-sm">
            Manage your embedded resources and assign them to multiple related
            categories.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by title or category..."
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
              Head over to the Add Resource page to upload your first item.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredFiles.map((file) => {
              const assignedIds = new Set(
                file.categories?.map((c) => c.id) || [],
              );
              const isDropdownOpen = openDropdownId === file.id;

              return (
                <div
                  key={file.id}
                  className="bg-[#0f111a] border border-gray-800 rounded-xl p-5 hover:border-purple-500/40 transition-all flex flex-col justify-between relative"
                >
                  <div>
                    {/* Top Row: Icon + Status + Delete */}
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

                    {/* Title */}
                    <h3
                      className="font-semibold text-base text-white mb-3 truncate"
                      title={file.title}
                    >
                      {file.title}
                    </h3>

                    {/* Multi-Category Badges */}
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {file.categories && file.categories.length > 0 ? (
                        file.categories.map((cat) => (
                          <span
                            key={cat.id}
                            className="inline-flex items-center gap-1 text-xs font-medium text-purple-300 bg-purple-500/15 border border-purple-500/25 px-2.5 py-0.5 rounded-md"
                          >
                            {cat.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs font-medium text-gray-400 bg-gray-800/80 px-2.5 py-0.5 rounded-md">
                          Uncategorized
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Multi-Select Category Dropdown Control */}
                  <div
                    className="relative pt-3 border-t border-gray-800/80"
                    ref={isDropdownOpen ? dropdownRef : null}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setOpenDropdownId(isDropdownOpen ? null : file.id);
                        setNewCategoryInput("");
                      }}
                      className="w-full flex items-center justify-between bg-[#1b212f] hover:bg-[#232a3c] border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-300 transition-colors"
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <Tag className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        {savingResourceId === file.id
                          ? "Updating categories..."
                          : `Select categories (${file.categories?.length || 0})`}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-gray-400 transition-transform ${
                          isDropdownOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {/* Popover Multi-Select Menu */}
                    {isDropdownOpen && (
                      <div className="absolute left-0 right-0 bottom-12 bg-[#1b212f] border border-gray-700 rounded-xl shadow-2xl z-30 p-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-2 py-1">
                          Assign Categories
                        </p>

                        <div className="max-h-40 overflow-y-auto space-y-0.5 my-1">
                          {allCategories.length === 0 ? (
                            <p className="text-xs text-gray-500 px-2 py-2">
                              No categories yet. Add one below.
                            </p>
                          ) : (
                            allCategories.map((cat) => {
                              const isChecked = assignedIds.has(cat.id);
                              return (
                                <button
                                  key={cat.id}
                                  type="button"
                                  onClick={() =>
                                    handleToggleCategory(file, cat.id)
                                  }
                                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                                    isChecked
                                      ? "bg-purple-500/20 text-white font-medium"
                                      : "text-gray-300 hover:bg-[#0f111a]"
                                  }`}
                                >
                                  <span className="truncate">{cat.name}</span>
                                  <span
                                    className={`w-4 h-4 rounded flex items-center justify-center border ${
                                      isChecked
                                        ? "bg-[#8b5cf6] border-[#8b5cf6] text-white"
                                        : "border-gray-600"
                                    }`}
                                  >
                                    {isChecked && <Check className="w-3 h-3" />}
                                  </span>
                                </button>
                              );
                            })
                          )}
                        </div>

                        {/* Quick Create & Assign Input */}
                        <form
                          onSubmit={(e) =>
                            handleCreateAndAssignCategory(e, file)
                          }
                          className="pt-2 mt-1 border-t border-gray-800 flex items-center gap-1.5"
                        >
                          <input
                            type="text"
                            value={newCategoryInput}
                            onChange={(e) =>
                              setNewCategoryInput(e.target.value)
                            }
                            placeholder="New category..."
                            className="flex-1 bg-[#0f111a] border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#8b5cf6]"
                          />
                          <button
                            type="submit"
                            disabled={
                              !newCategoryInput.trim() ||
                              savingResourceId === file.id
                            }
                            className="bg-[#8b5cf6] hover:bg-[#7c3aed] disabled:opacity-40 text-white p-1.5 rounded-lg transition-colors"
                            title="Create and assign"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
