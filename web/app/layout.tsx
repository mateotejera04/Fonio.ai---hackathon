import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { AppSidebar } from "@/components/shell/app-sidebar"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export const metadata: Metadata = {
  title: "The Patient · Appointment Management",
  description: "Dental clinic appointment management — slots filled before they go cold.",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistSans.className} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-svh bg-background text-foreground">
        <div className="flex min-h-svh">
          <AppSidebar />
          <div className="flex min-w-0 flex-1 flex-col">{children}</div>
        </div>
      </body>
    </html>
  )
}
