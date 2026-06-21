// AI 인터뷰 입력: AI가 맞춤 질문을 만들고, 한 번에 하나씩 물어보며 답을 받는다.
// 답변은 compileInterview()로 '전반적인 내용'으로 조립되어 생성에 사용된다.

import { useState } from 'react';
import { motion } from 'motion/react';
import { Loader2, Sparkles, ChevronLeft, ChevronRight, SkipForward, Lightbulb, CheckCircle2, RefreshCw } from 'lucide-react';
import type { InterviewQuestion } from '../lib/gemini';

// 인터뷰 답변을 생성 프롬프트용 '전반적인 내용'으로 조립
export const compileInterview = (
  seed: string,
  questions: InterviewQuestion[],
  answers: Record<number, string>,
): string => {
  const lines: string[] = [];
  if (seed.trim()) lines.push(`[사업 아이디어 한 줄 요약]\n${seed.trim()}`);
  const qa = questions
    .map((q, i) => ({ q: q.question, a: (answers[i] || '').trim() }))
    .filter(item => item.a)
    .map(item => `[질문] ${item.q}\n[답변] ${item.a}`);
  if (qa.length) lines.push('아래는 사용자 인터뷰 내용입니다. 이 답변을 충실히 반영하여 작성하고, 사용자가 답하지 않은 부분은 사업 특성에 맞게 합리적으로 보완하세요.\n\n' + qa.join('\n\n'));
  return lines.join('\n\n');
};

interface Props {
  seed: string;
  setSeed: (v: string) => void;
  questions: InterviewQuestion[];
  answers: Record<number, string>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  isLoading: boolean;
  onMakeQuestions: () => void;
}

export default function InterviewMode({ seed, setSeed, questions, answers, setAnswers, isLoading, onMakeQuestions }: Props) {
  const [step, setStep] = useState(0);

  const hasQuestions = questions.length > 0;
  const answeredCount = questions.filter((_, i) => (answers[i] || '').trim()).length;
  const current = questions[step];

  // 질문 생성 전: 한 줄 아이디어 입력 + 시작 버튼
  if (!hasQuestions) {
    return (
      <div className="flex flex-col items-center text-center py-6">
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
          <Sparkles className="w-7 h-7 text-indigo-600" />
        </div>
        <h4 className="text-lg font-bold text-neutral-900 mb-1.5">무엇을 쓸지 막막하신가요?</h4>
        <p className="text-sm text-neutral-500 mb-5 max-w-md leading-relaxed">
          한 줄 아이디어만 적어주시면(또는 비워두셔도 됩니다), AI가 업로드한 공고·양식에 맞춰
          <strong> 꼭 필요한 질문들을 만들어 하나씩 물어봅니다.</strong> 답만 하시면 내용이 완성돼요.
        </p>
        <input
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !isLoading) onMakeQuestions(); }}
          placeholder="예: 소상공인을 위한 AI 재고관리 앱 (비워두셔도 됩니다)"
          className="w-full max-w-md px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm mb-3"
        />
        <button
          onClick={onMakeQuestions}
          disabled={isLoading}
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold text-sm transition-colors"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {isLoading ? '맞춤 질문 만드는 중...' : 'AI 맞춤 질문 만들기'}
        </button>
      </div>
    );
  }

  // 질문 생성 후: 한 번에 하나씩 답하는 스텝퍼
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-indigo-600">질문 {step + 1} / {questions.length}</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-neutral-400">{answeredCount}개 답변 완료</span>
          <button onClick={onMakeQuestions} disabled={isLoading} className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700 transition-colors" title="질문 다시 만들기">
            {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}질문 새로 만들기
          </button>
        </div>
      </div>
      <div className="w-full bg-neutral-100 rounded-full h-1.5 mb-5 overflow-hidden">
        <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${((step + 1) / questions.length) * 100}%` }} />
      </div>

      <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="min-h-[200px]">
        <p className="text-base font-bold text-neutral-900 mb-2 leading-snug flex items-start gap-2">
          {(answers[step] || '').trim() && <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />}
          {current.question}
        </p>
        {current.hint && <p className="text-xs text-neutral-500 mb-1">{current.hint}</p>}
        {current.example && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 mb-3 flex items-start gap-1.5">
            <Lightbulb className="w-3.5 h-3.5 mt-0.5 shrink-0" />예시: {current.example}
          </p>
        )}
        <textarea
          value={answers[step] || ''}
          onChange={(e) => setAnswers(prev => ({ ...prev, [step]: e.target.value }))}
          placeholder="여기에 편하게 답해주세요. 잘 모르겠으면 건너뛰어도 AI가 알아서 보완합니다."
          className="w-full min-h-[110px] p-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none"
        />
      </motion.div>

      <div className="flex items-center justify-between mt-4">
        <button
          onClick={() => setStep(s => Math.max(0, s - 1))}
          disabled={step === 0}
          className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-40 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />이전
        </button>
        {step < questions.length - 1 ? (
          <div className="flex items-center gap-2">
            <button onClick={() => setStep(s => s + 1)} className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium text-neutral-500 hover:bg-neutral-100 transition-colors">
              <SkipForward className="w-4 h-4" />건너뛰기
            </button>
            <button onClick={() => setStep(s => s + 1)} className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-semibold bg-neutral-900 hover:bg-neutral-800 text-white transition-colors">
              다음<ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <span className="text-sm font-semibold text-emerald-600 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />마지막 질문이에요! 아래 '생성하기'를 눌러주세요.
          </span>
        )}
      </div>
    </div>
  );
}
