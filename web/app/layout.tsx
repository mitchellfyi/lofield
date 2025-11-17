import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lofield FM – Background noise for people just trying to make it through the day",
  description: "Your co-working companion. 24/7 AI-generated lofi music and chat from the fictional town of Lofield.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="flex min-h-screen flex-col">
          <header className="border-b bg-card px-4 py-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Lofield FM
              </h1>
              <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                Background noise for people just trying to make it through the day
              </p>
            </div>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="border-t bg-card px-4 py-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl text-center text-sm text-muted-foreground">
              <p>Now playing on a frequency that probably doesn&apos;t exist.</p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
