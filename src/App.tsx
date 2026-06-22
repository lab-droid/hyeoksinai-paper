import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Key, CheckCircle2, XCircle, Loader2, FileText, Info, PenTool, Send, Briefcase, Copy, Download,
  Check, ShieldCheck, Eye, EyeOff, AlertTriangle, ExternalLink, X, Pencil, RefreshCw,
  Save, FolderOpen, Trash2, FileType2, Printer, MessageSquarePlus, ListChecks, Sparkles,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { motion } from 'motion/react';
import { marked } from 'marked';

import FileUploadSection from './components/FileUploadSection';
import ContentAnalyzer, { compileContentForm } from './components/ContentAnalyzer';
import EvaluationPanel from './components/EvaluationPanel';
import {
  generatePlanStream, evaluateDraft, regenerateSection, refineDraft, translateError,
  analyzeContentForm,
  type Evaluation, type InputFiles, type ModelId, type ContentField,
} from './lib/gemini';
import { parseSections, sectionToMarkdown, sectionsToMarkdown, sectionTitle } from './lib/sections';
import { listProjects, saveProject, deleteProject, type SavedProject } from './lib/storage';
import { downloadDocx, downloadWordHtml, exportPdf } from './lib/export';

type View = 'input' | 'generating' | 'result' | 'guide';
type GenLabel = '생성' | '수정' | '보강' | '보완';

export default function App() {
  const [apiKey, setApiKey] = useState('');
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [isPatchNotesOpen, setIsPatchNotesOpen] = useState(false);
  const [tempKey, setTempKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  const [announcementFiles, setAnnouncementFiles] = useState<File[]>([]);
  const [templateFiles, setTemplateFiles] = useState<File[]>([]);
  const [infoFiles, setInfoFiles] = useState<File[]>([]);
  const [criteriaFiles, setCriteriaFiles] = useState<File[]>([]);

  const [inputMode, setInputMode] = useState<'analyze' | 'simple'>('analyze');
  const [content, setContent] = useState('');

  // AI 분석 → 전반적인 내용 양식
  const [analyzeSeed, setAnalyzeSeed] = useState('');
  const [contentAnalysis, setContentAnalysis] = useState('');
  const [contentFields, setContentFields] = useState<ContentField[]>([]);
  const [contentAnswers, setContentAnswers] = useState<Record<number, string>>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [currentView, setCurrentView] = useState<View>('input');
  const [genLabel, setGenLabel] = useState<GenLabel>('생성');
  const [streamingText, setStreamingText] = useState('');
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  // 항상 최고 품질 모델 사용 (모델 선택 UI 제거됨)
  const selectedModel: ModelId = 'gemini-3.1-pro-preview';

  // 평가
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  // 섹션 편집/재생성
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBuffer, setEditBuffer] = useState('');
  const [regenForId, setRegenForId] = useState<string | null>(null);
  const [regenText, setRegenText] = useState('');
  const [busySectionId, setBusySectionId] = useState<string | null>(null);

  // 대화형 보완
  const [refineInput, setRefineInput] = useState('');

  // 보장형 개선 결과 알림(점수 변화)
  const [improveNotice, setImproveNotice] = useState<{ before: number; after: number; improved: boolean; message: string } | null>(null);

  // 프로젝트 저장/불러오기
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | undefined>(undefined);
  const [isProjectsOpen, setIsProjectsOpen] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const streamRef = useRef<HTMLDivElement>(null);

  const sections = useMemo(() => parseSections(result), [result]);
  const inputFiles: InputFiles = { announcementFiles, templateFiles, infoFiles, criteriaFiles };

  const patchNotes = [
    {
      date: '2026-06-22',
      title: '보장형 개선 — 보강/수정 시 점수 향상 보장',
      details: [
        '평가 후 보강/대화형 수정 시 개선본을 자동 재채점',
        '점수가 오른 경우에만 채택하여 결과가 더 낮아지지 않도록 보장',
        '점수 변화(이전 → 이후) 알림 배너 추가',
        '평가/분석 JSON 파싱 오류 수정(구조화 출력)',
      ],
    },
    {
      date: '2026-06-21',
      title: '처음부터 마무리까지 — 올인원 대규모 업데이트',
      details: [
        'AI 평가위원 자가 채점(항목별 점수·개선점·보강 버튼) 추가',
        '실시간 스트리밍 생성 + 섹션별 다시쓰기/편집 기능',
        '대화형 보완(요청으로 전체 수정) 추가',
        '정식 .docx 및 PDF 내보내기 추가',
        '프로젝트 저장/불러오기(브라우저 보관) 추가',
        '가이드형 입력 위저드(단계별 항목 입력) 추가',
      ],
    },
    {
      date: '2026-04-19',
      title: '패치노트 및 API 비용 안내 추가',
      details: ['상단 헤더에 패치노트 확인 기능 추가', '예상 API 사용 비용(KRW) 안내 섹션 추가', 'UI 레이아웃 최적화'],
    },
    {
      date: '2026-03-24',
      title: '입력 방식 개편 및 운영 기준 추가',
      details: ['운영 기준 항목(파일 첨부) 추가', '모든 입력 항목을 파일 첨부 중심으로 UI 전면 개편', '전반적인 내용(필수) 항목의 편의성 개선', '홈 이동 시 데이터 초기화 로직 보강'],
    },
    {
      date: '2026-03-22',
      title: '모델 선택 및 사용 가이드 추가',
      details: ['Pro / Flash 모델 선택 기능 추가 (할당량 대응)', '상단 네비게이션(홈, 사용방법) 추가 및 가이드 페이지 구현', 'API 할당량 초과(429) 및 오류 메시지 시각화 개선', '헤더 로고 클릭 시 홈 이동 기능 추가'],
    },
    {
      date: '2026-03-21',
      title: '출력 포맷 및 시각화 강화',
      details: ['표(Table) 테두리 선 및 스타일 적용 (Typography 플러그인)', '강조 텍스트 색상 및 Bold 자동 적용', '이미지 삽입 가이드 Placeholder 생성 로직 추가', '생성 진행률 시각화 및 화면 전환 UX 적용'],
    },
    {
      date: '2026-03-15',
      title: '초기 런칭',
      details: ['Gemini AI 기반 고득점 사업계획서 생성 엔진 탑재', 'PDF, DOCX, HWP 파일 분석 기능', 'Word 다운로드 및 클립보드 복사 기능'],
    },
  ];

  useEffect(() => {
    const storedKey = localStorage.getItem('gemini_api_key');
    if (storedKey) setApiKey(storedKey);
    else if (process.env.GEMINI_API_KEY) setApiKey(process.env.GEMINI_API_KEY);
    setProjects(listProjects());
  }, []);

  useEffect(() => {
    if (currentView === 'generating' && streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [streamingText, currentView]);

  const handleSaveKey = () => {
    const trimmed = tempKey.trim();
    setApiKey(trimmed);
    setTempKey(trimmed);
    localStorage.setItem('gemini_api_key', trimmed);
    setIsKeyModalOpen(false);
  };

  const requireKey = (): boolean => {
    if (!apiKey) {
      setError('API Key를 입력해주세요.');
      setTempKey(apiKey);
      setShowKey(false);
      setIsKeyModalOpen(true);
      return false;
    }
    return true;
  };

  // ── AI 분석 → 전반적인 내용 양식 생성 ──
  const handleAnalyze = async () => {
    if (templateFiles.length === 0) { setError("먼저 '사업계획서 양식(필수)'을 업로드해주세요."); return; }
    if (!requireKey()) return;
    setError('');
    setIsAnalyzing(true);
    try {
      const res = await analyzeContentForm({ apiKey, model: selectedModel, files: inputFiles, seed: analyzeSeed });
      if (res.fields.length === 0) { setError('양식을 만들지 못했습니다. 다시 시도해주세요.'); return; }
      setContentAnalysis(res.analysis);
      setContentFields(res.fields);
      setContentAnswers({});
    } catch (err: any) {
      console.error('Analyze Error:', err);
      setError(translateError(err));
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ── 전체 생성 ──
  const handleGenerate = async () => {
    if (templateFiles.length === 0) { setError('사업계획서 양식을 파일로 첨부해주세요.'); return; }
    const compiledContent =
      inputMode === 'analyze' ? compileContentForm(analyzeSeed, contentFields, contentAnswers)
      : content;
    if (!compiledContent.trim()) {
      setError(
        inputMode === 'analyze'
          ? '먼저 분석으로 양식을 만들고, 한 줄 아이디어나 항목을 하나 이상 작성해주세요.'
          : '전반적인 내용을 입력해주세요.',
      );
      return;
    }
    if (!requireKey()) return;

    setError('');
    setEvaluation(null);
    setImproveNotice(null);
    setCurrentProjectId(undefined);
    setGenLabel('생성');
    setStreamingText('');
    setCurrentView('generating');

    try {
      const text = await generatePlanStream({
        apiKey, model: selectedModel, files: inputFiles, content: compiledContent,
        onChunk: setStreamingText,
      });
      setResult(text);
      setCurrentView('result');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error('Generation Error:', err);
      setError(translateError(err));
      setCurrentView('input');
    }
  };

  // ── 자가 평가 ──
  const handleEvaluate = async () => {
    if (!requireKey() || !result) return;
    setIsEvaluating(true);
    try {
      const evalResult = await evaluateDraft({ apiKey, model: selectedModel, files: inputFiles, draft: result });
      setEvaluation(evalResult);
    } catch (err: any) {
      console.error('Evaluation Error:', err);
      setError(translateError(err));
    } finally {
      setIsEvaluating(false);
    }
  };

  // ── 섹션 재생성(공통) ──
  const replaceSectionMarkdown = (index: number, newMarkdown: string) => {
    const arr = sections.map(sectionToMarkdown);
    arr[index] = newMarkdown.trim();
    setResult(arr.join('\n\n').replace(/\n{3,}/g, '\n\n').trim());
  };

  const runRegenerate = async (sectionId: string, instruction: string) => {
    if (!requireKey()) return;
    const index = sections.findIndex(s => s.id === sectionId);
    if (index < 0) return;
    const section = sections[index];
    setBusySectionId(sectionId);
    setRegenForId(null);
    setRegenText('');
    try {
      const newMd = await regenerateSection({
        apiKey, model: selectedModel, files: inputFiles, fullDraft: result,
        sectionHeading: sectionTitle(section), sectionContent: sectionToMarkdown(section), instruction,
      });
      if (newMd.trim()) replaceSectionMarkdown(index, newMd);
    } catch (err: any) {
      console.error('Section Regen Error:', err);
      setError(translateError(err));
    } finally {
      setBusySectionId(null);
    }
  };

  // 평가 피드백을 텍스트로 요약(개선 프롬프트용)
  const feedbackText = (ev: Evaluation): string => {
    const lines = ev.items
      .filter(i => i.improvement?.trim())
      .map(i => `- [${i.name}] ${i.improvement.trim()}`);
    if (ev.weakestSections.length) lines.push(`- 특히 보강 필요 섹션: ${ev.weakestSections.join(', ')}`);
    return lines.length
      ? `현재 평가(${Math.round(ev.totalScore)}점)의 개선 피드백:\n${lines.join('\n')}`
      : `현재 ${Math.round(ev.totalScore)}점. 전반적으로 더 설득력 있게 보강하세요.`;
  };

  // ── 보장형 개선 루프 ──
  // 개선본을 만든 뒤 자동 재채점하여, 점수가 오른 경우에만 채택한다(결과가 절대 더 낮아지지 않음).
  // keepChangeIfNoGain=true면(대화형 보완) 점수가 오르지 않아도 사용자가 요청한 변경본 중 최고 점수본을 채택한다.
  const runImprovement = async (
    makeCandidate: (feedback: Evaluation) => Promise<string>,
    opts: { label: GenLabel; keepChangeIfNoGain?: boolean },
  ) => {
    if (!result || !requireKey()) return;
    setError('');
    setImproveNotice(null);
    setGenLabel(opts.label);
    setStreamingText('현재 점수를 확인하는 중...');
    setCurrentView('generating');

    const MAX = 3;
    try {
      // 기준 점수(이미 평가했으면 재사용, 아니면 새로 채점)
      let baseEval = evaluation ?? await evaluateDraft({ apiKey, model: selectedModel, files: inputFiles, draft: result });
      const beforeScore = baseEval.totalScore;

      let bestDraft = result;
      let bestEval = baseEval;             // 원본 대비 게이트(절대 더 낮아지지 않음)
      let bestCandDraft: string | null = null;
      let bestCandEval: Evaluation | null = null;  // 변경이 적용된 후보 중 최고(대화형 보완용)
      let improved = false;

      for (let attempt = 1; attempt <= MAX; attempt++) {
        setStreamingText(`${opts.label} 중... (${attempt}/${MAX}차 시도)\n현재 최고 점수: ${Math.round(bestEval.totalScore)}점`);
        const candidate = await makeCandidate(bestEval);
        if (!candidate.trim()) continue;

        setStreamingText(`개선본을 평가위원이 채점하는 중... (${attempt}/${MAX}차 시도)`);
        const candEval = await evaluateDraft({ apiKey, model: selectedModel, files: inputFiles, draft: candidate });

        if (!bestCandEval || candEval.totalScore > bestCandEval.totalScore) {
          bestCandDraft = candidate; bestCandEval = candEval;
        }
        if (candEval.totalScore > bestEval.totalScore) {
          bestDraft = candidate; bestEval = candEval; improved = true;
          break; // 점수 상승 → 채택
        }
      }

      if (improved) {
        setResult(bestDraft); setEvaluation(bestEval);
        setImproveNotice({ before: Math.round(beforeScore), after: Math.round(bestEval.totalScore), improved: true, message: '평가 점수가 향상되었습니다.' });
      } else if (opts.keepChangeIfNoGain && bestCandDraft && bestCandEval) {
        // 요청한 변경은 반영하되(최고 점수본), 점수가 오르지 않았음을 알림
        setResult(bestCandDraft); setEvaluation(bestCandEval);
        setImproveNotice({ before: Math.round(beforeScore), after: Math.round(bestCandEval.totalScore), improved: bestCandEval.totalScore > beforeScore, message: '요청을 반영했습니다. 추가로 점수를 더 높이려면 한 번 더 시도해주세요.' });
      } else {
        // 보강(점수 게이트): 더 높이지 못하면 원본 유지(절대 더 낮아지지 않음)
        setEvaluation(bestEval);
        setImproveNotice({ before: Math.round(beforeScore), after: Math.round(bestEval.totalScore), improved: false, message: `${MAX}회 시도했지만 더 높은 점수를 내지 못해 기존 결과를 유지했습니다. 다시 시도하면 개선될 수 있습니다.` });
      }
      setCurrentView('result');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error('Improvement Error:', err);
      setError(translateError(err));
      setCurrentView('result');
    }
  };

  // 평가 패널의 '보강' 버튼: 해당 섹션을 피드백 기반으로 개선하되, 점수가 오를 때만 채택
  const handleReinforce = (sectionName: string) => {
    const target = sections.find(s => sectionTitle(s).includes(sectionName) || sectionName.includes(sectionTitle(s)));
    if (!target) { setError(`'${sectionName}' 섹션을 본문에서 찾지 못했습니다. 해당 섹션의 '다시쓰기'를 직접 사용해주세요.`); return; }
    const index = sections.findIndex(s => s.id === target.id);
    const baseArr = sections.map(sectionToMarkdown); // 원본 섹션 배열(루프 동안 고정)
    runImprovement(
      async (feedback) => {
        const newMd = await regenerateSection({
          apiKey, model: selectedModel, files: inputFiles, fullDraft: result,
          sectionHeading: sectionTitle(target), sectionContent: baseArr[index],
          instruction: `${feedbackText(feedback)}\n\n위 피드백을 반영하여 이 섹션을 보강하되, 반드시 이전보다 더 높은 평가 점수를 받도록 정량 지표·구체적 근거·차별성·실현가능성을 강화하세요.`,
        });
        if (!newMd.trim()) return '';
        const arr = [...baseArr];
        arr[index] = newMd.trim();
        return arr.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
      },
      { label: '보강' },
    );
  };

  // ── 인라인 편집 ──
  const startEdit = (id: string, markdown: string) => { setEditingId(id); setEditBuffer(markdown); };
  const saveEdit = () => {
    if (!editingId) return;
    const index = sections.findIndex(s => s.id === editingId);
    if (index >= 0) replaceSectionMarkdown(index, editBuffer);
    setEditingId(null);
    setEditBuffer('');
  };

  // ── 대화형 보완(전체 수정) ── 요청을 반영하되 점수가 더 높아지도록 개선 루프 적용
  const handleRefine = async () => {
    const instruction = refineInput.trim();
    if (!instruction || !result) return;
    if (!requireKey()) return;
    setRefineInput('');
    await runImprovement(
      async (feedback) => refineDraft({
        apiKey, model: selectedModel, files: inputFiles, fullDraft: result,
        instruction: `${instruction}\n\n또한 아래 평가 피드백을 반영하여, 위 요청을 충실히 반영하면서도 전체적으로 반드시 더 높은 점수를 받도록 보강하세요:\n${feedbackText(feedback)}`,
        onChunk: setStreamingText,
      }),
      { label: '수정', keepChangeIfNoGain: true },
    );
  };

  // ── 복사: 화면 서식 그대로 클립보드 ──
  const styledHtml = (): string => {
    const html = marked.parse(result, { async: false, gfm: true }) as string;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('table').forEach(t => t.setAttribute('style', 'border-collapse:collapse;width:100%;margin:1em 0;'));
    doc.querySelectorAll('th').forEach(c => c.setAttribute('style', 'border:1px solid #d4d4d4;background:#f5f5f5;padding:8px;text-align:left;'));
    doc.querySelectorAll('td').forEach(c => c.setAttribute('style', 'border:1px solid #d4d4d4;padding:8px;vertical-align:top;'));
    return `<div style="font-family:'Malgun Gothic','맑은 고딕',sans-serif;line-height:1.7;color:#374151;">${doc.body.innerHTML}</div>`;
  };

  const handleCopy = async () => {
    try {
      const html = styledHtml();
      const plain = new DOMParser().parseFromString(html, 'text/html').body.innerText;
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([plain], { type: 'text/plain' }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(plain);
      }
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  // ── 프로젝트 저장/불러오기 ──
  const handleSaveProject = () => {
    if (!result) return;
    const name =
      analyzeSeed.trim() ||
      (content.split('\n')[0] || '').slice(0, 40).trim() ||
      (sections[0] ? sectionTitle(sections[0]) : '') ||
      '제목 없는 사업계획서';
    const saved = saveProject({
      id: currentProjectId, name, content,
      result, evaluation, model: selectedModel,
    });
    setCurrentProjectId(saved.id);
    setProjects(listProjects());
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  };

  const handleLoadProject = (p: SavedProject) => {
    setContent(p.content);
    setInputMode('simple');
    setResult(p.result);
    setEvaluation(p.evaluation);
    setCurrentProjectId(p.id);
    setIsProjectsOpen(false);
    setCurrentView('result');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteProject = (id: string) => {
    deleteProject(id);
    setProjects(listProjects());
    if (currentProjectId === id) setCurrentProjectId(undefined);
  };

  const handleGoHome = () => {
    setCurrentView('input');
    setAnnouncementFiles([]); setTemplateFiles([]); setInfoFiles([]); setCriteriaFiles([]);
    setContent(''); setResult(''); setEvaluation(null); setImproveNotice(null);
    setAnalyzeSeed(''); setContentAnalysis(''); setContentFields([]); setContentAnswers({});
    setCurrentProjectId(undefined); setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-neutral-200 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-8">
          <button onClick={handleGoHome} className="flex items-center gap-2 hover:opacity-80 transition-opacity text-left">
            <FileText className="w-6 h-6 text-neutral-800" />
            <h1 className="text-xl font-bold tracking-tight text-neutral-900 hidden lg:block">혁신 사업계획서 작성 AI</h1>
          </button>
          <nav className="flex items-center gap-6">
            <button onClick={handleGoHome} className={`text-sm font-semibold transition-colors ${currentView !== 'guide' ? 'text-neutral-900' : 'text-neutral-500 hover:text-neutral-900'}`}>홈</button>
            <button onClick={() => { setIsProjectsOpen(true); setProjects(listProjects()); }} className="text-sm font-semibold text-neutral-500 hover:text-neutral-900 transition-colors hidden sm:block">내 사업계획서</button>
            <button onClick={() => { setCurrentView('guide'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`text-sm font-semibold transition-colors ${currentView === 'guide' ? 'text-neutral-900' : 'text-neutral-500 hover:text-neutral-900'}`}>사용방법</button>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex flex-col items-end mr-2 text-[10px] text-neutral-500">
            <div className="flex items-center gap-1">
              <span className="font-bold text-neutral-700">예상 API 비용:</span>
              <span>약 0원 ~ 600원</span>
            </div>
            <p className="opacity-70 whitespace-nowrap">※ 결과물 길이에 따라 오차 발생 가능</p>
          </div>
          <button onClick={() => setIsPatchNotesOpen(true)} className="flex items-center gap-2 px-3 py-2 rounded-full bg-neutral-100 hover:bg-neutral-200 transition-colors text-xs font-semibold text-neutral-700">패치노트</button>
          <button onClick={() => { setTempKey(apiKey); setShowKey(false); setIsKeyModalOpen(true); }} className="flex items-center gap-2 px-3 py-2 rounded-full bg-neutral-100 hover:bg-neutral-200 transition-colors text-xs font-bold shrink-0">
            <Key className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">API Key</span>
            {apiKey ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <XCircle className="w-3.5 h-3.5 text-red-500" />}
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-5">
        {currentView === 'input' && (
          <>
            {/* Hero (심플 배너) */}
            <section className="rounded-2xl bg-gradient-to-br from-neutral-900 to-neutral-700 px-7 py-7">
              <motion.h2 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-2xl md:text-3xl font-bold text-white mb-2 tracking-tight">혁신 사업계획서 작성 AI</motion.h2>
              <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-sm text-neutral-300 max-w-2xl leading-relaxed">자료를 올리면 AI가 <strong className="text-white">무엇을 써야 할지 분석</strong>해 양식을 만들고, 작성·평가·수정·내보내기까지 한 번에 완성합니다.</motion.p>
            </section>

            {/* STEP 1 — 자료 업로드 */}
            <section className="bg-white rounded-2xl border border-neutral-200 p-5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-bold text-white bg-neutral-900 rounded-md px-2 py-0.5">STEP 1</span>
                <h3 className="font-bold text-neutral-900">자료 업로드</h3>
              </div>
              <p className="text-xs text-neutral-500 mb-4">‘사업계획서 양식’만 필수예요. 나머지는 올릴수록 결과가 정확해집니다.</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <FileUploadSection title="사업계획서 양식" icon={FileText} colorClass="text-indigo-600" files={templateFiles} setFiles={setTemplateFiles} required />
                <FileUploadSection title="모집공고 양식" icon={Briefcase} colorClass="text-blue-600" files={announcementFiles} setFiles={setAnnouncementFiles} />
                <FileUploadSection title="사업계획서 관련 정보" icon={Info} colorClass="text-emerald-600" files={infoFiles} setFiles={setInfoFiles} />
                <FileUploadSection title="운영 기준 항목" icon={ShieldCheck} colorClass="text-purple-600" files={criteriaFiles} setFiles={setCriteriaFiles} />
              </div>
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-3 flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />HWP·DOCX는 텍스트만 추출됩니다. 정확도를 위해 <strong>PDF로 변환 후 업로드</strong>를 권장합니다.
              </p>
            </section>

            {/* STEP 2 — 전반적인 내용 */}
            <section className="bg-white rounded-2xl border border-neutral-200 p-5">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-white bg-neutral-900 rounded-md px-2 py-0.5">STEP 2</span>
                  <PenTool className="w-4 h-4 text-rose-600" />
                  <h3 className="font-bold text-neutral-900">전반적인 내용</h3>
                </div>
                <div className="flex bg-neutral-100 p-1 rounded-lg">
                  <button onClick={() => setInputMode('analyze')} className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${inputMode === 'analyze' ? 'bg-white text-rose-600 shadow-sm' : 'text-neutral-500'}`}><Sparkles className="w-3.5 h-3.5" />AI 분석</button>
                  <button onClick={() => setInputMode('simple')} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${inputMode === 'simple' ? 'bg-white text-rose-600 shadow-sm' : 'text-neutral-500'}`}>직접 입력</button>
                </div>
              </div>
              {inputMode === 'analyze' ? (
                <ContentAnalyzer
                  seed={analyzeSeed} setSeed={setAnalyzeSeed}
                  analysis={contentAnalysis} fields={contentFields}
                  answers={contentAnswers} setAnswers={setContentAnswers}
                  isAnalyzing={isAnalyzing} hasTemplate={templateFiles.length > 0}
                  onAnalyze={handleAnalyze}
                />
              ) : (
                <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="사업의 배경, 해결하고자 하는 문제, 우리만의 솔루션, 수익 모델 등 작성하고자 하는 내용을 자유롭게 적어주세요." className="w-full min-h-[160px] p-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none resize-none text-sm" />
              )}
            </section>

            {/* STEP 3 — 생성 */}
            <section className="bg-white rounded-2xl border border-neutral-200 p-5">
              <button onClick={handleGenerate} className="w-full py-3.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all">
                <Send className="w-5 h-5" />
                사업계획서 완성하기
              </button>
              {error && <p className="text-red-500 text-sm text-center font-medium mt-3">{error}</p>}
            </section>
          </>
        )}

        {currentView === 'generating' && (
          <div className="flex flex-col items-center min-h-[60vh] space-y-6 pt-6">
            <div className="flex flex-col items-center">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
              <h2 className="text-2xl font-bold text-neutral-900 mb-1">고득점 사업계획서 {genLabel} 중...</h2>
              <p className="text-neutral-500 text-center text-sm">AI가 실시간으로 작성하고 있습니다. 잠시만 기다려주세요.</p>
            </div>
            <div ref={streamRef} className="w-full max-w-3xl h-[50vh] overflow-y-auto bg-white border border-neutral-200 rounded-2xl p-6 text-sm text-neutral-700 whitespace-pre-wrap leading-relaxed shadow-sm">
              {streamingText || '...'}
            </div>
          </div>
        )}

        {currentView === 'result' && result && (
          <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* 보장형 개선 결과 알림 */}
            {improveNotice && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                className={`flex items-center justify-between gap-3 rounded-2xl border px-5 py-3 ${improveNotice.improved ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-bold ${improveNotice.improved ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {improveNotice.before}점 {improveNotice.improved ? '→' : '·'} <span className="text-base">{improveNotice.after}점</span>
                    {improveNotice.improved && ' ↑'}
                  </span>
                  <span className="text-sm text-neutral-600">{improveNotice.message}</span>
                </div>
                <button onClick={() => setImproveNotice(null)} className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg"><X className="w-4 h-4" /></button>
              </motion.div>
            )}
            {/* 결과 헤더 + 액션 */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-neutral-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button onClick={() => setCurrentView('input')} className="p-2 hover:bg-neutral-100 rounded-full transition-colors" title="입력으로 돌아가기"><X className="w-5 h-5 text-neutral-500" /></button>
                <h3 className="text-xl font-bold text-neutral-900">생성된 사업계획서</h3>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={handleSaveProject} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium text-sm transition-colors">
                  {justSaved ? <Check className="w-4 h-4 text-emerald-600" /> : <Save className="w-4 h-4" />}{justSaved ? '저장됨' : '저장'}
                </button>
                <button onClick={handleCopy} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium text-sm transition-colors">
                  {isCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}{isCopied ? '복사됨' : '복사'}
                </button>
                <button onClick={() => downloadDocx(result)} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors"><FileType2 className="w-4 h-4" />Word(.docx)</button>
                <button onClick={() => downloadWordHtml(result)} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium text-sm transition-colors"><Download className="w-4 h-4" />.doc</button>
                <button onClick={() => exportPdf(result)} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-medium text-sm transition-colors"><Printer className="w-4 h-4" />PDF</button>
                <a href="https://docs.google.com/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition-colors"><ExternalLink className="w-4 h-4" />Docs</a>
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6 items-start">
              {/* 본문(섹션별) */}
              <div className="lg:col-span-2 bg-white p-6 md:p-10 rounded-3xl shadow-sm border border-neutral-200 space-y-2">
                <p className="text-xs text-neutral-400 mb-4 flex items-center gap-1.5"><ListChecks className="w-3.5 h-3.5" />각 섹션 위에 마우스를 올리면 편집·다시쓰기 버튼이 나타납니다.</p>
                {sections.map((s, idx) => (
                  <div key={s.id} className="group relative rounded-xl -mx-2 px-2 py-1 hover:bg-neutral-50/80 transition-colors">
                    {busySectionId === s.id && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 rounded-xl">
                        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                      </div>
                    )}
                    {editingId === s.id ? (
                      <div className="space-y-2 py-2">
                        <textarea value={editBuffer} onChange={(e) => setEditBuffer(e.target.value)} className="w-full min-h-[200px] p-3 bg-neutral-50 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono" />
                        <div className="flex gap-2">
                          <button onClick={saveEdit} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">저장</button>
                          <button onClick={() => { setEditingId(null); setEditBuffer(''); }} className="px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-600 text-sm font-semibold hover:bg-neutral-200">취소</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="prose prose-neutral max-w-none prose-headings:font-bold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-p:text-neutral-700 prose-li:text-neutral-700 prose-table:border-collapse prose-table:w-full prose-th:border prose-th:border-neutral-300 prose-th:bg-neutral-100 prose-th:p-3 prose-td:border prose-td:border-neutral-300 prose-td:p-3">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{sectionToMarkdown(s)}</ReactMarkdown>
                        </div>
                        <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          <button onClick={() => startEdit(s.id, sectionToMarkdown(s))} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-neutral-200 shadow-sm text-xs font-medium text-neutral-600 hover:bg-neutral-50" title="직접 편집"><Pencil className="w-3 h-3" />편집</button>
                          <button onClick={() => { setRegenForId(regenForId === s.id ? null : s.id); setRegenText(''); }} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-neutral-200 shadow-sm text-xs font-medium text-indigo-600 hover:bg-indigo-50" title="AI로 다시쓰기"><RefreshCw className="w-3 h-3" />다시쓰기</button>
                        </div>
                        {regenForId === s.id && (
                          <div className="mt-2 flex flex-col sm:flex-row gap-2 bg-indigo-50 border border-indigo-100 rounded-xl p-2">
                            <input value={regenText} onChange={(e) => setRegenText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') runRegenerate(s.id, regenText); }} placeholder="예: 표로 정리하고 정량 목표(KPI)를 추가해줘 (비우면 자동 보강)" className="flex-1 px-3 py-2 rounded-lg border border-indigo-200 outline-none focus:ring-2 focus:ring-indigo-400 text-sm" />
                            <button onClick={() => runRegenerate(s.id, regenText)} className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 whitespace-nowrap">다시쓰기 실행</button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
                {error && <p className="text-red-500 text-sm font-medium mt-3">{error}</p>}
              </div>

              {/* 사이드: 평가 + 대화형 보완 */}
              <div className="space-y-6 lg:sticky lg:top-24">
                <EvaluationPanel evaluation={evaluation} isEvaluating={isEvaluating} onEvaluate={handleEvaluate} onReinforce={handleReinforce} />

                <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <MessageSquarePlus className="w-5 h-5 text-rose-600" />
                    <h3 className="font-bold text-neutral-900">대화형 보완</h3>
                  </div>
                  <p className="text-xs text-neutral-500 mb-3 leading-relaxed">요청을 반영해 다시 다듬고, <strong className="text-rose-600">자동 재채점하여 더 높은 점수가 될 때까지 보완</strong>합니다. (예: "전체적으로 더 정량적으로", "리스크 대응 방안 항목 추가")</p>
                  <textarea value={refineInput} onChange={(e) => setRefineInput(e.target.value)} placeholder="수정 요청을 입력하세요..." className="w-full min-h-[80px] p-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-500 text-sm resize-none mb-2" />
                  <button onClick={handleRefine} disabled={!refineInput.trim()} className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-white text-sm font-semibold transition-colors"><Send className="w-4 h-4" />요청 반영하기</button>
                </div>
              </div>
            </div>
          </motion.section>
        )}

        {currentView === 'guide' && <GuideView />}
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200 bg-white py-8 mt-12">
        <div className="max-w-5xl mx-auto px-6 text-center text-neutral-500 text-sm">
          <p>Developed by <strong>정혁신</strong></p>
          <p className="mt-1">© {new Date().getFullYear()} 혁신 사업계획서 작성 AI. All rights reserved.</p>
        </div>
      </footer>

      {/* 프로젝트 드로어 */}
      {isProjectsOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end bg-black/40 backdrop-blur-sm" onClick={() => setIsProjectsOpen(false)}>
          <motion.div initial={{ x: 400 }} animate={{ x: 0 }} className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-neutral-100 flex justify-between items-center">
              <div className="flex items-center gap-2"><FolderOpen className="w-5 h-5 text-indigo-600" /><h3 className="text-lg font-bold text-neutral-900">내 사업계획서</h3></div>
              <button onClick={() => setIsProjectsOpen(false)} className="p-2 hover:bg-neutral-100 rounded-full"><X className="w-5 h-5 text-neutral-500" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {projects.length === 0 && <p className="text-sm text-neutral-400 text-center py-12">저장된 사업계획서가 없습니다.<br />결과 화면에서 '저장'을 누르면 여기에 보관됩니다.</p>}
              {projects.map(p => (
                <div key={p.id} className="border border-neutral-200 rounded-xl p-4 hover:border-indigo-300 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-neutral-900 truncate">{p.name}</p>
                      <p className="text-xs text-neutral-400 mt-0.5">{new Date(p.updatedAt).toLocaleString('ko-KR')}</p>
                    </div>
                    <button onClick={() => handleDeleteProject(p.id)} className="p-1.5 text-neutral-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 shrink-0"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <button onClick={() => handleLoadProject(p)} className="mt-3 w-full py-2 rounded-lg bg-indigo-50 text-indigo-700 text-sm font-semibold hover:bg-indigo-100 transition-colors">불러오기</button>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}

      {/* 패치노트 모달 */}
      {isPatchNotesOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-neutral-100 flex justify-between items-center">
              <div><h3 className="text-xl font-bold text-neutral-900">패치노트</h3><p className="text-sm text-neutral-500 mt-0.5">업데이트 내역 및 히스토리</p></div>
              <button onClick={() => setIsPatchNotesOpen(false)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors"><X className="w-5 h-5 text-neutral-500" /></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-8">
              {patchNotes.map((note, i) => (
                <div key={i} className="relative pl-6 border-l-2 border-neutral-100 last:border-0 pb-2">
                  <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-indigo-500" />
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase tracking-wider">{note.date}</span>
                    <h4 className="text-sm font-bold text-neutral-900">{note.title}</h4>
                  </div>
                  <ul className="space-y-1.5">
                    {note.details.map((detail, j) => (
                      <li key={j} className="text-sm text-neutral-600 flex items-start gap-2"><span className="mt-1.5 w-1 h-1 rounded-full bg-neutral-400 shrink-0" />{detail}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="p-4 bg-neutral-50 border-t border-neutral-100 text-center"><p className="text-xs text-neutral-400">더 나은 서비스를 위해 꾸준히 업데이트 중입니다.</p></div>
          </motion.div>
        </div>
      )}

      {/* API Key 모달 */}
      {isKeyModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-neutral-100">
              <h3 className="text-xl font-bold text-neutral-900">Google API Key 설정</h3>
              <p className="text-sm text-neutral-500 mt-1">Gemini API를 사용하기 위해 API Key를 입력해주세요. 키는 브라우저에만 안전하게 저장됩니다.</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">API Key</label>
                <div className="relative">
                  <input type={showKey ? 'text' : 'password'} value={tempKey} onChange={(e) => setTempKey(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && tempKey.trim()) handleSaveKey(); }} placeholder="AIzaSy..." autoComplete="off" spellCheck={false} className="w-full p-3 pr-12 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-sm" />
                  <button type="button" onClick={() => setShowKey(v => !v)} aria-label={showKey ? 'API Key 숨기기' : 'API Key 표시'} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-200/60 transition-colors">{showKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
                </div>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" /><span className="text-sm font-semibold text-amber-800">API Key 오류 방지 체크리스트</span></div>
                <ul className="space-y-1.5 text-xs text-amber-800 leading-relaxed list-disc pl-5">
                  <li><strong>Gemini API Key</strong>가 맞는지 확인하세요. (<code className="px-1 bg-amber-100 rounded">AIzaSy</code>로 시작)</li>
                  <li>키 <strong>앞뒤 공백·줄바꿈</strong>이 섞이지 않도록 정확히 복사하세요. (저장 시 자동 정리됩니다)</li>
                  <li>해당 키 프로젝트에서 <strong>Generative Language API가 사용 설정</strong>되어 있어야 합니다.</li>
                  <li><strong>사용량 한도(429)</strong> 초과 시 잠시 후 재시도하거나 유료 플랜을 설정하세요.</li>
                  <li>키는 <strong>브라우저(로컬)에만 저장</strong>되며 외부로 전송되지 않습니다.</li>
                </ul>
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-3 text-xs font-semibold text-blue-600 hover:underline">Google AI Studio에서 API Key 발급/확인<ExternalLink className="w-3 h-3" /></a>
              </div>
            </div>
            <div className="p-6 bg-neutral-50 border-t border-neutral-100 flex justify-end gap-3">
              <button onClick={() => setIsKeyModalOpen(false)} className="px-4 py-2 text-neutral-600 font-medium hover:bg-neutral-200 rounded-xl transition-colors">취소</button>
              <button onClick={handleSaveKey} className="px-4 py-2 bg-neutral-900 text-white font-medium hover:bg-neutral-800 rounded-xl transition-colors">저장하기</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function GuideView() {
  const steps = [
    { n: 1, color: 'indigo', title: 'API Key 설정', body: '우측 상단의 API Key 버튼을 눌러 Google Gemini API Key를 입력합니다. 키는 브라우저 로컬에만 저장됩니다.' },
    { n: 2, color: 'blue', title: '양식 업로드 + 내용 입력', body: '모집공고(선택)·사업계획서 양식(필수)을 올립니다. 무엇을 쓸지 막막하면 AI 인터뷰를 켜고 질문에 답만 하세요 — 나머지는 AI가 채웁니다. (단계별·직접 입력도 가능)' },
    { n: 3, color: 'emerald', title: '생성 → 평가 → 보강', body: '생성된 초안을 AI 평가위원에게 채점받고, 약한 섹션은 버튼 한 번으로 보강하거나 섹션별 다시쓰기로 다듬습니다.' },
    { n: 4, color: 'rose', title: '편집 → 저장 → 내보내기', body: '섹션을 직접 편집하고, 프로젝트로 저장한 뒤 Word(.docx)·PDF·복사로 최종 결과물을 내보냅니다.' },
  ];
  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-100 text-indigo-600', blue: 'bg-blue-100 text-blue-600',
    emerald: 'bg-emerald-100 text-emerald-600', rose: 'bg-rose-100 text-rose-600',
  };
  return (
    <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-neutral-200">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl font-bold text-neutral-900 mb-8">사용방법</h2>
        <div className="space-y-8">
          {steps.map(s => (
            <div key={s.n} className="flex gap-4">
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${colorMap[s.color]}`}>{s.n}</div>
              <div>
                <h3 className="text-xl font-bold text-neutral-900 mb-1.5">{s.title}</h3>
                <p className="text-neutral-600 leading-relaxed">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-emerald-50 p-4 rounded-xl text-sm text-emerald-700 border border-emerald-100 mt-8">✨ <strong>AI 자동 확장:</strong> 입력 정보를 분석해 기존 양식에 없는 필수 항목(목차)을 스스로 추가 기획하여 더 완성도 높은 사업계획서를 만들어냅니다.</div>
      </div>
    </motion.section>
  );
}
