// 작성한 사업계획서 초안을 브라우저(localStorage)에 저장/복원한다.
// 원본 업로드 파일(File)은 직렬화가 어렵고 무거워 저장하지 않으며,
// 생성 결과/입력 텍스트/평가 결과만 보관한다.

import type { Evaluation, ModelId } from './gemini';

export interface SavedProject {
  id: string;
  name: string;
  content: string;        // 사용자가 입력한 '전반적인 내용'
  wizard?: Record<string, string>; // 위저드 입력값(있으면)
  result: string;         // 생성된 사업계획서(마크다운)
  evaluation: Evaluation | null;
  model: ModelId;
  updatedAt: number;
}

const KEY = 'business_plan_projects';

export const listProjects = (): SavedProject[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as SavedProject[];
    return Array.isArray(arr) ? arr.sort((a, b) => b.updatedAt - a.updatedAt) : [];
  } catch {
    return [];
  }
};

const writeAll = (projects: SavedProject[]) => {
  localStorage.setItem(KEY, JSON.stringify(projects));
};

let idCounter = 0;
const newId = () => `prj-${Date.now().toString(36)}-${(idCounter++).toString(36)}`;

// id가 있으면 갱신, 없으면 새로 생성하여 저장하고 저장된 프로젝트를 반환한다.
export const saveProject = (project: Omit<SavedProject, 'id' | 'updatedAt'> & { id?: string }): SavedProject => {
  const all = listProjects();
  const saved: SavedProject = {
    ...project,
    id: project.id || newId(),
    updatedAt: Date.now(),
  };
  const idx = all.findIndex(p => p.id === saved.id);
  if (idx >= 0) all[idx] = saved;
  else all.unshift(saved);
  writeAll(all);
  return saved;
};

export const deleteProject = (id: string) => {
  writeAll(listProjects().filter(p => p.id !== id));
};
