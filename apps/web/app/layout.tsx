import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { QueryProvider } from "@/providers/query-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Task & Time Tracker",
  description: "Capture tasks, track focused work, and understand your daily productivity.",
};

export const viewport: Viewport = {
  themeColor: "#110e0c",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <QueryProvider>{children}</QueryProvider>
        {/* Success confirmations; errors are shown inline next to the action. */}
        <Toaster
          position="bottom-right"
          theme="dark"
          closeButton
          toastOptions={{
            style: {
              background: "var(--popover)",
              border: "1px solid oklch(1 0 0 / 0.09)",
              color: "var(--popover-foreground)",
              borderRadius: "14px",
              boxShadow: "0 20px 40px -20px oklch(0 0 0 / 0.8)",
            },
          }}
        />
      </body>
    </html>
  );
}
