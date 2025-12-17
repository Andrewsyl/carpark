import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "../components/Navbar";
import { AuthProvider } from "../components/AuthProvider";
import { AppStatusProvider } from "../components/AppStatusProvider";
import Script from "next/script";
import "react-dates/initialize";
import "react-dates/lib/css/_datepicker.css";

export const metadata: Metadata = {
  title: "ParkShare Dublin",
  description: "Peer-to-peer parking marketplace for Dublin",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-b from-white to-slate-100 text-slate-900">
        <Script
          src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`}
          strategy="beforeInteractive"
        />
        <AppStatusProvider>
          <AuthProvider>
            <Navbar />
            <main className="mx-auto max-w-8xl px-4 py-6 sm:px-6 sm:py-8 lg:px-12 lg:py-8">{children}</main>
          </AuthProvider>
        </AppStatusProvider>
      </body>
    </html>
  );
}
