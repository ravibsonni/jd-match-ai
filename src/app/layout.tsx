import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "JD Matcher",
  description: "Job description matching and tailored application generator"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
