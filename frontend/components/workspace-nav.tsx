"use client";
import { useLanguage } from "@/lib/language";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icon";

const items: { href: string; label: string; english: string; icon: IconName }[] = [
  { href: "/", label: "අධ්‍යයන මේසය", english: "Study desk", icon: "home" },
  { href: "/documents", label: "මගේ ලේඛන", english: "Sources", icon: "book" },
  { href: "/chat", label: "සංවාදය", english: "Ask your notes", icon: "chat" },
  { href: "/summaries", label: "සාරාංශ", english: "Summaries", icon: "summary" },
  { href: "/practice", label: "පුහුණුව", english: "Practice", icon: "quiz" },
];
export function WorkspaceNav() {
  const { t } = useLanguage();
  const pathname = usePathname();
  return <nav aria-label={t("ප්‍රධාන මෙනුව", "Main navigation")}>{items.map(item => {
    const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
    return <Link key={item.href} href={item.href} className={`nav-item${active ? " active" : ""}`} aria-label={t(item.label, item.english)} title={t(item.label, item.english)} aria-current={active ? "page" : undefined}><Icon name={item.icon} /><span>{t(item.label, item.english)}</span></Link>;
  })}</nav>;
}
