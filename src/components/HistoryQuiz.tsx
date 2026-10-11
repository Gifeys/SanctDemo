import { useMemo, useState } from "react";
import { Check, RefreshCw, X } from "lucide-react";
import { gradeQuiz, quizFor, unanswered, type QuizItem } from "../lib/historyQuiz";

/**
 * Five questions at the foot of a parish's history.
 *
 * ## Why it is at the very bottom
 *
 * The history is the point of the page and the quiz is a way of
 * looking back at it. Put between the prose and the stations it would
 * interrupt the reading to test it, which is the wrong way round: a
 * visitor should meet the questions having already read the answers.
 *
 * ## Why nothing is scored until Submit
 *
 * Marking each answer as it is chosen turns five questions into five
 * verdicts, and somebody who gets the first wrong stops. One submission
 * gives a score and then the explanations, which is where the teaching
 * is - the explanation says what the history page said, so a wrong
 * answer sends the reader back up the page rather than away.
 *
 * ## Where there is no quiz
 *
 * Only two parishes have a written history. For the rest this renders
 * nothing at all - no heading, no empty panel. Questions invented to
 * fill the space would be the one thing this app refuses everywhere.
 */
export default function HistoryQuiz({ routeId }: { routeId: string }) {
  const quiz = useMemo(() => quizFor(routeId), [routeId]);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [missing, setMissing] = useState<number[]>([]);

  if (!quiz) return null;

  const result = submitted ? gradeQuiz(quiz, answers) : null;

  function choose(qIndex: number, option: number) {
    if (submitted) return;
    setAnswers(prev => {
      const next = [...prev];
      next[qIndex] = option;
      return next;
    });
    // Clear the "you missed these" note as soon as it stops being true.
    setMissing(prev => prev.filter(n => n !== qIndex + 1));
  }

  function submit() {
    const blank = unanswered(answers, quiz!.length);
    if (blank.length > 0) {
      // Named, not just counted. "Answer all five" leaves the reader
      // hunting for which one they skipped.
      setMissing(blank);
      return;
    }
    setMissing([]);
    setSubmitted(true);
  }

  function tryAgain() {
    setAnswers([]);
    setSubmitted(false);
    setMissing([]);
  }

  return (
    <section className="history-quiz" aria-labelledby="history-quiz-title">
      <h2 id="history-quiz-title" className="history-quiz__title">
        Test Sancti Knowledge
      </h2>
      <p className="history-quiz__lede">
        Five questions about this parish. Every answer is somewhere on
        this page.
      </p>

      {quiz.map((item, qi) => (
        <Question
          key={item.question}
          item={item}
          index={qi}
          chosen={answers[qi] ?? null}
          correct={result ? result.marks[qi] : null}
          revealed={submitted}
          flagged={missing.includes(qi + 1)}
          onChoose={option => choose(qi, option)}
        />
      ))}

      {!submitted && (
        <>
          {missing.length > 0 && (
            <p role="alert" className="history-quiz__missing">
              {missing.length === 1
                ? `Question ${missing[0]} has not been answered yet.`
                : `Questions ${missing.join(", ")} have not been answered yet.`}
            </p>
          )}
          <button type="button" onClick={submit} className="history-quiz__submit">
            Submit quiz
          </button>
        </>
      )}

      {submitted && result && (
        <div className="history-quiz__result" role="status">
          <p className="history-quiz__score">
            {result.score} out of {result.total}
          </p>
          <p className="history-quiz__verdict">
            {result.score === result.total
              ? "Every one correct. You read it well."
              : result.score === 0
                ? "The answers are all on this page — the explanations say where."
                : "The explanations above say where each answer came from."}
          </p>
          <button type="button" onClick={tryAgain} className="history-quiz__again">
            <RefreshCw className="w-4 h-4" aria-hidden /> Try again
          </button>
        </div>
      )}
    </section>
  );
}

function Question({
  item, index, chosen, correct, revealed, flagged, onChoose,
}: {
  item: QuizItem;
  index: number;
  chosen: number | null;
  correct: boolean | null;
  revealed: boolean;
  flagged: boolean;
  onChoose: (option: number) => void;
}) {
  return (
    <div className={`history-quiz__q${flagged ? " is-flagged" : ""}`}>
      <p className="history-quiz__question">
        <span className="history-quiz__number">{index + 1}.</span> {item.question}
      </p>

      <div role="radiogroup" aria-label={item.question} className="history-quiz__options">
        {item.options.map((option, oi) => {
          const picked = chosen === oi;
          const isAnswer = revealed && oi === item.correct;
          const isWrongPick = revealed && picked && oi !== item.correct;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={picked}
              disabled={revealed}
              onClick={() => onChoose(oi)}
              className={`history-quiz__option${picked ? " is-picked" : ""}${
                isAnswer ? " is-answer" : ""}${isWrongPick ? " is-wrong" : ""}`}
            >
              <span className="history-quiz__mark" aria-hidden>
                {isAnswer ? <Check className="w-4 h-4" />
                  : isWrongPick ? <X className="w-4 h-4" /> : null}
              </span>
              <span>{option}</span>
            </button>
          );
        })}
      </div>

      {revealed && (
        <p className={`history-quiz__explain${correct ? " is-right" : ""}`}>
          {item.explanation}
        </p>
      )}
    </div>
  );
}
