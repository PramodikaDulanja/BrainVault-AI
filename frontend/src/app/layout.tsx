import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar"; // Imports your new Navbar

export const metadata: Metadata = {
  title: "BrainVault AI",
  description: "Your Personal Second Brain & Smart Inbox",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 font-sans min-h-screen">
        {/* The global Navbar stays at the top of every page */}
        <Navbar />

        {/* The active page content renders here */}
        {children}
      </body>
    </html>
  );
}
