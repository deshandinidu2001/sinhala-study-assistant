"use client";
import Link from "next/link";

import { useLanguage } from "@/lib/language";

export default function NotFound() {
  const { t } = useLanguage();
  return <div className="message-page"><h1>{t("මෙම පිටුව හමු නොවීය", "Page not found")}</h1><p>{t("මුල් පිටුවට ගොස් නැවත උත්සාහ කරන්න.", "Return to your study desk.")}</p><Link className="primary-button" href="/">{t("මුල් පිටුවට යන්න", "Study desk")}</Link></div>;
}
