"use client";
import { useLanguage } from "@/lib/language";
import Link from "next/link";
import { ConnectionStatus } from "@/components/connection-status";
import { Icon } from "@/components/icon";
import { WorkspaceNav } from "@/components/workspace-nav";

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const { language, setLanguage, t } = useLanguage();
  return (
    <div className="workspace">
      <a className="skip-link" href="#main">{t("ප්‍රධාන අන්තර්ගතයට යන්න", "Skip to content")}</a>
      <aside className="sidebar" aria-label="අධ්‍යයන අවකාශය">
        <Link className="brand" href="/" aria-label="අකුර මුල් පිටුව">
          <span className="brand-symbol">අ</span>
          <span><strong>අකුර</strong><small>ඔබේ අධ්‍යයන සහායක</small></span>
        </Link>
        <p className="nav-caption">{t("මගේ අවකාශය", "Workspace")}</p>
        <WorkspaceNav />
        <div className="sidebar-note">
          <Icon name="leaf" size={24} />
          <p>පුංචි පියවරක්.<br /><strong>අලුත් දැනුමක්.</strong></p>
          <span>සෑම පාඩමක්ම ඔබේම වේගයෙන්.</span>
        </div>
        <ConnectionStatus />
      </aside>
      <div className="main-column">
        <header className="topbar">
          <span>{t("ඉගෙනීමට ඔබේම තැනක්", "Your study workspace")}</span>
          <select aria-label="Interface language" value={language} onChange={e => setLanguage(e.target.value as "si" | "en")}><option value="si">සිංහල</option><option value="en">English</option></select>
        </header>
        <main id="main" tabIndex={-1}>{children}</main>
        <footer className="footer"><span>අකුර</span><p>ඔබේ ලේඛන ඇසුරින්. ඔබේ දැනුම වෙනුවෙන්.</p></footer>
      </div>
    </div>
  );
}
