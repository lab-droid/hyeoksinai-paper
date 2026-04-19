import { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Key, CheckCircle2, XCircle, Loader2, FileText, Info, PenTool, Send, UploadCloud, X, Briefcase, Copy, Download, Check, ShieldCheck } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { motion } from 'motion/react';
import { marked } from 'marked';

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = error => reject(error);
  });
};

const getMimeType = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (ext === 'hwp') return 'application/x-hwp';
  return 'application/octet-stream';
};

const FileUploadSection = ({ title, icon: Icon, colorClass, files, setFiles, required }: any) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files).filter(file => 
        file.name.toLowerCase().endsWith('.pdf') || 
        file.name.toLowerCase().endsWith('.docx') || 
        file.name.toLowerCase().endsWith('.hwp')
      );
      if (droppedFiles.length > 0) {
        setFiles((prev: File[]) => [...prev, ...droppedFiles]);
      }
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200 flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <Icon className={`w-5 h-5 ${colorClass}`} />
        <h3 className="font-semibold text-neutral-900">{title} {required && <span className="text-rose-500">*</span>}</h3>
      </div>
      <div className="mb-4">
        <label 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
            isDragging ? 'border-blue-500 bg-blue-50' :
            files.length > 0 ? 'border-emerald-400 bg-emerald-50 hover:bg-emerald-100' : 'border-neutral-300 bg-neutral-50 hover:bg-neutral-100'
          }`}
        >
          <div className="flex flex-col items-center justify-center pt-4 pb-4">
            {files.length > 0 ? (
              <>
                <CheckCircle2 className="w-6 h-6 text-emerald-500 mb-2" />
                <p className="text-sm text-emerald-700 font-medium">{files.length}개의 파일 첨부됨</p>
                <p className="text-xs text-emerald-600/70 mt-1 text-center">클릭하거나 드래그하여 추가 업로드</p>
              </>
            ) : (
              <>
                <UploadCloud className={`w-6 h-6 mb-2 ${isDragging ? 'text-blue-500' : 'text-neutral-400'}`} />
                <p className={`text-sm font-medium ${isDragging ? 'text-blue-600' : 'text-neutral-600'} text-center px-4`}>
                  {isDragging ? '여기에 파일을 놓으세요' : '클릭하거나 파일을 드래그하여 업로드'}
                </p>
                <p className="text-xs text-neutral-400 mt-1">PDF, DOCX, HWP 지원</p>
              </>
            )}
          </div>
          <input
            type="file"
            className="hidden"
            accept=".pdf,.docx,.hwp"
            multiple
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                const selectedFiles = Array.from(e.target.files);
                setFiles((prev: File[]) => [...prev, ...selectedFiles]);
              }
              e.target.value = '';
            }}
          />
        </label>
        <p className="text-[11px] text-neutral-400 mt-2 text-center break-keep">※ HWP, DOCX는 인식률을 위해 가급적 PDF 변환 후 업로드를 권장합니다.</p>
      </div>
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((file: File, idx: number) => (
            <div key={idx} className="flex items-center gap-1 bg-neutral-100 px-2.5 py-1.5 rounded-lg text-xs border border-neutral-200">
              <span className="truncate max-w-[160px] font-medium text-neutral-700" title={file.name}>{file.name}</span>
              <button onClick={() => setFiles((prev: File[]) => prev.filter((_, i) => i !== idx))} className="text-neutral-400 hover:text-red-500 p-0.5 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [apiKey, setApiKey] = useState('');
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [isPatchNotesOpen, setIsPatchNotesOpen] = useState(false);
  const [tempKey, setTempKey] = useState('');

  const [announcementFiles, setAnnouncementFiles] = useState<File[]>([]);
  const [templateFiles, setTemplateFiles] = useState<File[]>([]);
  const [infoFiles, setInfoFiles] = useState<File[]>([]);
  const [criteriaFiles, setCriteriaFiles] = useState<File[]>([]);
  const [content, setContent] = useState('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [currentView, setCurrentView] = useState<'input' | 'generating' | 'result' | 'guide'>('input');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [selectedModel, setSelectedModel] = useState<'gemini-3.1-pro-preview' | 'gemini-3-flash-preview'>('gemini-3.1-pro-preview');

  const patchNotes = [
    {
      date: '2026-04-19',
      title: '패치노트 및 API 비용 안내 추가',
      details: [
        '상단 헤더에 패치노트 확인 기능 추가',
        '예상 API 사용 비용(KRW) 안내 섹션 추가',
        'UI 레이아웃 최적화'
      ]
    },
    {
      date: '2026-03-24',
      title: '입력 방식 개편 및 운영 기준 추가',
      details: [
        '운영 기준 항목(파일 첨부) 추가',
        '모든 입력 항목을 파일 첨부 중심으로 UI 전면 개편',
        '전반적인 내용(필수) 항목의 편의성 개선',
        '홈 이동 시 데이터 초기화 로직 보강'
      ]
    },
    {
      date: '2026-03-22',
      title: '모델 선택 및 사용 가이드 추가',
      details: [
        'Gemini 1.5 Pro / Flash 모델 선택 기능 추가 (할당량 대응)',
        '상단 네비게이션(홈, 사용방법) 추가 및 가이드 페이지 구현',
        'API 할당량 초과(429) 및 오류 메시지 시각화 개선',
        '헤더 로고 클릭 시 홈 이동 기능 추가'
      ]
    },
    {
      date: '2026-03-21',
      title: '출력 포맷 및 시각화 강화',
      details: [
        '표(Table) 테두리 선 및 스타일 적용 (Typography 플러그인)',
        '강조 텍스트 색상(빨강, 파랑, 초록) 및 Bold 자동 적용',
        '이미지 삽입 가이드 Placeholder 생성 로직 추가',
        '생성 진행률(%) 시각화 및 화면 전환 UX 적용'
      ]
    },
    {
      date: '2026-03-15',
      title: '초기 런칭',
      details: [
        'Gemini AI 기반 고득점 사업계획서 생성 엔진 탑재',
        'PDF, DOCX, HWP 파일 분석 기능',
        'Word(.doc) 다운로드 및 클립보드 복사 기능'
      ]
    }
  ];

  useEffect(() => {
    const storedKey = localStorage.getItem('gemini_api_key');
    if (storedKey) {
      setApiKey(storedKey);
    } else if (process.env.GEMINI_API_KEY) {
      setApiKey(process.env.GEMINI_API_KEY);
    }
  }, []);

  const handleSaveKey = () => {
    setApiKey(tempKey);
    localStorage.setItem('gemini_api_key', tempKey);
    setIsKeyModalOpen(false);
  };

  const handleGenerate = async () => {
    if (templateFiles.length === 0) {
      setError('사업계획서 양식을 파일로 첨부해주세요.');
      return;
    }
    if (!content) {
      setError('전반적인 내용을 입력해주세요.');
      return;
    }
    if (!apiKey) {
      setError('API Key를 입력해주세요.');
      setIsKeyModalOpen(true);
      return;
    }

    setIsGenerating(true);
    setCurrentView('generating');
    setProgress(0);
    setError('');
    setResult('');

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return prev;
        const increment = Math.max(1, (95 - prev) * 0.1);
        return prev + increment;
      });
    }, 500);

    try {
      const ai = new GoogleGenAI({ apiKey });
      const parts: any[] = [];

      parts.push({ text: '당신은 정부지원사업 및 투자 유치를 위한 최고 수준의 사업계획서 작성 전문가입니다. 서류평가위원에게 높은 고득점을 받을 수 있도록 논리적이고 설득력 있게, 그리고 전문적인 용어를 사용하여 작성해야 합니다.\n\n다음 정보를 바탕으로 사업계획서를 작성해주세요.' });

      if (announcementFiles.length > 0) {
        parts.push({ text: '\n\n[모집공고 양식 및 내용]' });
        for (const file of announcementFiles) {
          const base64 = await fileToBase64(file);
          parts.push({ inlineData: { data: base64, mimeType: file.type || getMimeType(file.name) } });
        }
      }

      if (templateFiles.length > 0) {
        parts.push({ text: '\n\n[사업계획서 양식]' });
        for (const file of templateFiles) {
          const base64 = await fileToBase64(file);
          parts.push({ inlineData: { data: base64, mimeType: file.type || getMimeType(file.name) } });
        }
      }

      if (infoFiles.length > 0) {
        parts.push({ text: '\n\n[사업계획서 관련 정보]' });
        for (const file of infoFiles) {
          const base64 = await fileToBase64(file);
          parts.push({ inlineData: { data: base64, mimeType: file.type || getMimeType(file.name) } });
        }
      }

      if (criteriaFiles.length > 0) {
        parts.push({ text: '\n\n[운영 기준 항목]' });
        for (const file of criteriaFiles) {
          const base64 = await fileToBase64(file);
          parts.push({ inlineData: { data: base64, mimeType: file.type || getMimeType(file.name) } });
        }
      }

      parts.push({ text: `\n\n[전반적인 내용]\n${content}\n\n작성 지침:\n1. 제공된 '사업계획서 양식'의 목차와 구조를 기본으로 하되, **제공된 '사업계획서 관련 정보' 및 '운영 기준 항목'의 내용을 심층적으로 분석하여 기존 양식에 없는 새로운 '추가 항목(목차)'을 반드시 1개 이상 생성하여 적절한 위치에 포함시킬 것.**\n2. '모집공고 양식'이 제공된 경우, 해당 공고의 평가 기준과 요구사항을 철저히 반영할 것.\n3. **[중요] 서류평가위원에게 고득점을 받기 위해 필수적인 항목(예: 구체적인 수익 모델, 경쟁사 대비 차별화 전략, 리스크 관리 및 대응 방안, 팀 역량 및 네트워크 등)을 AI가 스스로 분석하여, 기존 양식에 누락되어 있다면 적절한 위치에 추가하여 작성할 것.**\n4. **[중요] '추가 인원 채용 계획' 항목이 있다면, 정부지원사업에서 높은 점수(일자리 창출 지표)를 받을 수 있도록 사업 규모와 성장 단계에 맞는 타당하고 전략적인 인원 수와 직무(예: 핵심 개발자, 마케팅 전문가 등)를 선정하여 구체적으로 작성할 것.**\n5. **[매우 중요] 표(Table)가 필요한 문장이나 항목(예: 자금소요계획, 추진일정, 인력현황, 경쟁사 비교 등)은 반드시 마크다운 표 형식으로 구성하여 보여줄 것. 표 작성 시 내용이 비어있거나 투명한 표가 아닌, 반드시 모든 셀에 구체적인 내용이 채워진 완전한 표 형식으로 작성할 것.**\n6. 평가위원이 한눈에 파악할 수 있도록 가독성 높게 작성할 것. 문항마다 문단을 명확히 나누어 작성할 것.\n7. **[중요] 강조할 텍스트는 빨간색, 진한 파란색, 진한 초록색 색상을 적절하게 섞어서 작성할 것. 색상 적용 시 반드시 HTML 태그를 사용할 것 (예: <span style="color: red;">강조내용</span>). 굵은 글씨(Bold)가 필요한 경우 \`**\` 기호 대신 \`<strong>\` 태그를 사용할 것.**\n8. 일반 본문에서 줄바꿈이 필요하다면 마크다운의 문단 띄어쓰기(엔터 두 번)를 사용할 것. **단, 마크다운 표(\`|\`로 구분되는 표) 내부의 셀 안에서 줄바꿈이 필요할 때는 반드시 \`<br>\` 태그를 사용할 것.** 표 위아래로는 반드시 빈 줄을 하나씩 넣어서 표가 깨지지 않게 할 것.\n9. **[중요] 이미지가 포함되면 좋은 곳(예: 서비스 흐름도, 제품 사진, 시스템 아키텍처 등)은 반드시 \`[이미지 : (들어갈 이미지에 대한 상세 설명)]\` 형식으로 본문에 포함시킬 것.**\n10. "여기 사업계획서 초안입니다"와 같은 인사말이나 마크다운 문법에 대한 설명 등 불필요한 내용은 일절 제외하고, 오직 사업계획서 본문 내용만 바로 출력할 것.` });

      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: { parts },
      });

      clearInterval(progressInterval);
      setProgress(100);

      let generatedText = response.text || '';
      
      // **텍스트** 를 <strong>텍스트</strong>로 변환 (마크다운 파싱 오류 방지 및 ** 기호 숨김)
      generatedText = generatedText.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

      setResult(generatedText);
      
      setTimeout(() => {
        setCurrentView('result');
        setIsGenerating(false);
      }, 500);

    } catch (err: any) {
      clearInterval(progressInterval);
      console.error('Generation Error:', err);
      
      let errorMessage = '오류가 발생했습니다. 파일 형식이 지원되지 않거나 API Key를 확인해주세요.';
      
      // Handle Quota Exceeded (429) error
      if (err.message?.includes('quota') || err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED')) {
        errorMessage = 'API 사용량이 한도를 초과했습니다. 잠시 후 다시 시도하시거나, 유료 플랜(Pay-as-you-go) 설정 또는 다른 API Key 사용을 권장합니다.';
      } else if (err.message?.includes('API key not valid')) {
        errorMessage = '유효하지 않은 API Key입니다. 키를 다시 확인해주세요.';
      } else if (err.message) {
        errorMessage = `오류: ${err.message}`;
      }

      setError(errorMessage);
      setCurrentView('input');
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleGoHome = () => {
    setCurrentView('input');
    setAnnouncementFiles([]);
    setTemplateFiles([]);
    setInfoFiles([]);
    setCriteriaFiles([]);
    setContent('');
    setResult('');
    setProgress(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDownloadWord = async () => {
    try {
      const htmlContent = await marked.parse(result);
      const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>사업계획서</title><style>body { font-family: 'Malgun Gothic', '맑은 고딕', sans-serif; line-height: 1.6; } h1, h2, h3 { color: #333; } p { margin-bottom: 1em; }</style></head><body>";
      const footer = "</body></html>";
      const sourceHTML = header + htmlContent + footer;

      const blob = new Blob(['\ufeff', sourceHTML], {
        type: 'application/msword'
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = '사업계획서.doc';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download word file: ', err);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-neutral-200 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-8">
          <button 
            onClick={handleGoHome}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity text-left"
          >
            <FileText className="w-6 h-6 text-neutral-800" />
            <h1 className="text-xl font-bold tracking-tight text-neutral-900 hidden lg:block">혁신 사업계획서 작성 AI</h1>
          </button>
          <nav className="flex items-center gap-6">
            <button
              onClick={handleGoHome}
              className={`text-sm font-semibold transition-colors ${currentView !== 'guide' ? 'text-neutral-900' : 'text-neutral-500 hover:text-neutral-900'}`}
            >
              홈
            </button>
            <button
              onClick={() => {
                setCurrentView('guide');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`text-sm font-semibold transition-colors ${currentView === 'guide' ? 'text-neutral-900' : 'text-neutral-500 hover:text-neutral-900'}`}
            >
              사용방법
            </button>
          </nav>
        </div>
        
        <div className="flex items-center gap-3">
          {/* API Cost Info */}
          <div className="hidden md:flex flex-col items-end mr-2 text-[10px] text-neutral-500">
            <div className="flex items-center gap-1">
              <span className="font-bold text-neutral-700">예상 API 비용:</span>
              <span>약 0원 ~ 600원</span>
            </div>
            <p className="opacity-70 whitespace-nowrap">※ 결과물 길이에 따라 오차 발생 가능</p>
          </div>

          <button
            onClick={() => setIsPatchNotesOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-full bg-neutral-100 hover:bg-neutral-200 transition-colors text-xs font-semibold text-neutral-700"
          >
            패치노트
          </button>

          <button
            onClick={() => {
              setTempKey(apiKey);
              setIsKeyModalOpen(true);
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-full bg-neutral-100 hover:bg-neutral-200 transition-colors text-xs font-bold shrink-0"
          >
            <Key className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">API Key</span>
            {apiKey ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-red-500" />
            )}
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {currentView === 'input' && (
          <>
            {/* Hero Section */}
            <section className="relative w-full aspect-video max-h-[320px] rounded-3xl overflow-hidden shadow-xl">
              <img
                src="https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=2070&auto=format&fit=crop"
                alt="Business Planning"
                className="absolute inset-0 w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-900/90 via-neutral-900/40 to-transparent flex flex-col justify-end p-10">
                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-3xl md:text-4xl font-bold text-white mb-3 tracking-tight"
                >
                  혁신 사업계획서 작성 AI
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-base text-neutral-200 max-w-2xl"
                >
                  평가위원의 마음을 사로잡는 완벽한 사업계획서. 모집공고와 양식을 업로드하면, 고득점을 위한 전문적인 사업계획서가 완성됩니다.
                </motion.p>
              </div>
            </section>

            {/* Input Section */}
            <section className="grid md:grid-cols-2 gap-6">
              {/* 1. 모집공고 양식 */}
              <FileUploadSection
                title="모집공고 양식 (선택)"
                icon={Briefcase}
                colorClass="text-blue-600"
                files={announcementFiles}
                setFiles={setAnnouncementFiles}
              />

              {/* 2. 사업계획서 양식 */}
              <FileUploadSection
                title="사업계획서 양식 (필수)"
                icon={FileText}
                colorClass="text-indigo-600"
                files={templateFiles}
                setFiles={setTemplateFiles}
                required
              />

              {/* 3. 사업계획서 관련 정보 */}
              <FileUploadSection
                title="사업계획서 관련 정보 (선택)"
                icon={Info}
                colorClass="text-emerald-600"
                files={infoFiles}
                setFiles={setInfoFiles}
              />

              {/* 4. 운영 기준 항목 */}
              <FileUploadSection
                title="운영 기준 항목 (선택)"
                icon={ShieldCheck}
                colorClass="text-purple-600"
                files={criteriaFiles}
                setFiles={setCriteriaFiles}
              />

              {/* 5. 전반적인 내용 */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200 flex flex-col h-full md:col-span-2">
                <div className="flex items-center gap-2 mb-4">
                  <PenTool className="w-5 h-5 text-rose-600" />
                  <h3 className="font-semibold text-neutral-900">전반적인 내용 (필수)</h3>
                </div>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="사업의 배경, 해결하고자 하는 문제, 우리만의 솔루션, 수익 모델 등 작성하고자 하는 내용을 자유롭게 적어주세요."
                  className="w-full flex-grow min-h-[160px] p-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none resize-none text-sm"
                />
              </div>
            </section>

            <section className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 rounded-lg">
                  <Briefcase className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-neutral-900">AI 모델 선택</p>
                  <p className="text-xs text-neutral-500">Pro는 고품질, Flash는 빠른 속도와 높은 할당량</p>
                </div>
              </div>
              <div className="flex bg-neutral-100 p-1 rounded-xl w-full sm:w-auto">
                <button
                  onClick={() => setSelectedModel('gemini-3.1-pro-preview')}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    selectedModel === 'gemini-3.1-pro-preview' 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-neutral-500 hover:text-neutral-700'
                  }`}
                >
                  Pro (권장)
                </button>
                <button
                  onClick={() => setSelectedModel('gemini-3-flash-preview')}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    selectedModel === 'gemini-3-flash-preview' 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-neutral-500 hover:text-neutral-700'
                  }`}
                >
                  Flash (빠름)
                </button>
              </div>
            </section>

            <section>
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full py-4 bg-neutral-900 hover:bg-neutral-800 text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-md"
              >
                <Send className="w-6 h-6" />
                고득점 사업계획서 생성하기
              </button>
              {error && <p className="text-red-500 text-sm text-center font-medium mt-3">{error}</p>}
            </section>
          </>
        )}

        {currentView === 'generating' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center w-full max-w-md"
            >
              <Loader2 className="w-16 h-16 text-blue-600 animate-spin mb-6" />
              <h2 className="text-3xl font-bold text-neutral-900 mb-2">고득점 사업계획서 생성 중...</h2>
              <p className="text-neutral-500 mb-8 text-center">AI가 제공된 양식과 정보를 분석하여<br/>최적의 내용을 작성하고 있습니다.</p>
              
              <div className="w-full bg-neutral-200 rounded-full h-4 overflow-hidden">
                <motion.div 
                  className="bg-blue-600 h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ ease: "linear", duration: 0.5 }}
                />
              </div>
              <p className="text-blue-600 font-bold mt-4 text-xl">{Math.round(progress)}%</p>
            </motion.div>
          </div>
        )}

        {currentView === 'result' && result && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-8 md:p-12 rounded-3xl shadow-lg border border-neutral-200"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b pb-4">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setCurrentView('input')}
                  className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
                  title="다시 작성하기"
                >
                  <X className="w-6 h-6 text-neutral-500" />
                </button>
                <h3 className="text-2xl font-bold text-neutral-900">생성된 사업계획서</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium text-sm transition-colors"
                >
                  {isCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  {isCopied ? '복사됨' : '복사'}
                </button>
                <button
                  onClick={handleDownloadWord}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Word 다운로드
                </button>
              </div>
            </div>
            <div className="prose prose-neutral max-w-none prose-headings:font-bold prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-p:text-neutral-700 prose-li:text-neutral-700 prose-table:border-collapse prose-table:w-full prose-th:border prose-th:border-neutral-300 prose-th:bg-neutral-100 prose-th:p-3 prose-td:border prose-td:border-neutral-300 prose-td:p-3">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{result}</ReactMarkdown>
            </div>
          </motion.section>
        )}

        {currentView === 'guide' && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-neutral-200"
          >
            <div className="max-w-3xl mx-auto">
              <h2 className="text-3xl font-bold text-neutral-900 mb-8">혁신 사업계획서 작성 AI 사용방법</h2>
              
              <div className="space-y-10">
                {/* Step 1 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-lg">1</div>
                  <div>
                    <h3 className="text-xl font-bold text-neutral-900 mb-2">API Key 설정</h3>
                    <p className="text-neutral-600 leading-relaxed mb-3">
                      우측 상단의 <strong>API Key</strong> 버튼을 클릭하여 Google Gemini API Key를 입력합니다. API Key는 브라우저 로컬 환경에만 안전하게 저장되며 외부로 전송되지 않습니다.
                    </p>
                    <div className="bg-neutral-50 p-4 rounded-xl text-sm text-neutral-500 border border-neutral-200">
                      💡 <strong>Tip:</strong> API Key가 없다면 <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Google AI Studio</a>에서 무료로 발급받을 수 있습니다.
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">2</div>
                  <div>
                    <h3 className="text-xl font-bold text-neutral-900 mb-2">양식 업로드 (모집공고 및 사업계획서)</h3>
                    <p className="text-neutral-600 leading-relaxed">
                      지원하고자 하는 사업의 <strong>모집공고 양식(선택)</strong>과 <strong>사업계획서 양식(필수)</strong>을 업로드합니다. PDF, DOCX, HWP 파일을 지원하며, 텍스트로 직접 복사하여 붙여넣을 수도 있습니다.
                    </p>
                    <ul className="list-disc list-inside mt-2 text-sm text-neutral-500 space-y-1">
                      <li>모집공고를 첨부하면 AI가 평가 기준을 분석하여 맞춤형으로 작성합니다.</li>
                      <li>HWP 파일은 인식률을 높이기 위해 가급적 PDF로 변환 후 업로드하는 것을 권장합니다.</li>
                    </ul>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-lg">3</div>
                  <div>
                    <h3 className="text-xl font-bold text-neutral-900 mb-2">사업 정보 및 전반적인 내용 입력</h3>
                    <p className="text-neutral-600 leading-relaxed">
                      <strong>사업계획서 관련 정보</strong>에 타겟 고객, 시장 상황, 지원 사업명 등을 간략히 적어주세요. <strong>전반적인 내용</strong>에는 아이템의 핵심 기능, 수익 모델, 차별성 등을 자유롭게 작성합니다.
                    </p>
                    <div className="bg-emerald-50 p-4 rounded-xl text-sm text-emerald-700 border border-emerald-100 mt-3">
                      ✨ <strong>AI 자동 확장 기능:</strong> 입력해주신 정보를 바탕으로 AI가 스스로 분석하여, 기존 양식에 없는 <strong>새로운 필수 항목(목차)을 추가로 기획</strong>하여 더욱 완벽한 사업계획서를 만들어냅니다.
                    </div>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 font-bold text-lg">4</div>
                  <div>
                    <h3 className="text-xl font-bold text-neutral-900 mb-2">생성 및 결과 활용</h3>
                    <p className="text-neutral-600 leading-relaxed">
                      <strong>고득점 사업계획서 생성하기</strong> 버튼을 누르면 AI가 작성을 시작합니다. 완료된 사업계획서는 마크다운 형태로 제공되며, 강조 색상과 표가 깔끔하게 적용되어 있습니다.
                    </p>
                    <ul className="list-disc list-inside mt-2 text-sm text-neutral-500 space-y-1">
                      <li><strong>복사:</strong> 내용을 클립보드에 복사하여 원하는 곳에 붙여넣을 수 있습니다.</li>
                      <li><strong>Word 다운로드:</strong> 작성된 내용을 .doc 형식의 워드 파일로 즉시 다운로드할 수 있습니다.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200 bg-white py-8 mt-12">
        <div className="max-w-5xl mx-auto px-6 text-center text-neutral-500 text-sm">
          <p>Developed by <strong>정혁신</strong></p>
          <p className="mt-1">© {new Date().getFullYear()} 혁신 사업계획서 작성 AI. All rights reserved.</p>
        </div>
      </footer>

      {/* Patch Notes Modal */}
      {isPatchNotesOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]"
          >
            <div className="p-6 border-b border-neutral-100 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-neutral-900">패치노트</h3>
                <p className="text-sm text-neutral-500 mt-0.5">업데이트 내역 및 히스토리</p>
              </div>
              <button 
                onClick={() => setIsPatchNotesOpen(false)}
                className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-neutral-500" />
              </button>
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
                      <li key={j} className="text-sm text-neutral-600 flex items-start gap-2">
                        <span className="mt-1.5 w-1 h-1 rounded-full bg-neutral-400 shrink-0" />
                        {detail}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="p-4 bg-neutral-50 border-t border-neutral-100 text-center">
              <p className="text-xs text-neutral-400">더 나은 서비스를 위해 꾸준히 업데이트 중입니다.</p>
            </div>
          </motion.div>
        </div>
      )}

      {/* API Key Modal */}
      {isKeyModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="p-6 border-b border-neutral-100">
              <h3 className="text-xl font-bold text-neutral-900">Google API Key 설정</h3>
              <p className="text-sm text-neutral-500 mt-1">
                Gemini API를 사용하기 위해 API Key를 입력해주세요. 키는 브라우저에만 안전하게 저장됩니다.
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">API Key</label>
                <input
                  type="password"
                  value={tempKey}
                  onChange={(e) => setTempKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="p-6 bg-neutral-50 border-t border-neutral-100 flex justify-end gap-3">
              <button
                onClick={() => setIsKeyModalOpen(false)}
                className="px-4 py-2 text-neutral-600 font-medium hover:bg-neutral-200 rounded-xl transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSaveKey}
                className="px-4 py-2 bg-neutral-900 text-white font-medium hover:bg-neutral-800 rounded-xl transition-colors"
              >
                저장하기
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
