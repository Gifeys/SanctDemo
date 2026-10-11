import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import HistoryQuiz from "./HistoryQuiz";
import { quizFor } from "../lib/historyQuiz";

/** Opens the quiz, which is closed until asked for. */
function start() {
  fireEvent.click(screen.getByText(/start the quiz/i));
}

/** Clicks the right answer to every question. */
function answerAll(routeId: string, correctly: boolean) {
  const quiz = quizFor(routeId)!;
  const blocks = document.querySelectorAll(".history-quiz__q");
  blocks.forEach((block, i) => {
    const options = block.querySelectorAll("button");
    const pick = correctly ? quiz[i].correct : (quiz[i].correct + 1) % 4;
    fireEvent.click(options[pick]);
  });
}

describe("HistoryQuiz", () => {
  it("renders nothing for a parish whose history is not written up", () => {
    // Twenty-nine of the thirty-one. A heading with no questions under
    // it would be worse than no section at all.
    const { container } = render(<HistoryQuiz routeId="parish-holy-trinity" />);
    expect(container.innerHTML).toBe("");
  });

  it("is closed until the reader asks for it", () => {
    // Five questions printed open made the page end in a test rather
    // than in its history.
    render(<HistoryQuiz routeId="route-mhcp" />);
    expect(document.querySelectorAll(".history-quiz__q")).toHaveLength(0);
    expect(screen.getByText(/start the quiz/i)).toBeTruthy();
  });

  it("asks five questions with four answers each", () => {
    render(<HistoryQuiz routeId="route-mhcp" />);
    start();
    expect(document.querySelectorAll(".history-quiz__q")).toHaveLength(5);
    const first = document.querySelector(".history-quiz__q")!;
    expect(within(first as HTMLElement).getAllByRole("radio")).toHaveLength(4);
  });

  it("refuses an unanswered submission and names what is missing", () => {
    // "Answer all five" leaves the reader hunting for the one they
    // skipped, so the questions are named.
    render(<HistoryQuiz routeId="route-mhcp" />);
    start();
    fireEvent.click(screen.getByText(/submit quiz/i));
    expect(screen.getByRole("alert").textContent).toMatch(/1, 2, 3, 4, 5/);
    expect(document.querySelector(".history-quiz__score")).toBeNull();
  });

  it("stops naming a question once it has been answered", () => {
    render(<HistoryQuiz routeId="route-mhcp" />);
    start();
    fireEvent.click(screen.getByText(/submit quiz/i));
    const first = document.querySelector(".history-quiz__q")!;
    fireEvent.click(first.querySelectorAll("button")[0]);
    fireEvent.click(screen.getByText(/submit quiz/i));
    expect(screen.getByRole("alert").textContent).toMatch(/2, 3, 4, 5/);
  });

  it("scores a completed quiz", () => {
    render(<HistoryQuiz routeId="route-mhcp" />);
    start();
    answerAll("route-mhcp", true);
    fireEvent.click(screen.getByText(/submit quiz/i));
    expect(screen.getByText("5 out of 5")).toBeTruthy();
  });

  it("marks the right answer even where it was not the one chosen", () => {
    // Showing only the reader's mistake teaches nothing.
    render(<HistoryQuiz routeId="route-mhcp" />);
    start();
    answerAll("route-mhcp", false);
    fireEvent.click(screen.getByText(/submit quiz/i));
    expect(screen.getByText("0 out of 5")).toBeTruthy();
    expect(document.querySelectorAll(".history-quiz__option.is-answer")).toHaveLength(5);
    expect(document.querySelectorAll(".history-quiz__explain")).toHaveLength(5);
  });

  it("lets the reader start again", () => {
    render(<HistoryQuiz routeId="route-mhcp" />);
    start();
    answerAll("route-mhcp", true);
    fireEvent.click(screen.getByText(/submit quiz/i));
    fireEvent.click(screen.getByText(/try again/i));
    expect(document.querySelector(".history-quiz__score")).toBeNull();
    expect(document.querySelectorAll(".history-quiz__option.is-picked")).toHaveLength(0);
    // Still open: asking to try again and being handed the button
    // again would be a tap for nothing.
    expect(document.querySelectorAll(".history-quiz__q")).toHaveLength(5);
  });

  it("asks San Roque's questions at San Roque", () => {
    render(<HistoryQuiz routeId="route-src" />);
    start();
    expect(screen.getByText(/originally founded as a parish/i)).toBeTruthy();
  });
});
