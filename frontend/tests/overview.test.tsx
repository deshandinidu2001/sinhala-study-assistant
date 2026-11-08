import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StudyOverview } from "@/components/study-overview";

vi.mock("framer-motion", () => ({
  useReducedMotion: () => true,
  motion: { section: ({ children, initial: _initial, animate: _animate, transition: _transition, ...props }: React.ComponentProps<"section"> & { initial?: unknown; animate?: unknown; transition?: unknown }) => <section {...props}>{children}</section> },
}));

describe("Sinhala study overview", () => {
  it("offers readable Sinhala headings and a real in-page learning guide", () => {
    render(<StudyOverview />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("අද අපි මොනවද ඉගෙන ගන්නේ?");
    const guide = screen.getByRole("link", { name: "ඉගෙන ගන්නා ආකාරය" });
    expect(guide).toHaveAttribute("href", "#study-method");
    expect(document.querySelector(guide.getAttribute("href")!)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "ඔබේ ලේඛන එකතුව" })).toBeInTheDocument();
  });
});
