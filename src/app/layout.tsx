import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Control de Asistencia NOM-037",
  description: "Sistema de control de asistencia laboral multi-sucursal conforme a la NOM-037-STPS-2023.",
  keywords: ["asistencia", "control", "registro", "nom-037", "horas extra", "nómina"],
  authors: [{ name: "Control de Asistencia" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>
          {children}
        </Providers>
        <SonnerToaster richColors position="top-right" />
        <Toaster />
      </body>
    </html>
  );
}
