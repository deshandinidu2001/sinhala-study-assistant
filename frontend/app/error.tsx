"use client";

import { useLanguage } from "@/lib/language";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useLanguage();
  return <div className="message-page"><h1>{t("පිටුව පෙන්විය නොහැක", "Unable to load this page")}</h1><p>{t("නැවත උත්සාහ කර බලන්න.", "Try loading the page again.")}</p><button className="primary-button" onClick={reset}>{t("නැවත උත්සාහ කරන්න", "Try again")}</button></div>;
}
