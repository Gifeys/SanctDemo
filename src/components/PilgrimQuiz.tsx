import React, { useState } from "react";
import { PILGRIM_QUIZ, QuizQuestion } from "../data";
import { Award, Check, X, ArrowRight, RefreshCw, Sparkles, HelpCircle, ShieldCheck } from "lucide-react";

interface PilgrimQuizProps {
  onEarnBadge: (badgeId: string) => void;
  onAddPoints: (points: number) => void;
  onAddApplication: (app: { id: string; type: string; applicant: string; details: string; date: string; status: string }) => void;
}

export default function PilgrimQuiz({ onEarnBadge, onAddPoints, onAddApplication }: PilgrimQuizProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [isQuizCompleted, setIsQuizCompleted] = useState(false);

  const activeQuestion = PILGRIM_QUIZ[currentQuestionIndex];

  const handleOptionSelect = (idx: number) => {
    if (isSubmitted) return;
    setSelectedOptionIndex(idx);
  };

  const handleSubmitAnswer = () => {
    if (selectedOptionIndex === null) return;
    
    const isCorrect = selectedOptionIndex === activeQuestion.correctAnswerIndex;
    if (isCorrect) {
      setScore((s) => s + 1);
      onAddPoints(100); // 100 points per correct answer
    }
    setIsSubmitted(true);
  };

  const handleNextQuestion = () => {
    setSelectedOptionIndex(null);
    setIsSubmitted(false);

    if (currentQuestionIndex < PILGRIM_QUIZ.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    } else {
      setIsQuizCompleted(true);
      // If perfect score, award the Faith Defender Badge
      if (score + (selectedOptionIndex === activeQuestion.correctAnswerIndex ? 1 : 0) === 5) {
        onEarnBadge("badge-4");
      }
      
      // Log quiz result to simulated database
      onAddApplication({
        id: "quiz-log-" + Date.now(),
        type: "Pilgrim Quiz Completed",
        applicant: "Public Student",
        details: `Completed Pilgrim Quiz - Final Score: ${score + (selectedOptionIndex === activeQuestion.correctAnswerIndex ? 1 : 0)}/5`,
        date: new Date().toLocaleDateString(),
        status: "Database Synced"
      });
    }
  };

  const handleResetQuiz = () => {
    setCurrentQuestionIndex(0);
    setSelectedOptionIndex(null);
    setIsSubmitted(false);
    setScore(0);
    setIsQuizCompleted(false);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#F5F5F0] overflow-y-auto">
      {/* Page Header */}
      <div className="bg-[#5A5A40] text-white p-5 pt-6 rounded-b-[2rem] shadow-sm relative overflow-hidden shrink-0 border-b border-[#D6D6C2]">
        <div className="absolute right-0 top-0 opacity-10 translate-x-4 -translate-y-4">
          <HelpCircle className="w-32 h-32 text-white" />
        </div>
        <div className="flex items-center gap-1.5 text-[#C2A649] font-bold text-xs tracking-wider uppercase font-serif italic">
          <Sparkles className="w-3.5 h-3.5" /> Interactive Catechesis
        </div>
        <div>
          <h2 className="text-2xl font-bold font-serif italic tracking-tight">
            Pilgrim History Quiz
          </h2>
          <p className="text-xs text-[#EBEBE0] opacity-95 mt-1 max-w-xs leading-relaxed font-sans">
            Test your knowledge of the Diocese of Kalookan history and PWA technology to earn the <strong>Faith Defender Badge</strong>!
          </p>
        </div>
      </div>

      <div className="p-4 flex-1 flex flex-col justify-between">
        {!isQuizCompleted ? (
          <div className="space-y-4 flex-1 flex flex-col justify-between">
            {/* Question card */}
            <div className="bg-white rounded-3xl border border-[#D6D6C2] p-4 shadow-xs space-y-4">
              <div className="flex justify-between items-center text-[10px] text-[#8A8A70] font-mono border-b border-[#F5F5F0] pb-2 font-bold">
                <span>QUESTION {currentQuestionIndex + 1} OF {PILGRIM_QUIZ.length}</span>
                <span>SCORE: {score}</span>
              </div>

              <h3 className="text-sm font-bold text-[#4A4A35] font-serif italic leading-relaxed">
                {activeQuestion.question}
              </h3>

              {/* Options */}
              <div className="space-y-2 select-none font-sans">
                {activeQuestion.options.map((option, idx) => {
                  let optionStyle = "border-[#D6D6C2] bg-[#F5F5F0]/30 hover:bg-[#EBEBE0]/35";
                  
                  if (selectedOptionIndex === idx) {
                    optionStyle = "border-[#5A5A40] bg-[#EBEBE0] font-bold";
                  }

                  if (isSubmitted) {
                    if (idx === activeQuestion.correctAnswerIndex) {
                      optionStyle = "border-green-600 bg-green-50 text-green-950 font-bold";
                    } else if (selectedOptionIndex === idx) {
                      optionStyle = "border-red-600 bg-red-50 text-red-950 line-through";
                    } else {
                      optionStyle = "border-gray-200 bg-gray-50/50 opacity-60";
                    }
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => handleOptionSelect(idx)}
                      disabled={isSubmitted}
                      className={`w-full p-3.5 text-xs rounded-xl border text-left flex items-center justify-between transition-all ${optionStyle}`}
                    >
                      <span className="leading-normal">{option}</span>
                      {isSubmitted && idx === activeQuestion.correctAnswerIndex && (
                        <Check className="w-4 h-4 text-green-700 shrink-0" />
                      )}
                      {isSubmitted && selectedOptionIndex === idx && idx !== activeQuestion.correctAnswerIndex && (
                        <X className="w-4 h-4 text-red-700 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Explanation & Action button */}
            <div className="space-y-3">
              {isSubmitted && (
                <div className="p-4 bg-[#EBEBE0]/50 rounded-2xl border border-[#D6D6C2] text-xs leading-relaxed space-y-1">
                  <span className="text-[9px] font-bold text-[#5A5A40] uppercase tracking-widest font-serif italic block">
                    Historical Explanation:
                  </span>
                  <p className="text-[#33332D] font-sans text-justify italic">
                    {activeQuestion.explanation}
                  </p>
                </div>
              )}

              {!isSubmitted ? (
                <button
                  onClick={handleSubmitAnswer}
                  disabled={selectedOptionIndex === null}
                  className="w-full py-3 bg-[#5A5A40] hover:bg-[#4A4A35] disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider rounded-full border border-[#4A4A35] transition-all shadow-xs"
                >
                  Confirm Answer Selection
                </button>
              ) : (
                <button
                  onClick={handleNextQuestion}
                  className="w-full py-3 bg-[#5A5A40] hover:bg-[#4A4A35] text-white text-xs font-bold uppercase tracking-wider rounded-full flex items-center justify-center gap-1 border border-[#4A4A35] transition-all shadow-xs"
                >
                  {currentQuestionIndex === PILGRIM_QUIZ.length - 1 ? "Complete Quiz" : "Next Question"} <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Finished Quiz Screen */
          <div className="bg-white rounded-3xl border border-[#D6D6C2] p-6 text-center space-y-5 shadow-xs flex-1 flex flex-col justify-center">
            <div className="h-14 w-12 bg-[#EBEBE0] rounded-2xl flex items-center justify-center mx-auto text-[#C2A649]">
              <Award className="w-8 h-8 fill-current" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[#4A4A35] font-serif italic">
                Catechism Quiz Finished!
              </h3>
              <p className="text-xs text-[#8A8A70] font-sans">
                You scored a total of:
              </p>
              <div className="text-3xl font-bold text-[#5A5A40] font-serif italic tracking-tight pt-1">
                {score} / 5 Correct
              </div>
            </div>

            <div className="p-4 bg-[#F5F5F0]/70 rounded-2xl border border-[#D6D6C2]/45 space-y-1 text-xs">
              {score === 5 ? (
                <>
                  <p className="font-bold text-green-800 flex items-center justify-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" /> Perfect Score Achievement!
                  </p>
                  <p className="text-[#33332D] font-sans leading-relaxed text-center">
                    You have unlocked the prestigious <strong>"Faith Defender"</strong> passport badge, and earned a bonus of +500 points! Excellent defense preparation!
                  </p>
                </>
              ) : (
                <p className="text-[#33332D] font-sans leading-relaxed text-center">
                  You earned +{score * 100} points. Get a perfect 5/5 to unlock the rare **Faith Defender** badge on your Pilgrim Stamp Passport!
                </p>
              )}
            </div>

            <button
              onClick={handleResetQuiz}
              className="w-full py-3 bg-[#5A5A40] hover:bg-[#4A4A35] text-white text-xs font-bold uppercase tracking-widest rounded-full flex items-center justify-center gap-1.5 border border-[#4A4A35] transition-all shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retake Pilgrim Quiz
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
