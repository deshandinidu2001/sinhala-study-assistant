"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icon";

const items: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "දළ විශ්ලේෂණය", icon: "home" },
  { href: "/documents", label: "මගේ ලේඛන", icon: "book" },
  { href: "/chat", label: "ප්‍රශ්න හා පිළිතුරු", icon: "chat" },
  { href: "/practice", label: "ප්‍රශ්න පුහුණුව", icon: "quiz" },
];
export function WorkspaceNav() {
  const pathname = usePathname();
  return <nav aria-label="ප්‍රධාන මෙනුව">{items.map(item => {
    const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
    return <Link key={item.href} href={item.href} className={`nav-item${active ? " active" : ""}`} aria-current={active ? "page" : undefined}><Icon name={item.icon} />{item.label}</Link>;
  })}</nav>;
}
