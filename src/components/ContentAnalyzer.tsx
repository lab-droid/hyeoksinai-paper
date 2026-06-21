// 업로드 자료를 분석해 '전반적인 내용' 작성 양식을 만들고, 항목별로 채우게 한다.
// 채운 내용은 compileContentForm()으로 합쳐져 생성에 사용된다.

import { motion } from 'motion/react';
import { Loader2, Sparkles, Lightbulb, CheckCircle2, RefreshCw, ClipboardList } from 'lucide-react';
import type { ContentField } from '../lib/gemini';

// 작성 양식 답변을 생성 프롬프트용 '전반적인 내용'으로 조립
export const compileContentForm = (
  seed: string,
  fields: ContentField[],
  answers: Record<number, string>,
): string => {
  const parts: string[] = [];
  if (seed.trim()) parts.push(`[사업 아이디어 한 줄 요약]\n${seed.trim()}`);
  const filled = fields
    .map((f, i) => ({ title: f.title, a: (answers[i] || '').trim() }))
    .filter(item => item.a)
    .map(item => `[${item.title}]\n${item.a}`);
  if (filled.length) {
    parts.push(
      '아래는 사용자가 작성한 전반적인 내용입니다. 이 내용을 충실히 반영하고, 비어 있는 부분은 자료와 사업 특성에 맞게 합리적으로 보완하세요.\n\n' +
      filled.join('\n\n'),
    );
  }
  return parts.join('\n\n');
};

interface Props {
  seed: string;
  setSeed: (v: string) => void;
  analysis: string;
  fields: ContentField[];
  answers: Record<number, string>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  isAnalyzing: boolean;
  hasTemplate: boolean;
  onAnalyze: () => void;
}

export default function ContentAnalyzer({
  seed, setSeed, analysis, fields, answers, setAnswers, isAnalyzing, hasTemplate, onAnalyze,
}: Props) {
  const hasForm = fields.length > 0;
  const filledCount = fields.filter((_, i) => (answers[i] || '').trim()).length;

  // 분석 전
  if (!hasForm) {
    return (
      <div className="flex flex-col items-center text-center py-6">
        <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center mb-3">
          <Sparkles className="w-6 h-6 text-indigo-600" />
        </div>
        <h4 className="text-base font-bold text-neutral-900 mb-1">무엇을 써야 할지 분석해 드립니다</h4>
        <p className="text-sm text-neutral-500 mb-4 max-w-md leading-relaxed">
          업로드한 <strong>양식·공고·기준</strong>을 분석해, 전반적인 내용에 채워야 할 항목을 양식으로 만들어 드립니다.
          한 줄 아이디어를 적으면 더 정확해집니다(비워도 됩니다).
        </p>
        <input
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && hasTemplate && !isAnalyzing) onAnalyze(); }}
          placeholder="예: 소상공인을 위한 AI 재고관리 앱"
          className="w-full max-w-md px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm mb-3"
        />
        <button
          onClick={onAnalyze}
          disabled={isAnalyzing || !hasTemplate}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-sm transition-colors"
        >
          {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />}
          {isAnalyzing ? '분석 중...' : '분석하고 양식 만들기'}
        </button>
        {!hasTemplate && <p className="text-xs text-amber-600 mt-2">먼저 '사업계획서 양식(필수)'을 업로드해주세요.</p>}
      </div>
    );
  }

  // 분석 후: 요약 + 작성 양식
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {analysis && (
        <div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-bold text-indigo-900">분석 결과</span>
          </div>
          <p className="text-sm text-indigo-900/80 leading-relaxed">{analysis}</p>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-neutral-500">{fields.length}개 항목 중 {filledCount}개 작성됨 · 아는 만큼만 채워도 AI가 보완합니다</span>
        <button onClick={onAnalyze} disabled={isAnalyzing} className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700 transition-colors">
          {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}양식 새로 만들기
        </button>
      </div>

      <div className="space-y-4">
        {fields.map((f, i) => {
          const done = (answers[i] || '').trim().length > 0;
          return (
            <div key={i} className="rounded-xl border border-neutral-200 p-4">
              <div className="flex items-center gap-1.5 mb-1">
                {done && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                <h5 className="text-sm font-bold text-neutral-900">{f.title}</h5>
              </div>
              {f.guide && <p className="text-xs text-neutral-500 mb-1.5 leading-relaxed">{f.guide}</p>}
              {f.example && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 mb-2 flex items-start gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 mt-0.5 shrink-0" />예시: {f.example}
                </p>
              )}
              <textarea
                value={answers[i] || ''}
                onChange={(e) => setAnswers(prev => ({ ...prev, [i]: e.target.value }))}
                placeholder="여기에 작성하세요. 모르면 비워두셔도 됩니다."
                className="w-full min-h-[80px] p-2.5 bg-neutral-50 border border-neutral-200 rounded-lg outline-none focus:ring-2 focus:ring-rose-500 text-sm resize-none"
              />
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
