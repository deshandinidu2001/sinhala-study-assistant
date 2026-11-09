"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, type StudyDocument } from "@/lib/api";

export function useDocuments() {
  const [documents, setDocuments] = useState<StudyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const mounted = useRef(true);
  const refresh = useCallback(async () => {
    try {
      const data = await api<StudyDocument[]>("/documents");
      if (mounted.current) { setDocuments(data); setError(""); }
    } catch (failure) {
      if (mounted.current) setError(failure instanceof Error ? failure.message : "ලේඛන ලබාගත නොහැක.");
    } finally { if (mounted.current) setLoading(false); }
  }, []);
  useEffect(() => { mounted.current = true; void refresh(); return () => { mounted.current = false; }; }, [refresh]);
  useEffect(() => {
    if (!documents.some(d => d.status === "pending" || d.status === "processing")) return;
    const timer = setInterval(() => void refresh(), 2000);
    return () => clearInterval(timer);
  }, [documents, refresh]);
  return { documents, loading, error, refresh };
}
