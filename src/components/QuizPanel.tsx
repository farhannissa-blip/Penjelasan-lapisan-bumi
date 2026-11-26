import { useState } from 'react';
import {
  Award,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Compass,
  RotateCcw,
  Star,
  XCircle,
} from 'lucide-react';
import { LAYER_MAP, type LayerId } from '../data/earthContent';
import { QUIZ_QUESTIONS } from '../data/quizQuestions';

interface QuizPanelProps {
  answers: Record<number, number>;
  onAnswer: (questionId: number, optionIndex: number) => void;
  onResetQuiz: () => void;
  onInspectLayer3D: (layerId: LayerId) => void;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

export function QuizPanel({
  answers,
  onAnswer,
  onResetQuiz,
  onInspectLayer3D,
}: QuizPanelProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showSummary, setShowSummary] = useState(false);

  const totalQuestions = QUIZ_QUESTIONS.length;
  const currentQ = QUIZ_QUESTIONS[currentIdx];
  const selectedOption = answers[currentQ.id];
  const isAnswered = selectedOption !== undefined;
  const isCorrect = isAnswered && selectedOption === currentQ.correctIndex;

  const answeredCount = Object.keys(answers).length;
  const correctCount = QUIZ_QUESTIONS.reduce(
    (sum, q) => (answers[q.id] === q.correctIndex ? sum + 1 : sum),
    0,
  );
  const scorePercent = Math.round((correctCount / totalQuestions) * 100);
  const earnedStars = Math.max(1, Math.min(5, Math.ceil((correctCount / totalQuestions) * 5)));

  const handleRestart = () => {
    onResetQuiz();
    setCurrentIdx(0);
    setShowSummary(false);
  };

  if (showSummary) {
    let predicate = 'Tetap Semangat, Penjelajah!';
    let feedback =
      'Kamu sudah berani mencoba semua soal! Yuk putar lagi Bumi 3D dan buka tab Materi agar makin hafal setiap lapisannya.';
    if (scorePercent >= 87) {
      predicate = 'Luar Biasa — Penjelajah Bumi Hebat!';
      feedback =
        'Selamat! Pemahamanmu tentang Kerak Bumi, Mantel, Inti Luar, Inti Dalam, dan komponen Bumi sangat mantap.';
    } else if (scorePercent >= 70) {
      predicate = 'Bagus Sekali — Hampir Sempurna!';
      feedback =
        'Sebagian besar jawabanmu sudah tepat dan bintangmu sudah banyak. Yuk cek beberapa pembahasan di bawah!';
    } else if (scorePercent >= 50) {
      predicate = 'Cukup Baik — Terus Berlatih!';
      feedback =
        'Awal yang bagus! Coba lihat perbandingan ketebalan dan putar animasi lapisan agar makin mudah diingat.';
    }

    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-800 bg-[#0E172A] p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-amber-300 font-medium">
                <Award className="w-4 h-4" />
                <span>Hasil Kuis Penjelajah Bumi (15 Soal)</span>
              </div>
              <h2 className="font-display text-xl font-bold text-white">
                {predicate}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                {feedback}
              </p>
            </div>

            <div className="flex items-center gap-4 shrink-0">
              <div className="text-left sm:text-right">
                <p className="text-xs text-slate-400">Skor Akhir</p>
                <p className="font-mono-tabular text-3xl font-bold text-sky-400">
                  {scorePercent}
                </p>
                <p className="text-xs text-amber-300 font-mono-tabular">
                  {correctCount} Bintang ({correctCount}/{totalQuestions})
                </p>
              </div>
            </div>
          </div>

          {/* 5-Star Achievement Bar */}
          <div className="flex items-center justify-between flex-wrap gap-3 pt-3 border-t border-slate-800">
            <div className="flex items-center gap-1.5" aria-label={`Peringkat ${earnedStars} dari 5 bintang`}>
              {[1, 2, 3, 4, 5].map((starNum) => (
                <Star
                  key={starNum}
                  className={`w-6 h-6 transition-transform duration-300 ${
                    starNum <= earnedStars
                      ? 'text-amber-400 fill-amber-400 scale-105'
                      : 'text-slate-700'
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={handleRestart}
              className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[42px] rounded-lg bg-sky-500 text-slate-950 text-xs font-semibold hover:bg-sky-400 transition-colors whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Ulangi Kuis</span>
            </button>
          </div>
        </div>

        {/* Review list */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-400">
            Ringkasan Jawaban (15 Soal)
          </p>
          <div className="grid grid-cols-1 gap-2">
            {QUIZ_QUESTIONS.map((q) => {
              const userAns = answers[q.id];
              const ok = userAns === q.correctIndex;
              return (
                <div
                  key={q.id}
                  className="rounded-lg border border-slate-800 bg-[#0E172A] p-3 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono-tabular text-slate-400">
                      Soal {q.id} · {q.topic}
                    </span>
                    {ok ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        Benar (+1 Bintang)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-300 font-medium">
                        <XCircle className="w-3.5 h-3.5" />
                        {userAns === undefined ? 'Belum dijawab' : 'Perlu diingat'}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-200 leading-snug">{q.question}</p>
                  {!ok && (
                    <p className="text-emerald-300">
                      Jawaban tepat: {OPTION_LETTERS[q.correctIndex]}. {q.options[q.correctIndex]}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const relatedLayer = LAYER_MAP[currentQ.relatedLayerId];

  return (
    <div className="space-y-3.5">
      {/* Top Quiz Header with Star Counter + 3D Hint */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-slate-300 font-mono-tabular">
          <span className="font-semibold text-white">
            Soal {currentQ.id}/{totalQuestions}
          </span>
          <span aria-hidden="true" className="text-slate-600">
            ·
          </span>
          <span className="inline-flex items-center gap-1 text-amber-300 font-semibold">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span>{correctCount} Bintang</span>
          </span>
        </div>

        <button
          type="button"
          onClick={() => onInspectLayer3D(currentQ.relatedLayerId)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[34px] rounded-lg border border-slate-700 bg-slate-800/80 text-xs text-sky-300 hover:bg-slate-700 transition-colors whitespace-nowrap cursor-pointer"
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Lihat di 3D: {relatedLayer.name}</span>
        </button>
      </div>

      {/* Scrollable 1..15 number buttons */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 earth-scroll">
        {QUIZ_QUESTIONS.map((q, idx) => {
          const ans = answers[q.id];
          const isCurrent = idx === currentIdx;
          const isQCorrect = ans !== undefined && ans === q.correctIndex;
          const isQWrong = ans !== undefined && ans !== q.correctIndex;

          let stateClasses =
            'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200';
          if (isCurrent) {
            stateClasses = 'bg-sky-500 border-sky-400 text-slate-950 font-bold';
          } else if (isQCorrect) {
            stateClasses = 'bg-emerald-950/70 border-emerald-600/60 text-emerald-300';
          } else if (isQWrong) {
            stateClasses = 'bg-amber-950/70 border-amber-600/60 text-amber-300';
          }

          return (
            <button
              key={q.id}
              type="button"
              onClick={() => setCurrentIdx(idx)}
              aria-label={`Soal ${q.id}`}
              className={`w-8 h-8 rounded-md border text-xs font-mono-tabular shrink-0 flex items-center justify-center transition-colors cursor-pointer ${stateClasses}`}
            >
              {q.id}
            </button>
          );
        })}
      </div>

      {/* Question Card */}
      <div className="rounded-xl border border-slate-800 bg-[#0E172A] p-4 space-y-3.5">
        <p className="text-[11px] text-sky-300 font-medium">{currentQ.topic}</p>
        <h3 className="text-sm sm:text-base font-semibold text-white leading-relaxed">
          {currentQ.id}. {currentQ.question}
        </h3>

        <div className="grid grid-cols-1 gap-2">
          {currentQ.options.map((opt, optIdx) => {
            const isSelected = selectedOption === optIdx;
            const isRightOption = optIdx === currentQ.correctIndex;

            let btnStyle =
              'bg-slate-900/90 border-slate-800 text-slate-200 hover:border-slate-600 hover:bg-slate-800/80';
            if (isAnswered) {
              if (isRightOption) {
                btnStyle = 'bg-emerald-950/60 border-emerald-500/70 text-emerald-100';
              } else if (isSelected) {
                btnStyle = 'bg-amber-950/50 border-amber-500/60 text-amber-100';
              } else {
                btnStyle = 'bg-slate-900/50 border-slate-800/70 text-slate-500';
              }
            }

            return (
              <button
                key={optIdx}
                type="button"
                disabled={isAnswered}
                onClick={() => onAnswer(currentQ.id, optIdx)}
                className={`w-full text-left px-3.5 py-2.5 min-h-[44px] rounded-lg border text-xs sm:text-sm transition-colors flex items-start gap-2.5 ${
                  isAnswered ? 'cursor-default' : 'cursor-pointer'
                } ${btnStyle}`}
              >
                <span className="font-mono-tabular font-semibold shrink-0 mt-0.5">
                  {OPTION_LETTERS[optIdx]}.
                </span>
                <span className="flex-1 leading-snug">{opt}</span>
                {isAnswered && isRightOption && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                )}
                {isAnswered && isSelected && !isRightOption && (
                  <XCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                )}
              </button>
            );
          })}
        </div>

        {/* Gentle, Encouraging Feedback + Star Reward */}
        {isAnswered && (
          <div
            className={`rounded-lg border p-3 text-xs sm:text-sm leading-relaxed ${
              isCorrect
                ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-100'
                : 'border-amber-500/35 bg-amber-950/30 text-amber-100'
            }`}
          >
            <div className="flex items-center gap-1.5 font-semibold">
              {isCorrect ? (
                <>
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span>Hebat! Jawabanmu Benar (+1 Bintang)</span>
                </>
              ) : (
                <span>Belum tepat, tidak apa-apa! Yuk simak pembahasannya:</span>
              )}
            </div>
            <p className="mt-1 text-slate-200">{currentQ.explanation}</p>
          </div>
        )}

        {/* Footer Navigation */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/90">
          <button
            type="button"
            disabled={currentIdx === 0}
            onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
            className="inline-flex items-center gap-1 px-3 py-2 min-h-[40px] rounded-lg border border-slate-700 bg-slate-800/80 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Sebelumnya</span>
          </button>

          <div className="text-xs text-slate-400 font-mono-tabular">
            {answeredCount}/{totalQuestions}
          </div>

          {currentIdx < totalQuestions - 1 ? (
            <button
              type="button"
              onClick={() => setCurrentIdx((i) => Math.min(totalQuestions - 1, i + 1))}
              className="inline-flex items-center gap-1 px-3.5 py-2 min-h-[40px] rounded-lg bg-sky-500 text-slate-950 text-xs font-semibold hover:bg-sky-400 cursor-pointer"
            >
              <span>Berikutnya</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowSummary(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-lg bg-emerald-500 text-slate-950 text-xs font-semibold hover:bg-emerald-400 cursor-pointer"
            >
              <Award className="w-4 h-4" />
              <span>Lihat Hasil</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
