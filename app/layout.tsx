import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import { StoreProvider } from "@/lib/store";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bond Insurance CRM",
  description: "Bond Insurance Operations Management",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full`}>
      <body className="h-full flex bg-stone-50 text-gray-900 antialiased">
        <StoreProvider>
          <Sidebar />
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>
        </StoreProvider>
      </body>
    </html>
  );
}
