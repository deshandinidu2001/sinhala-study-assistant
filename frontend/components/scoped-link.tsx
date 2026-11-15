"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ComponentProps } from "react";
export default function ScopedLink(props: ComponentProps<typeof Link>) {
  const params = useParams<{ workspaceId?: string }>();
  let href = props.href;
  if (params?.workspaceId && typeof href === "string" && !href.startsWith("/workspaces")) {
    const url = new URL(href,"http://local");
    const match = url.pathname.match(/^\/documents\/([^/]+)$/);
    const tool = match ? "reader" : ({"/documents":"documents","/chat":"chat","/summaries":"summaries","/practice":"practice","/audio-review":"audio-review"} as Record<string,string>)[url.pathname];
    if(tool) { if(match)url.searchParams.set("document",match[1]); if(tool !== "chat")url.searchParams.set("tool",tool); href=`/workspaces/${params.workspaceId}?${url.searchParams}${url.hash}`; }
  }
  return <Link {...props} href={href}/>;
}
