import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
// import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "BrainVault AI",
  description: "Your Personal Second Brain",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="flex h-screen bg-[#151923] text-gray-100 font-sans overflow-hidden">
        {/* Left Sidebar stays fixed */}
        <Sidebar />

        {/* Main page content area */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </body>
    </html>
  );
}
