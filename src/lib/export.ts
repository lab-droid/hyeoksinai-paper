// 결과물 내보내기: 정식 .docx(표·색상·굵게 보존), PDF(인쇄), Word(.doc HTML 폴백).

import { marked } from 'marked';
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle,
} from 'docx';

// result(마크다운) → HTML 문자열 (표/인라인 HTML 포함)
const toHtml = (markdown: string): string =>
  marked.parse(markdown, { async: false, gfm: true, breaks: false }) as string;

const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// ── 색상 정규화: 'red' / '#ff0000' / 'rgb(...)' → docx용 6자리 hex ──
const NAMED: Record<string, string> = {
  red: 'FF0000', blue: '0000FF', green: '008000', black: '000000',
  darkblue: '00008B', darkgreen: '006400', navy: '000080',
};
const normalizeColor = (raw?: string | null): string | undefined => {
  if (!raw) return undefined;
  const c = raw.trim().toLowerCase();
  if (NAMED[c]) return NAMED[c];
  const hex = c.match(/^#?([0-9a-f]{6})$/);
  if (hex) return hex[1].toUpperCase();
  const short = c.match(/^#?([0-9a-f]{3})$/);
  if (short) return short[1].split('').map(x => x + x).join('').toUpperCase();
  const rgb = c.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
  if (rgb) return [rgb[1], rgb[2], rgb[3]].map(n => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase();
  return undefined;
};

interface InlineStyle { bold?: boolean; italics?: boolean; color?: string; }

// 인라인 DOM 노드들을 docx TextRun[]으로 변환 (굵게/기울임/색상/줄바꿈 보존)
const walkInline = (nodes: NodeListOf<ChildNode> | ChildNode[], inherited: InlineStyle): TextRun[] => {
  const runs: TextRun[] = [];
  nodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (text) runs.push(new TextRun({ text, ...inherited }));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (tag === 'br') {
      runs.push(new TextRun({ text: '', break: 1 }));
      return;
    }
    const style: InlineStyle = { ...inherited };
    if (tag === 'strong' || tag === 'b') style.bold = true;
    if (tag === 'em' || tag === 'i') style.italics = true;
    const color = normalizeColor(el.style?.color);
    if (color) style.color = color;
    runs.push(...walkInline(el.childNodes, style));
  });
  return runs;
};

const cellParagraphs = (el: HTMLElement): Paragraph[] => {
  const runs = walkInline(el.childNodes, {});
  return [new Paragraph({ children: runs.length ? runs : [new TextRun('')] })];
};

const buildTable = (table: HTMLTableElement): Table => {
  const rows: TableRow[] = [];
  table.querySelectorAll('tr').forEach(tr => {
    const cells: TableCell[] = [];
    tr.querySelectorAll('th,td').forEach(cell => {
      const isHeader = cell.tagName.toLowerCase() === 'th';
      const paras = cellParagraphs(cell as HTMLElement);
      if (isHeader) paras.forEach(p => p);
      cells.push(new TableCell({
        children: paras,
        shading: isHeader ? { fill: 'F2F2F2' } : undefined,
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
      }));
    });
    if (cells.length) rows.push(new TableRow({ children: cells }));
  });
  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' },
      left: { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' },
      right: { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' },
    },
  });
};

const HEADINGS: Record<string, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  h1: HeadingLevel.HEADING_1,
  h2: HeadingLevel.HEADING_2,
  h3: HeadingLevel.HEADING_3,
  h4: HeadingLevel.HEADING_4,
  h5: HeadingLevel.HEADING_5,
  h6: HeadingLevel.HEADING_6,
};

// HTML body의 블록 요소들을 docx 본문 요소(Paragraph/Table)로 변환
const blocksFromBody = (body: HTMLElement): (Paragraph | Table)[] => {
  const out: (Paragraph | Table)[] = [];
  body.childNodes.forEach(node => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (HEADINGS[tag]) {
      out.push(new Paragraph({ heading: HEADINGS[tag], children: walkInline(el.childNodes, {}) }));
    } else if (tag === 'p') {
      out.push(new Paragraph({ children: walkInline(el.childNodes, {}), spacing: { after: 120 } }));
    } else if (tag === 'ul' || tag === 'ol') {
      el.querySelectorAll(':scope > li').forEach((li, i) => {
        const prefix = tag === 'ol' ? `${i + 1}. ` : '• ';
        out.push(new Paragraph({
          children: [new TextRun(prefix), ...walkInline((li as HTMLElement).childNodes, {})],
          indent: { left: 360 },
        }));
      });
    } else if (tag === 'table') {
      out.push(buildTable(el as HTMLTableElement));
      out.push(new Paragraph({ text: '' }));
    } else if (tag === 'blockquote') {
      out.push(new Paragraph({ children: walkInline(el.childNodes, { italics: true }), indent: { left: 360 } }));
    } else if (tag === 'hr') {
      out.push(new Paragraph({ text: '' }));
    } else if (tag === 'pre' || tag === 'div') {
      out.push(new Paragraph({ children: walkInline(el.childNodes, {}) }));
    }
  });
  return out;
};

// 정식 .docx 생성 및 다운로드
export const downloadDocx = async (result: string, filename = '사업계획서.docx') => {
  const html = toHtml(result);
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const children = blocksFromBody(doc.body);

  const document = new Document({
    styles: {
      default: {
        document: { run: { font: '맑은 고딕', size: 22 } },
      },
    },
    sections: [{ children: children.length ? children : [new Paragraph('')] }],
  });

  const blob = await Packer.toBlob(document);
  triggerDownload(blob, filename);
};

// Word 호환 .doc (HTML 기반 폴백)
export const downloadWordHtml = async (result: string, filename = '사업계획서.doc') => {
  const htmlContent = toHtml(result);
  const header =
    "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>사업계획서</title><style>body{font-family:'Malgun Gothic','맑은 고딕',sans-serif;line-height:1.6;}h1,h2,h3{color:#222;}p{margin-bottom:1em;}table{border-collapse:collapse;width:100%;}th,td{border:1px solid #bfbfbf;padding:8px;}th{background:#f2f2f2;}</style></head><body>";
  const blob = new Blob(['﻿', header + htmlContent + '</body></html>'], { type: 'application/msword' });
  triggerDownload(blob, filename);
};

// 인쇄(저장→PDF)용 새 창 열기. 한글 폰트 문제 없이 가장 안정적인 PDF 경로.
export const exportPdf = (result: string) => {
  const htmlContent = toHtml(result);
  const win = window.open('', '_blank');
  if (!win) {
    alert('팝업이 차단되었습니다. 팝업을 허용한 뒤 다시 시도해주세요.');
    return;
  }
  win.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>사업계획서</title>
  <style>
    @page { margin: 20mm; }
    body { font-family:'Malgun Gothic','맑은 고딕',sans-serif; line-height:1.7; color:#374151; padding:24px; }
    h1{font-size:24px;} h2{font-size:20px;} h3{font-size:17px;}
    h1,h2,h3{color:#111827;margin-top:1.2em;}
    table{border-collapse:collapse;width:100%;margin:1em 0;}
    th,td{border:1px solid #d4d4d4;padding:8px;vertical-align:top;}
    th{background:#f5f5f5;text-align:left;}
    img{max-width:100%;}
  </style></head><body>${htmlContent}
  <script>window.onload=function(){setTimeout(function(){window.print();},300);};<\/script>
  </body></html>`);
  win.document.close();
};
