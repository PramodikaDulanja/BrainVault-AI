"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-8 py-4 flex justify-between items-center">
        {/* Logo Area */}
        <div>
          <h1 className="text-2xl font-bold text-blue-600 tracking-tight">
            BrainVault AI
          </h1>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Your Personal Second Brain
          </p>
        </div>

        {/* Navigation Links */}
        <div className="flex bg-gray-100 p-1 rounded-lg">
          <Link
            href="/"
            className={`px-5 py-2 rounded-md font-medium text-sm transition-all ${
              pathname === "/"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Upload & Chat
          </Link>
          <Link
            href="/library"
            className={`px-5 py-2 rounded-md font-medium text-sm transition-all ${
              pathname === "/library"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Knowledge Library
          </Link>
        </div>
      </div>
    </nav>
  );
}
