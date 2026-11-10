"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { translate } from "@/lib/translations";

export type Language = "si" | "en";
const LanguageContext = createContext({ language: "si" as Language, setLanguage: (_value: Language) => {}, t: (text: string, english?: string) => text || english || "" });

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, updateLanguage] = useState<Language>("si");
  useEffect(() => {
    try { const saved = localStorage.getItem("akura-language"); if (saved === "en" || saved === "si") updateLanguage(saved); } catch { /* Storage may be disabled. */ }
  }, []);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  function setLanguage(value: Language) {
    updateLanguage(value);
    try { localStorage.setItem("akura-language", value); } catch { /* The in-memory preference still works. */ }
  }
  return <LanguageContext.Provider value={{ language, setLanguage, t: (text, english) => language === "en" ? english ?? translate(text) : text }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() { return useContext(LanguageContext); }
