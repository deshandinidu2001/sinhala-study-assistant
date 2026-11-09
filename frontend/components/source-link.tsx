import Link from "next/link";
import type { Source } from "@/lib/api";
import { Icon } from "@/components/icon";
export function SourceLink({ source, index }: { source: Source; index?: number }) {
  return <Link className="source-link" href={`/documents/${source.document_id}?page=${source.page}`}><Icon name="source" size={16} /><span>{index !== undefined && `[${index + 1}] `}{source.title} · {source.section ? "කොටස" : "පිටුව"} {source.page}</span></Link>;
}
