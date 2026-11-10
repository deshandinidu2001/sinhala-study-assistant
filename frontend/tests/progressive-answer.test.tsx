import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { answerLines, ProgressiveAnswer } from "@/components/progressive-answer";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  vi.stubGlobal("requestAnimationFrame", (callback: () => void) => { callback(); return 1; });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

const text = "Plants use light to produce food through photosynthesis. ".repeat(9);
describe("line by line answers", () => {
  it("reveals new answers gradually and supports showing everything immediately", () => {
    const complete = vi.fn();
    const { container } = render(<ProgressiveAnswer text={text} animate onComplete={complete} />);
    expect(container.querySelectorAll(".answer-line")).toHaveLength(0);
    act(() => vi.advanceTimersByTime(500));
    const count = container.querySelectorAll(".answer-line").length;
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(answerLines(text).length);
    fireEvent.click(screen.getByRole("button", { name: "සම්පූර්ණ පිළිතුර බලන්න" }));
    expect(container.querySelectorAll(".answer-line")).toHaveLength(answerLines(text).length);
    act(() => vi.advanceTimersByTime(2000));
    expect(container.querySelectorAll(".answer-line")).toHaveLength(answerLines(text).length);
    expect(complete).toHaveBeenCalledTimes(1);
  });
  it("shows saved answers and reduced-motion answers without delay", () => {
    const { container, unmount } = render(<ProgressiveAnswer text={text} />);
    expect(container.querySelectorAll(".answer-line")).toHaveLength(answerLines(text).length);
    unmount();
    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    const next = render(<ProgressiveAnswer text={text} animate />);
    expect(next.container.querySelectorAll(".answer-line")).toHaveLength(answerLines(text).length);
  });
  it("preserves list and paragraph boundaries", () => {
    expect(answerLines("First point\nSecond point\n\nRevision")).toEqual(["First point", "Second point", "", "Revision"]);
  });
  it("keeps Sinhala combining characters inside whole words", () => {
    const lines = answerLines("ප්‍රභාසංස්ලේෂණය සඳහා ශාක සූර්යාලෝකය භාවිත කරයි. ".repeat(6));
    expect(lines.filter(Boolean).join(" ")).toBe("ප්‍රභාසංස්ලේෂණය සඳහා ශාක සූර්යාලෝකය භාවිත කරයි. ".repeat(6).trim());
  });
});
