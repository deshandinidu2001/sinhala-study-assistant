"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useLanguage } from "@/lib/language";
import { WorkspaceForm, type Workspace } from "@/components/workspace-home";
import { WorkspaceSources } from "@/components/workspace-sources";
import { DocumentsLibrary } from "@/components/documents-library";
import { DocumentReader } from "@/components/document-reader";
import { ChatWorkspace } from "@/components/chat-workspace";
import { Icon } from "@/components/icon";

export function StudyWorkspace() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  return <WorkspaceContent key={workspaceId} id={workspaceId}/>;
}
function WorkspaceContent({ id }: { id: string }) {
  const { t } = useLanguage(); const params = useSearchParams();
  const [workspace, setWorkspace] = useState<Workspace | null>(null); const [error, setError] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const tool = params.get("tool");
  const [editing, setEditing] = useState(false); const [tab, setTab] = useState("chat");
  const [sourcesOpen, setSourcesOpen] = useState(true); const [studioOpen, setStudioOpen] = useState(true);
  useEffect(() => { const controller = new AbortController(); api<Workspace>(`/workspaces/${id}`, { signal: controller.signal }).then(setWorkspace).catch(e => { if (!controller.signal.aborted) setError(e.message); }); return () => controller.abort(); }, [id]);
  if (error) return <div className="workspace-home"><p role="alert">{t(error)}</p><Link href="/">{t("සියලු අවකාශ", "All workspaces")}</Link></div>;
  if (!workspace) return <p className="workspace-home" role="status">{t("පූරණය වෙමින්…", "Loading workspace…")}</p>;
  return <div className={`study-workspace tab-${tab}${sourcesOpen ? "" : " sources-collapsed"}${studioOpen ? "" : " studio-collapsed"}`}>
    <div className="study-heading"><Link href="/">{t("සියලු අවකාශ", "All workspaces")}</Link><h1>{workspace.name}</h1><button className="text-button" onClick={() => setEditing(!editing)}>{t("නම වෙනස් කරන්න", "Rename")}</button><div className="panel-toggles"><button className="secondary-button" aria-pressed={sourcesOpen} onClick={() => setSourcesOpen(!sourcesOpen)}>{t("මූලාශ්‍ර", "Sources")}</button><button className="secondary-button" aria-pressed={studioOpen} onClick={() => setStudioOpen(!studioOpen)}>Studio</button></div></div>
    {editing && <WorkspaceForm initial={workspace} onCancel={() => setEditing(false)} onSaved={w => { setWorkspace(w); setEditing(false); }}/ >}
    <nav className="workspace-mobile-tabs" aria-label={t("අවකාශයේ කොටස්", "Workspace panels")}>{[["sources",t("මූලාශ්‍ර","Sources")],["chat",t("සංවාදය","Chat")],["studio","Studio"]].map(([value,label]) => <button key={value} aria-pressed={tab === value} onClick={() => setTab(value)}>{label}</button>)}</nav>
    {tool && <section className="workspace-tool-view"><Link className="secondary-button" href={`/workspaces/${id}`}>{t("සංවාදයට ආපසු", "Back to chat")}</Link>{tool === "documents" && <DocumentsLibrary/>}{tool === "reader" && params.get("document") && <DocumentReader id={params.get("document")!}/>}</section>}
    <div className="study-columns" hidden={!!tool}>
      <aside className="workspace-sources"><WorkspaceSources id={id} selected={selected} onSelect={setSelected}/></aside>
      <section className="workspace-conversation" aria-label={t("සංවාදය", "Chat")}><ChatWorkspace key={id} selectedSources={selected}/></section>
      <aside className="workspace-studio"><h2>Studio</h2><p>{t("සටහන් සමඟ නැවත පාඩම් කරන්න.", "Make more of your notes.")}</p>{[["summaries","summary",t("සාරාංශ කරන්න","Summarize")],["practice","quiz",t("ප්‍රශ්න පුහුණුව","Quiz")],["audio-review","headphones",t("හඬ සමාලෝචනය","Audio Overview")]].map(([route, icon, label]) => <Link className="studio-tool" key={route} href={`/workspaces/${id}?tool=${route}`}><Icon name={icon as "summary"}/><span>{label}</span><Icon name="arrow" size={16}/></Link>)}</aside>
    </div>
  </div>;
}
