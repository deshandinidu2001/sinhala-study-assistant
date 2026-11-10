"use client";
import { useLanguage } from "@/lib/language";
import Link from "next/link";
import type { Source } from "@/lib/api";
import { Icon } from "@/components/icon";
export function SourceLink({ source, index }: { source: Source; index?: number }) {
  const { t } = useLanguage();
  return <Link className="source-link" href={`/documents/${source.document_id}?page=${source.page}`}><Icon name="source" size={16} /><span>{index !== undefined && `[${index + 1}] `}{source.title} · {source.section ? t("කොටස") : t("පිටුව")} {source.page}</span></Link>;
}
