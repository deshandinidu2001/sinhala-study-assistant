import type { CSSProperties } from "react";

export type IconName = "book" | "home" | "document" | "chat" | "quiz" | "arrow" | "check" | "source" | "leaf" | "menu" | "close" | "plus" | "panel" | "search" | "mic" | "settings";

const paths: Record<IconName, React.ReactNode> = {
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  panel: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M9 4v16m6-11-3 3 3 3" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  mic: <><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8" /></>,
  settings: <><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="3" fill="currentColor" /><circle cx="15" cy="17" r="3" fill="currentColor" /></>,
  book: <><path d="M12 6.5C9 4.5 5.5 4 3 5v14c3-1 6-.5 9 1.5 3-2 6-2.5 9-1.5V5c-2.5-1-6-.5-9 1.5Z" /><path d="M12 6.5v14" /></>,
  home: <><path d="m3 10 9-7 9 7v10H3Z" /><path d="M9 20v-7h6v7" /></>,
  document: <><path d="M14 3H5v18h14V8Z" /><path d="M14 3v5h5M8 12h8M8 16h5" /></>,
  chat: <><path d="M21 11a8 8 0 0 1-8 8H8l-5 3V11a9 9 0 0 1 18 0Z" /><path d="M7 10h10M7 14h6" /></>,
  quiz: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V2h6v2M9 10l1 1 2-2M14 10h2M9 16l1 1 2-2M14 16h2" /></>,
  arrow: <><path d="M4 12h16m-6-6 6 6-6 6" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  source: <><path d="M9 4H4v16h16v-5M14 3h7v7M21 3l-9 9" /><path d="M8 12v4h4" /></>,
  leaf: <><path d="M20 3C9 2 3 7 5 14c2 7 15 4 15-11Z" /><path d="M4 21 16 8" /></>,
};

export function Icon({ name, size = 22, style }: { name: IconName; size?: number; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}>{paths[name]}</svg>;
}
