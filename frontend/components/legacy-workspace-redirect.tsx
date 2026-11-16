"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { api, type StudyDocument } from "@/lib/api";
import { useLanguage } from "@/lib/language";
export function LegacyWorkspaceRedirect() {
  const router=useRouter();const path=usePathname();const params=useSearchParams(); const {t}=useLanguage();const [error,setError]=useState("");
  useEffect(()=>{const controller=new AbortController();const match=path.match(/^\/documents\/([^/]+)$/);const documentId=match?.[1] ?? params.get("document");
    const resolve=async()=>{const owner=documentId ? (await api<StudyDocument>(`/documents/${documentId}`,{signal:controller.signal})).workspace_id : (await api<{id:string}[]>("/workspaces",{signal:controller.signal})).find(w=>w.id === "00000000-0000-0000-0000-000000000001")?.id;
      if(!owner)throw Error("Workspace not found"); const query=new URLSearchParams(params); const tool=match ? "reader" : path.slice(1);if(tool !== "chat")query.set("tool",tool);if(documentId)query.set("document",documentId);if(!controller.signal.aborted)router.replace(`/workspaces/${owner}?${query}`);};
    void resolve().catch(e=>{if(!controller.signal.aborted)setError(e.message)});return()=>controller.abort();},[path,params,router]);
  return <div className="workspace-home"><p role={error?"alert":"status"}>{error ? t(error) : t("අවකාශය විවෘත කරමින්…","Opening workspace…")}</p>{error && <a href="/">{t("සියලු අවකාශ","All workspaces")}</a>}</div>;
}
