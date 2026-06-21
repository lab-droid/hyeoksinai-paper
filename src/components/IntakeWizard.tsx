// 가이드형 입력 위저드: 막막한 자유 텍스트 대신 항목별로 안내하며 입력받는다.
// 입력값은 compileWizard()로 '전반적인 내용' 텍스트로 합쳐져 생성에 사용된다.

export interface WizardField {
  key: string;
  label: string;
  placeholder: string;
}

export const WIZARD_FIELDS: WizardField[] = [
  { key: 'item', label: '1. 사업 아이템 (한 줄 요약)', placeholder: '예: 소상공인을 위한 AI 매출 예측·재고관리 SaaS' },
  { key: 'problem', label: '2. 해결하려는 문제 / 시장의 불편', placeholder: '예: 소상공인은 데이터 분석 역량이 없어 재고 과잉·결품으로 연 평균 매출의 12%를 손실합니다.' },
  { key: 'solution', label: '3. 솔루션 / 핵심 기능', placeholder: '예: POS 데이터를 학습해 주간 발주량을 자동 추천하고, 폐기율을 30% 줄입니다.' },
  { key: 'market', label: '4. 목표 시장 / 고객', placeholder: '예: 국내 외식 소상공인 65만 곳, 1차 타겟은 프랜차이즈 가맹점 3만 곳' },
  { key: 'competition', label: '5. 경쟁사 / 차별점', placeholder: '예: 기존 ERP 대비 설치형이 아닌 클라우드, 도입 비용 1/5, 업종 특화 모델' },
  { key: 'revenue', label: '6. 수익 모델', placeholder: '예: 월 구독(SaaS) 3.9만원 + 발주 연동 수수료, 1년차 MRR 목표 5천만원' },
  { key: 'team', label: '7. 팀 구성 / 역량', placeholder: '예: 대표(데이터 사이언티스트, 카카오 출신), CTO(10년 백엔드), 자문(외식업 프랜차이즈 본부장)' },
  { key: 'fund', label: '8. 자금 사용 계획', placeholder: '예: 인건비 50%, 개발/인프라 25%, 마케팅 15%, 기타 10%' },
  { key: 'schedule', label: '9. 추진 일정 / 마일스톤', placeholder: '예: 1~3개월 MVP, 4~6개월 베타 100곳, 7~12개월 유료 전환 및 시리즈A' },
];

// 위저드 입력값을 생성 프롬프트용 텍스트로 합친다.
export const compileWizard = (answers: Record<string, string>): string =>
  WIZARD_FIELDS
    .filter(f => (answers[f.key] || '').trim())
    .map(f => `[${f.label.replace(/^\d+\.\s*/, '')}]\n${answers[f.key].trim()}`)
    .join('\n\n');

interface Props {
  answers: Record<string, string>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

export default function IntakeWizard({ answers, setAnswers }: Props) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {WIZARD_FIELDS.map(field => (
        <div key={field.key} className="flex flex-col">
          <label className="text-sm font-semibold text-neutral-800 mb-1.5">{field.label}</label>
          <textarea
            value={answers[field.key] || ''}
            onChange={(e) => setAnswers(prev => ({ ...prev, [field.key]: e.target.value }))}
            placeholder={field.placeholder}
            className="w-full min-h-[88px] p-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none resize-none text-sm"
          />
        </div>
      ))}
    </div>
  );
}
