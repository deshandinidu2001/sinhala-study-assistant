import type { Metadata } from "next";
import "@fontsource-variable/noto-sans-sinhala";
import "./globals.css";
import { WorkspaceShell } from "@/components/workspace-shell";

export const metadata: Metadata = {
  title: "අකුර | සිංහල අධ්‍යයන සහායක",
  description: "ඔබේ සිංහල සටහන් සහ ප්‍රශ්න පත්‍ර ඇසුරින් මූලාශ්‍ර සහිතව ඉගෙන ගන්න.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="si"><body><WorkspaceShell>{children}</WorkspaceShell></body></html>;
}
