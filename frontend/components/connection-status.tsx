"use client";

import { useLanguage } from "@/lib/language";
import { useEffect, useState } from "react";
import { getHealth } from "@/lib/api";

export function ConnectionStatus() {
  const { t } = useLanguage();
  const [status, setStatus] = useState<"checking" | "online" | "offline">("checking");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => { controller.abort(); }, 8000);
    setStatus("checking");
    getHealth(controller.signal)
      .then(() => { if (active) setStatus("online"); })
      .catch(() => { if (active) setStatus("offline"); })
      .finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [attempt]);

  const label = { checking: "සම්බන්ධ වෙමින්", online: "සේවාව සූදානම්", offline: "සම්බන්ධතාව නැත" }[status];
  return (
    <div className="connection" data-status={status}>
      <div role="status"><span className="status-dot" />{t(label, { checking: "Connecting", online: "Ready", offline: "Offline" }[status])}</div>
      {status === "offline" && <button onClick={() => setAttempt((value) => value + 1)}>{t("නැවත උත්සාහ කරන්න")}</button>}
    </div>
  );
}
