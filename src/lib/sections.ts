// 생성된 마크다운을 섹션(목차) 단위로 분해/재조립한다.
// 섹션별 편집·재생성을 위해 사용.

export interface Section {
  id: string;
  heading: string;   // 머리말 라인 원문 (예: "## 1. 문제 인식") — 본문만 있는 머리글 없는 도입부는 빈 문자열
  level: number;     // 1~6, 머리말 없으면 0
  body: string;      // 머리말 아래 본문(마크다운)
}

let counter = 0;
const nextId = () => `sec-${Date.now().toString(36)}-${(counter++).toString(36)}`;

// 표(`|`) 안의 라인은 머리글로 오인하지 않도록, 코드블록/표 밖의 ATX 헤딩만 분리한다.
export const parseSections = (markdown: string): Section[] => {
  const lines = markdown.split('\n');
  const sections: Section[] = [];
  let current: Section | null = null;
  let inFence = false;

  const push = (s: Section | null) => {
    if (s) {
      s.body = s.body.replace(/\s+$/, '');
      sections.push(s);
    }
  };

  for (const line of lines) {
    if (/^\s*```/.test(line)) inFence = !inFence;
    const headingMatch = !inFence ? line.match(/^(#{1,6})\s+(.*)$/) : null;

    if (headingMatch) {
      push(current);
      current = {
        id: nextId(),
        heading: line,
        level: headingMatch[1].length,
        body: '',
      };
    } else {
      if (!current) {
        current = { id: nextId(), heading: '', level: 0, body: '' };
      }
      current.body += (current.body ? '\n' : '') + line;
    }
  }
  push(current);

  // 머리말도 본문도 없는 빈 섹션 제거
  return sections.filter(s => s.heading.trim() || s.body.trim());
};

// 섹션 머리말에서 마크다운 기호(#)를 떼고 사람이 읽을 제목만 추출
export const sectionTitle = (s: Section): string => {
  if (!s.heading.trim()) return '(머리말 없는 도입부)';
  return s.heading.replace(/^#{1,6}\s+/, '').trim();
};

export const sectionToMarkdown = (s: Section): string => {
  if (!s.heading.trim()) return s.body;
  return s.body ? `${s.heading}\n${s.body}` : s.heading;
};

export const sectionsToMarkdown = (sections: Section[]): string =>
  sections.map(sectionToMarkdown).join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
