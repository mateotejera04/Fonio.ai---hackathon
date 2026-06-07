import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { formatEuro, treatmentPrice } from "@/lib/waitlist";
import { getRankedWaitlist } from "@/lib/waitlist.server";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dentist 5 · Appointment Management",
  description:
    "Dental clinic appointment management — slots filled before they go cold.",
};

async function getRecoveredRevenue(): Promise<string> {
  try {
    const waitlist = await getRankedWaitlist();
    const total = waitlist
      .filter((patient) => patient.waitlist_status === "ACCEPTED")
      .reduce(
        (sum, patient) => sum + treatmentPrice(patient.desired_treatment),
        0,
      );

    return formatEuro(total);
  } catch {
    return formatEuro(0);
  }
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const recoveredRevenue = await getRecoveredRevenue();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistSans.className} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-svh bg-background text-foreground">
        <div className="flex min-h-svh">
          <AppSidebar recoveredRevenue={recoveredRevenue} />
          <div className="flex min-w-0 flex-1 flex-col">{children}</div>
        </div>
      </body>
    </html>
  );
}
