"use client";
import { useLanguage } from "@/lib/language";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icon";

const items: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "අධ්‍යයන මේසය", icon: "home" },
  { href: "/documents", label: "මගේ ලේඛන", icon: "book" },
  { href: "/chat", label: "සංවාදය", icon: "chat" },
  { href: "/practice", label: "පුහුණුව", icon: "quiz" },
];
export function WorkspaceNav() {
  const { t } = useLanguage();
  const pathname = usePathname();
  return <nav aria-label={t("ප්‍රධාන මෙනුව", "Main navigation")}>{items.map(item => {
    const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
    return <Link key={item.href} href={item.href} className={`nav-item${active ? " active" : ""}`} aria-label={t(item.label, ({ "/": "Study desk", "/documents": "Sources", "/chat": "Ask your notes", "/practice": "Practice" })[item.href])} title={t(item.label, ({ "/": "Study desk", "/documents": "Sources", "/chat": "Ask your notes", "/practice": "Practice" })[item.href])} aria-current={active ? "page" : undefined}><Icon name={item.icon} /><span>{t(item.label, ({ "/": "Study desk", "/documents": "Sources", "/chat": "Ask your notes", "/practice": "Practice" })[item.href])}</span></Link>;
  })}</nav>;
}
