// AI 자가 평가 결과 패널: 종합 점수 + 항목별 점수/개선점 + 약한 섹션 보강 버튼.

import { motion } from 'motion/react';
import { Loader2, Sparkles, TrendingUp, AlertCircle } from 'lucide-react';
import type { Evaluation } from '../lib/gemini';

interface Props {
  evaluation: Evaluation | null;
  isEvaluating: boolean;
  onEvaluate: () => void;
  onReinforce: (sectionName: string) => void;
}

const scoreColor = (ratio: number) =>
  ratio >= 0.8 ? 'text-emerald-600' : ratio >= 0.6 ? 'text-amber-600' : 'text-rose-600';
const barColor = (ratio: number) =>
  ratio >= 0.8 ? 'bg-emerald-500' : ratio >= 0.6 ? 'bg-amber-500' : 'bg-rose-500';

export default function EvaluationPanel({ evaluation, isEvaluating, onEvaluate, onReinforce }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-600" />
          <h3 className="font-bold text-neutral-900">AI 평가위원 점수</h3>
        </div>
        <button
          onClick={onEvaluate}
          disabled={isEvaluating}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
        >
          {isEvaluating ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
          {evaluation ? '다시 평가' : '평가받기'}
        </button>
      </div>

      {!evaluation && !isEvaluating && (
        <p className="text-sm text-neutral-500 leading-relaxed">
          작성된 사업계획서를 업로드한 <strong>평가기준</strong>(또는 일반 정부지원사업 기준)에 맞춰 채점하고,
          항목별 개선 방향과 가장 보강이 시급한 섹션을 알려드립니다.
        </p>
      )}

      {isEvaluating && (
        <div className="flex items-center gap-2 text-sm text-neutral-500 py-4">
          <Loader2 className="w-4 h-4 animate-spin" /> 평가위원이 채점 중입니다...
        </div>
      )}

      {evaluation && !isEvaluating && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
          {/* 종합 점수 */}
          <div className="flex items-end gap-3">
            <span className={`text-5xl font-extrabold ${scoreColor(evaluation.totalScore / 100)}`}>
              {Math.round(evaluation.totalScore)}
            </span>
            <span className="text-neutral-400 font-semibold mb-1.5">/ 100점</span>
          </div>
          {evaluation.summary && (
            <p className="text-sm text-neutral-600 bg-neutral-50 border border-neutral-100 rounded-xl p-3 leading-relaxed">
              {evaluation.summary}
            </p>
          )}

          {/* 항목별 점수 */}
          <div className="space-y-4">
            {evaluation.items.map((item, i) => {
              const ratio = item.maxScore ? item.score / item.maxScore : 0;
              return (
                <div key={i} className="border-b border-neutral-100 pb-4 last:border-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm text-neutral-800">{item.name}</span>
                    <span className={`text-sm font-bold ${scoreColor(ratio)}`}>{item.score} / {item.maxScore}</span>
                  </div>
                  <div className="w-full bg-neutral-100 rounded-full h-1.5 mb-2 overflow-hidden">
                    <div className={`h-full rounded-full ${barColor(ratio)}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
                  </div>
                  {item.evaluation && <p className="text-xs text-neutral-500 leading-relaxed">{item.evaluation}</p>}
                  {item.improvement && (
                    <p className="text-xs text-indigo-700 bg-indigo-50 rounded-lg px-2.5 py-1.5 mt-1.5 leading-relaxed">
                      💡 {item.improvement}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* 보강 시급 섹션 */}
          {evaluation.weakestSections.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-800">보강이 시급한 섹션</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {evaluation.weakestSections.map((name, i) => (
                  <button
                    key={i}
                    onClick={() => onReinforce(name)}
                    className="text-xs font-medium bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 px-2.5 py-1.5 rounded-lg transition-colors"
                    title="이 섹션을 AI로 보강합니다"
                  >
                    {name} 보강 →
                  </button>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
