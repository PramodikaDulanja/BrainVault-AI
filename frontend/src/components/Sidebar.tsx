"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Zap,
  Plus,
  LayoutDashboard,
  Folder,
  Inbox,
  MessageSquare,
  Network,
  Image as ImageIcon,
} from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    {
      name: "Dashboard",
      href: "/",
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      name: "Knowledge Assistant",
      href: "/chat",
      icon: <MessageSquare className="w-5 h-5" />,
    },

    { name: "Library", href: "/library", icon: <Folder className="w-5 h-5" /> },

    {
      name: "Smart Inbox",
      href: "/inbox",
      icon: <Inbox className="w-5 h-5" />,
      badge: 7,
    },
    {
      name: "Categories",
      href: "/graph",
      icon: <Network className="w-5 h-5" />,
    },
  ];

  return (
    <aside className="w-64 bg-[#0f111a] border-r border-gray-800 h-screen flex flex-col text-gray-300">
      {/* Logo */}
      <div className="p-6 flex items-center gap-3">
        <div className="bg-[#3b82f6] p-2 rounded-lg">
          <Zap className="text-white w-5 h-5" fill="currentColor" />
        </div>
        <span className="text-xl font-bold text-white tracking-wide">
          BrainVault <span className="text-purple-400">AI</span>
        </span>
      </div>

      {/* Add Resource Button */}
      <div className="px-4 mb-6">
        <Link href="/inbox">
          <button className="w-full bg-[#8b5cf6] hover:bg-[#7c3aed] text-white flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium transition-colors shadow-lg shadow-purple-500/20">
            <Plus className="w-5 h-5" /> Add resource
          </button>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${
                isActive
                  ? "bg-[#1e2333] text-white font-medium"
                  : "text-gray-400 hover:text-gray-200 hover:bg-[#151923]"
              }`}
            >
              <div className="flex items-center gap-3">
                {item.icon}
                <span className="text-sm">{item.name}</span>
              </div>
              {item.badge && (
                <span className="bg-[#eab308] text-[#0f111a] text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
