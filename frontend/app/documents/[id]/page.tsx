import { Suspense } from "react";
import { DocumentReader } from "@/components/document-reader";
export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Suspense fallback={<p className="overview">ලේඛනය ලබාගනිමින්…</p>}><DocumentReader id={id} /></Suspense>;
}
