"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/language";
import { useDocuments } from "@/lib/use-documents";
import { ConnectionStatus } from "@/components/connection-status";
import { Icon } from "@/components/icon";
import { WorkspaceNav } from "@/components/workspace-nav";

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const { language, setLanguage, t } = useLanguage();
  const pathname = usePathname();
  const { documents } = useDocuments();
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => { try { setCollapsed(localStorage.getItem("akura-sidebar") === "collapsed"); } catch {} }, []);
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [open]);
  const title = pathname === "/" ? t("අධ්‍යයන මේසය", "Study desk") : pathname.startsWith("/documents") ? t("ලේඛන", "Sources") : pathname.startsWith("/practice") ? t("පුහුණුව", "Practice") : t("සංවාදය", "Ask your notes");
  function toggleSidebar() {
    setCollapsed(value => { try { localStorage.setItem("akura-sidebar", value ? "expanded" : "collapsed"); } catch {} return !value; });
  }
  return <div className={`workspace${collapsed ? " sidebar-collapsed" : ""}`}>
    <a className="skip-link" href="#main">{t("ප්‍රධාන අන්තර්ගතයට යන්න", "Skip to content")}</a>
    {open && <button className="sidebar-backdrop" aria-label={t("මෙනුව වසන්න", "Close menu")} onClick={() => setOpen(false)} />}
    <aside id="workspace-sidebar" className={`sidebar${open ? " sidebar-open" : ""}`} aria-label={t("අධ්‍යයන අවකාශය", "Study workspace")}>
      <div className="brand-row"><Link className="brand" href="/" aria-label={t("අකුර මුල් පිටුව", "Akura home")}><span className="brand-symbol">අ</span><strong>{t("අකුර", "Akura")}<span className="brand-period">.</span></strong></Link><button className="icon-button collapse-button" onClick={toggleSidebar} aria-label={collapsed ? t("පැති තීරුව විවෘත කරන්න", "Expand sidebar") : t("පැති තීරුව හකුළන්න", "Collapse sidebar")}><Icon name="panel" size={19} /></button><button className="icon-button mobile-close" onClick={() => setOpen(false)} aria-label={t("මෙනුව වසන්න", "Close menu")}><Icon name="close" size={20} /></button></div>
      <Link href="/documents#upload" className="sidebar-add" aria-label={t("ලේඛනයක් එක් කරන්න")}><Icon name="plus" size={19} /><span>{t("ලේඛනයක් එක් කරන්න")}</span></Link>
      <WorkspaceNav />
      <div className="sidebar-sources"><div className="sidebar-section-label"><span>{t("මගේ ලේඛන", "My sources")}</span><span>{documents.length}</span></div>
        {documents.slice(0, 8).map(document => <Link key={document.id} href={document.status === "ready" ? `/documents/${document.id}` : "/documents"} className={`sidebar-source${pathname.endsWith(document.id) ? " selected" : ""}`} title={document.title}><Icon name="document" size={17} /><span>{document.title}</span><i data-status={document.status} /></Link>)}
        {!documents.length && <p className="sidebar-empty">{t("සටහනකින් පටන් ගන්න", "Start with a note")}</p>}
      </div>
      <div className="sidebar-bottom"><ConnectionStatus /><span className="local-label">{t("දේශීය අවකාශය", "Local workspace")}</span></div>
    </aside>
    <div className="main-column"><header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu" aria-label={t("මෙනුව විවෘත කරන්න", "Open menu")} aria-expanded={open} aria-controls="workspace-sidebar" onClick={() => setOpen(value => !value)}><Icon name="menu" size={21} /></button><span className="topbar-brand">{t("අකුර", "Akura")}</span><span className="breadcrumb-slash">/</span><span>{title}</span></div><div className="topbar-right"><label className="language-switch"><span aria-hidden="true">අ / A</span><select aria-label="Interface language" value={language} onChange={e => setLanguage(e.target.value as "si" | "en")}><option value="si">සිංහල</option><option value="en">English</option></select></label></div></header><main id="main" tabIndex={-1}>{children}</main></div>
  </div>;
}
