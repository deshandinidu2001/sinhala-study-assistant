"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/lib/language";
import { ConnectionStatus } from "@/components/connection-status";

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const { language, setLanguage, t } = useLanguage();
  const pathname = usePathname();
  return <div className="notebook-app">
    <a className="skip-link" href="#main">{t("ප්‍රධාන අන්තර්ගතයට යන්න", "Skip to content")}</a>
    <header className="notebook-topbar"><Link className="brand" href="/" aria-label={t("අකුර මුල් පිටුව", "Akura home")}><span className="brand-symbol">අ</span><strong>{t("අකුර", "Akura")}.</strong></Link>
      <div className="notebook-status"><ConnectionStatus/><select aria-label={t("අතුරුමුහුණත් භාෂාව", "Interface language")} value={language} onChange={e => setLanguage(e.target.value as "si" | "en")}><option value="si">සිංහල</option><option value="en">English</option></select></div>
    </header>
    <main id="main" tabIndex={-1} key={pathname}>{children}</main>
  </div>;
}
