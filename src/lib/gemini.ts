// Gemini 호출 로직 모음: 전체 생성(스트리밍), 자가 평가, 섹션 재생성, 대화형 보완.

import { GoogleGenAI } from '@google/genai';
import { fileToPart } from './files';

export type ModelId = 'gemini-3.1-pro-preview' | 'gemini-3-flash-preview';

export interface InputFiles {
  announcementFiles: File[];
  templateFiles: File[];
  infoFiles: File[];
  criteriaFiles: File[];
}

export interface EvaluationItem {
  name: string;
  score: number;
  maxScore: number;
  evaluation: string;
  improvement: string;
}

export interface Evaluation {
  totalScore: number;
  summary: string;
  items: EvaluationItem[];
  weakestSections: string[];
}

export interface InterviewQuestion {
  question: string;
  hint?: string;
  example?: string;
}

export interface ContentField {
  title: string;   // 작성할 항목명
  guide: string;   // 무엇을 어떻게 써야 하는지 안내
  example: string; // 예시 문장
}

export interface ContentFormResult {
  analysis: string;        // 업로드 자료 분석 요약
  fields: ContentField[];  // '전반적인 내용' 작성 양식
}

const WRITER_PERSONA =
  '당신은 정부지원사업 및 투자 유치를 위한 최고 수준의 사업계획서 작성 전문가입니다. 서류평가위원에게 높은 고득점을 받을 수 있도록 논리적이고 설득력 있게, 그리고 전문적인 용어를 사용하여 작성해야 합니다.';

// 출력 서식 규칙(표/색상/이미지 placeholder 등). 모든 생성·수정 호출에서 공통 적용.
export const FORMAT_RULES = `작성 지침:
1. 제공된 '사업계획서 양식'의 목차와 구조를 기본으로 하되, **제공된 '사업계획서 관련 정보' 및 '운영 기준 항목'의 내용을 심층적으로 분석하여 기존 양식에 없는 새로운 '추가 항목(목차)'을 반드시 1개 이상 생성하여 적절한 위치에 포함시킬 것.**
2. '모집공고 양식'이 제공된 경우, 해당 공고의 평가 기준과 요구사항을 철저히 반영할 것.
3. **[중요] 서류평가위원에게 고득점을 받기 위해 필수적인 항목(예: 구체적인 수익 모델, 경쟁사 대비 차별화 전략, 리스크 관리 및 대응 방안, 팀 역량 및 네트워크 등)을 AI가 스스로 분석하여, 기존 양식에 누락되어 있다면 적절한 위치에 추가하여 작성할 것.**
4. **[중요] '추가 인원 채용 계획' 항목이 있다면, 정부지원사업에서 높은 점수(일자리 창출 지표)를 받을 수 있도록 사업 규모와 성장 단계에 맞는 타당하고 전략적인 인원 수와 직무(예: 핵심 개발자, 마케팅 전문가 등)를 선정하여 구체적으로 작성할 것.**
5. **[매우 중요] 표(Table)가 필요한 문장이나 항목(예: 자금소요계획, 추진일정, 인력현황, 경쟁사 비교 등)은 반드시 마크다운 표 형식으로 구성하여 보여줄 것. 표 작성 시 내용이 비어있거나 투명한 표가 아닌, 반드시 모든 셀에 구체적인 내용이 채워진 완전한 표 형식으로 작성할 것.**
6. 평가위원이 한눈에 파악할 수 있도록 가독성 높게 작성할 것. 문항마다 문단을 명확히 나누어 작성할 것.
7. **[중요] 강조할 텍스트는 빨간색, 진한 파란색, 진한 초록색 색상을 적절하게 섞어서 작성할 것. 색상 적용 시 반드시 HTML 태그를 사용할 것 (예: <span style="color: red;">강조내용</span>). 굵은 글씨(Bold)가 필요한 경우 \`**\` 기호 대신 \`<strong>\` 태그를 사용할 것.**
8. 일반 본문에서 줄바꿈이 필요하다면 마크다운의 문단 띄어쓰기(엔터 두 번)를 사용할 것. **단, 마크다운 표(\`|\`로 구분되는 표) 내부의 셀 안에서 줄바꿈이 필요할 때는 반드시 \`<br>\` 태그를 사용할 것.** 표 위아래로는 반드시 빈 줄을 하나씩 넣어서 표가 깨지지 않게 할 것.
9. **[중요] 이미지가 포함되면 좋은 곳(예: 서비스 흐름도, 제품 사진, 시스템 아키텍처 등)은 반드시 \`[이미지 : (들어갈 이미지에 대한 상세 설명)]\` 형식으로 본문에 포함시킬 것.**
10. "여기 사업계획서 초안입니다"와 같은 인사말이나 마크다운 문법에 대한 설명 등 불필요한 내용은 일절 제외하고, 오직 사업계획서 본문 내용만 바로 출력할 것.`;

// 업로드된 4종 파일을 라벨과 함께 part 배열로 변환한다(생성·평가·수정 공통).
const buildContextParts = async (files: InputFiles): Promise<any[]> => {
  const parts: any[] = [];
  const groups: [File[], string][] = [
    [files.announcementFiles, '\n\n[모집공고 양식 및 내용]'],
    [files.templateFiles, '\n\n[사업계획서 양식]'],
    [files.infoFiles, '\n\n[사업계획서 관련 정보]'],
    [files.criteriaFiles, '\n\n[운영 기준 항목]'],
  ];
  for (const [group, label] of groups) {
    if (group.length > 0) {
      parts.push({ text: label });
      for (const file of group) parts.push(await fileToPart(file));
    }
  }
  return parts;
};

// **텍스트** → <strong>텍스트</strong> 변환(마크다운 파싱 오류 방지 및 ** 기호 숨김)
export const normalizeBold = (text: string): string =>
  text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

// 모델/응답에서 자주 섞여 나오는 코드펜스(```json ... ```)를 제거한다.
const stripCodeFence = (text: string): string =>
  text.replace(/^```(?:json|markdown|md)?\s*/i, '').replace(/```\s*$/i, '').trim();

export const translateError = (err: any): string => {
  const msg: string = err?.message || '';
  if (msg.includes('quota') || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
    return 'API 사용량이 한도를 초과했습니다. 잠시 후 다시 시도하시거나, 유료 플랜(Pay-as-you-go) 설정 또는 다른 API Key 사용을 권장합니다.';
  }
  if (msg.includes('API key not valid')) {
    return '유효하지 않은 API Key입니다. 키를 다시 확인해주세요.';
  }
  if (msg) return `오류: ${msg}`;
  return '오류가 발생했습니다. 파일 형식이 지원되지 않거나 API Key를 확인해주세요.';
};

// 전체 사업계획서 생성 (스트리밍). onChunk로 누적 텍스트를 실시간 전달한다.
export const generatePlanStream = async (opts: {
  apiKey: string;
  model: ModelId;
  files: InputFiles;
  content: string;
  onChunk?: (accumulated: string) => void;
}): Promise<string> => {
  const { apiKey, model, files, content, onChunk } = opts;
  const ai = new GoogleGenAI({ apiKey });

  const parts: any[] = [];
  parts.push({ text: `${WRITER_PERSONA}\n\n다음 정보를 바탕으로 사업계획서를 작성해주세요.` });
  parts.push(...(await buildContextParts(files)));
  parts.push({ text: `\n\n[전반적인 내용]\n${content}\n\n${FORMAT_RULES}` });

  const stream = await ai.models.generateContentStream({ model, contents: { parts } });
  let acc = '';
  for await (const chunk of stream) {
    const t = (chunk as any).text || '';
    if (t) {
      acc += t;
      onChunk?.(acc);
    }
  }
  return normalizeBold(acc);
};

// 업로드 자료(양식/공고/정보/기준)를 분석하여, '전반적인 내용'을 어떻게 써야 할지
// 안내하는 맞춤 작성 양식(분석 요약 + 항목별 가이드)을 생성한다.
export const analyzeContentForm = async (opts: {
  apiKey: string;
  model: ModelId;
  files: InputFiles;
  seed: string;
}): Promise<ContentFormResult> => {
  const { apiKey, model, files, seed } = opts;
  const ai = new GoogleGenAI({ apiKey });

  const parts: any[] = [];
  parts.push({
    text:
      '당신은 정부지원사업 및 투자유치 사업계획서를 다수 컨설팅한 전문가입니다. 제공된 자료를 분석하여, 신청자가 핵심 내용을 빠짐없이 채울 수 있는 맞춤 작성 양식을 설계합니다.',
  });
  parts.push(...(await buildContextParts(files)));
  parts.push({
    text: `\n\n[사용자가 적은 한 줄 아이디어]\n${seed || '(아직 작성하지 않음)'}\n\n[지침]
1. 위 '사업계획서 양식'의 목차/구조와, 제공된 경우 '모집공고'의 평가 기준 및 '운영 기준 항목'을 함께 분석하세요.
2. analysis: 이 사업계획서가 무엇을 중점적으로 평가하는지, 고득점을 위해 '전반적인 내용'에 반드시 담아야 할 포인트가 무엇인지 3~5문장으로 친절하게 요약하세요.
3. fields: 사용자가 '전반적인 내용'에 채워야 할 항목 목록을 6~10개 만드세요. 각 항목은 title(항목명), guide(무엇을 어떻게 써야 하는지 구체적 안내 — 평가 관점 포함), example(바로 참고할 수 있는 예시 문장)으로 구성합니다.
4. 항목은 업로드된 양식의 목차와 평가기준에 정확히 대응하도록 맞춤 설계하고, 전문 용어를 모르는 사람도 이해할 수 있게 쉽게 쓰세요.
5. 반드시 아래 JSON 스키마에 맞는 JSON만 출력하세요. 다른 설명은 금지합니다.

{ "analysis": string, "fields": [ { "title": string, "guide": string, "example": string } ] }`,
  });

  const response = await ai.models.generateContent({
    model,
    contents: { parts },
    config: { responseMimeType: 'application/json' },
  });

  const raw = stripCodeFence((response as any).text || '');
  let parsed: ContentFormResult;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('분석 결과를 해석하지 못했습니다. 다시 시도해주세요.');
    parsed = JSON.parse(raw.slice(start, end + 1));
  }
  const fields = Array.isArray(parsed.fields) ? parsed.fields : [];
  return {
    analysis: parsed.analysis?.trim() || '',
    fields: fields
      .filter(f => f && typeof f.title === 'string' && f.title.trim())
      .map(f => ({ title: f.title.trim(), guide: (f.guide || '').trim(), example: (f.example || '').trim() })),
  };
};

// 업로드 자료 + 한 줄 아이디어를 바탕으로, 초보자도 답할 수 있는 맞춤 인터뷰 질문을 생성한다.
export const generateInterviewQuestions = async (opts: {
  apiKey: string;
  model: ModelId;
  files: InputFiles;
  seed: string;
}): Promise<InterviewQuestion[]> => {
  const { apiKey, model, files, seed } = opts;
  const ai = new GoogleGenAI({ apiKey });

  const parts: any[] = [];
  parts.push({
    text:
      '당신은 사업계획서 작성을 도와주는 친절한 인터뷰어입니다. 창업 경험이 없는 사람도 막힘없이 답할 수 있도록 쉬운 질문을 준비합니다.',
  });
  parts.push(...(await buildContextParts(files)));
  parts.push({
    text: `\n\n[사용자가 적은 한 줄 아이디어]\n${seed || '(아직 작성하지 않음)'}\n\n[지침]
1. 위 모집공고/양식/기준 자료가 있으면 그 평가 항목과 요구사항을 충족하는 데 꼭 필요한 정보를 묻도록 질문을 맞춤 설계하세요. 자료가 없으면 일반적인 정부지원사업/투자용 사업계획서에 필요한 핵심을 묻습니다.
2. 질문은 6~9개. 전문 용어를 피하고 일상어로, 한 번에 하나만 답하면 되는 단일 질문으로 작성하세요.
3. 각 질문에는 답을 돕는 짧은 도움말(hint)과 구체적인 예시 답변(example)을 포함하세요.
4. 사업 아이템, 해결하는 문제, 솔루션/핵심기능, 목표 고객/시장, 경쟁사 대비 차별점, 수익 모델, 팀, 자금 사용, 향후 계획 등이 골고루 다뤄지도록 하되 자료에 맞게 조정하세요.
5. 반드시 아래 JSON 스키마에 맞는 JSON만 출력하세요. 다른 설명은 금지합니다.

{ "questions": [ { "question": string, "hint": string, "example": string } ] }`,
  });

  const response = await ai.models.generateContent({
    model,
    contents: { parts },
    config: { responseMimeType: 'application/json' },
  });

  const raw = stripCodeFence((response as any).text || '');
  let parsed: { questions?: InterviewQuestion[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('질문을 생성하지 못했습니다. 다시 시도해주세요.');
    parsed = JSON.parse(raw.slice(start, end + 1));
  }
  const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
  return questions
    .filter(q => q && typeof q.question === 'string' && q.question.trim())
    .map(q => ({ question: q.question.trim(), hint: q.hint?.trim(), example: q.example?.trim() }));
};

// 작성된 초안을 평가기준에 맞춰 채점하고 개선점을 반환한다.
export const evaluateDraft = async (opts: {
  apiKey: string;
  model: ModelId;
  files: InputFiles;
  draft: string;
}): Promise<Evaluation> => {
  const { apiKey, model, files, draft } = opts;
  const ai = new GoogleGenAI({ apiKey });

  const parts: any[] = [];
  parts.push({
    text:
      '당신은 정부지원사업 서류평가를 담당하는 까다로운 평가위원입니다. 아래에 제공되는 사업계획서를 냉정하고 객관적으로 평가하세요.',
  });
  parts.push(...(await buildContextParts(files)));
  parts.push({
    text: `\n\n[평가 대상 사업계획서]\n${draft}\n\n[평가 지침]
1. '운영 기준 항목' 또는 '모집공고 양식'에 평가 기준이 있으면 그 기준을 그대로 사용하고, 없으면 일반적인 정부지원사업 평가 기준(문제인식/창업아이템의 적정성, 실현가능성, 성장전략 및 시장성, 팀 구성 및 역량)을 사용하세요.
2. 각 평가 항목별로 점수(score)와 만점(maxScore), 평가 코멘트(evaluation), 구체적인 개선 방향(improvement)을 제시하세요.
3. totalScore는 100점 만점으로 환산한 종합 점수입니다.
4. weakestSections에는 가장 보강이 시급한 사업계획서 섹션(목차) 제목을 1~3개 담으세요. 가능하면 사업계획서에 실제로 등장한 제목 그대로 적으세요.
5. 반드시 아래 JSON 스키마에 정확히 맞는 JSON만 출력하세요. 다른 설명은 절대 출력하지 마세요.

{
  "totalScore": number,
  "summary": string,
  "items": [{ "name": string, "score": number, "maxScore": number, "evaluation": string, "improvement": string }],
  "weakestSections": [string]
}`,
  });

  const response = await ai.models.generateContent({
    model,
    contents: { parts },
    config: { responseMimeType: 'application/json' },
  });

  const raw = stripCodeFence((response as any).text || '');
  let parsed: Evaluation;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // 혹시 앞뒤에 텍스트가 섞이면 첫 { 부터 마지막 } 까지만 잘라 재시도
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('평가 결과를 해석하지 못했습니다. 다시 시도해주세요.');
    parsed = JSON.parse(raw.slice(start, end + 1));
  }
  return {
    totalScore: Number(parsed.totalScore) || 0,
    summary: parsed.summary || '',
    items: Array.isArray(parsed.items) ? parsed.items : [],
    weakestSections: Array.isArray(parsed.weakestSections) ? parsed.weakestSections : [],
  };
};

// 특정 섹션만 다시 작성한다. 제목을 포함한 섹션 마크다운을 반환한다.
export const regenerateSection = async (opts: {
  apiKey: string;
  model: ModelId;
  files: InputFiles;
  fullDraft: string;
  sectionHeading: string;
  sectionContent: string;
  instruction: string;
}): Promise<string> => {
  const { apiKey, model, files, fullDraft, sectionHeading, sectionContent, instruction } = opts;
  const ai = new GoogleGenAI({ apiKey });

  const parts: any[] = [];
  parts.push({ text: `${WRITER_PERSONA}\n\n아래는 작성 중인 사업계획서 전체입니다. 이 중 특정 한 섹션만 다시 작성합니다.` });
  parts.push(...(await buildContextParts(files)));
  parts.push({
    text: `\n\n[사업계획서 전체 (맥락 참고용)]\n${fullDraft}\n\n[다시 작성할 섹션 제목]\n${sectionHeading}\n\n[해당 섹션의 기존 내용]\n${sectionContent}\n\n[수정 요청]\n${instruction || '더 구체적이고 설득력 있게, 정량 지표와 근거를 보강하여 다시 작성해주세요.'}\n\n${FORMAT_RULES}\n\n[출력 규칙] 위 '다시 작성할 섹션'의 제목(머리말 포함)과 본문만 출력하세요. 다른 섹션이나 인사말은 절대 출력하지 마세요.`,
  });

  const response = await ai.models.generateContent({ model, contents: { parts } });
  return normalizeBold(stripCodeFence((response as any).text || ''));
};

// 전체 초안을 자연어 요청에 맞게 수정하여 전체 본문을 반환한다(대화형 보완).
export const refineDraft = async (opts: {
  apiKey: string;
  model: ModelId;
  files: InputFiles;
  fullDraft: string;
  instruction: string;
  onChunk?: (accumulated: string) => void;
}): Promise<string> => {
  const { apiKey, model, files, fullDraft, instruction, onChunk } = opts;
  const ai = new GoogleGenAI({ apiKey });

  const parts: any[] = [];
  parts.push({ text: `${WRITER_PERSONA}\n\n아래 사업계획서를 사용자의 요청에 맞게 수정합니다.` });
  parts.push(...(await buildContextParts(files)));
  parts.push({
    text: `\n\n[현재 사업계획서]\n${fullDraft}\n\n[수정 요청]\n${instruction}\n\n${FORMAT_RULES}\n\n[출력 규칙] 요청을 반영한 사업계획서 '전체'를 처음부터 끝까지 다시 출력하세요. 인사말이나 설명 없이 본문만 출력하세요.`,
  });

  const stream = await ai.models.generateContentStream({ model, contents: { parts } });
  let acc = '';
  for await (const chunk of stream) {
    const t = (chunk as any).text || '';
    if (t) {
      acc += t;
      onChunk?.(acc);
    }
  }
  return normalizeBold(acc);
};
