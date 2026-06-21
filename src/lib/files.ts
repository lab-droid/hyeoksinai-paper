// 업로드 파일(PDF/DOCX/HWP)을 Gemini가 이해할 수 있는 part 형태로 변환하는 유틸.

import mammoth from 'mammoth';
import * as cfb from 'cfb';
import pako from 'pako';

export const ACCEPTED_EXTENSIONS = '.pdf,.docx,.hwp';

export const isAcceptedFile = (name: string): boolean => {
  const n = name.toLowerCase();
  return n.endsWith('.pdf') || n.endsWith('.docx') || n.endsWith('.hwp');
};

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

const fileToArrayBuffer = (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = error => reject(error);
  });
};

// PARA_TEXT 내에서 16바이트(8 wchar)를 차지하는 인라인/확장 제어문자 코드
const HWP_WIDE_CONTROL = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]);
const HWPTAG_PARA_TEXT = 67; // HWPTAG_BEGIN(16) + 51

// HWP(.hwp) 바이너리(OLE 복합문서)에서 본문 텍스트만 추출.
// 헤더의 압축 플래그를 확인해 비압축 저장본도 처리한다.
export const extractHwpText = (buffer: ArrayBuffer): string => {
  const container: any = cfb.read(new Uint8Array(buffer), { type: 'array' } as any);
  const header = cfb.find(container, 'FileHeader') || cfb.find(container, 'Root Entry/FileHeader');
  if (!header) throw new Error('FileHeader not found');
  const hb: Uint8Array = header.content as Uint8Array;
  const props = hb[36] | (hb[37] << 8) | (hb[38] << 16) | (hb[39] << 24);
  const compressed = (props & 0x01) === 1;

  const paragraphs: string[] = [];
  for (let i = 0; ; i++) {
    const sec = cfb.find(container, 'BodyText/Section' + i) || cfb.find(container, 'Root Entry/BodyText/Section' + i);
    if (!sec) break;
    let data = new Uint8Array(sec.content as Uint8Array);
    if (compressed) data = pako.inflate(data, { windowBits: -15 });
    const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);

    let p = 0;
    while (p + 4 <= data.length) {
      const recordHeader = dv.getUint32(p, true);
      p += 4;
      const tagId = recordHeader & 0x3ff;
      let size = (recordHeader >> 20) & 0xfff;
      if (size === 0xfff) {
        size = dv.getUint32(p, true);
        p += 4;
      }
      if (tagId === HWPTAG_PARA_TEXT) {
        let line = '';
        const end = p + size;
        let q = p;
        while (q + 2 <= end) {
          const charCode = dv.getUint16(q, true);
          q += 2;
          if (HWP_WIDE_CONTROL.has(charCode)) {
            q += 14; // 제어문자: 추가 7 wchar 건너뜀
          } else if (charCode >= 32 || charCode === 9) {
            line += String.fromCharCode(charCode);
          }
        }
        paragraphs.push(line);
      }
      p += size;
    }
  }
  return paragraphs.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};

// Gemini는 문서 inlineData로 PDF만 지원하므로, DOCX/HWP는 텍스트로 변환해 전송한다.
export const fileToPart = async (file: File): Promise<any> => {
  const name = file.name.toLowerCase();

  if (name.endsWith('.pdf')) {
    const base64 = await fileToBase64(file);
    return { inlineData: { data: base64, mimeType: 'application/pdf' } };
  }

  if (name.endsWith('.docx')) {
    const arrayBuffer = await fileToArrayBuffer(file);
    const { value } = await mammoth.extractRawText({ arrayBuffer });
    const text = value.trim();
    if (!text) throw new Error(`'${file.name}'에서 텍스트를 추출하지 못했습니다. PDF로 변환 후 업로드해주세요.`);
    return { text: `\n[파일: ${file.name}]\n${text}` };
  }

  if (name.endsWith('.hwp')) {
    const arrayBuffer = await fileToArrayBuffer(file);
    let text = '';
    try {
      text = extractHwpText(arrayBuffer);
    } catch {
      throw new Error(`'${file.name}'(HWP) 파일을 읽지 못했습니다. PDF로 변환 후 업로드해주세요.`);
    }
    if (!text) throw new Error(`'${file.name}'(HWP)에서 텍스트를 추출하지 못했습니다. PDF로 변환 후 업로드해주세요.`);
    return { text: `\n[파일: ${file.name}]\n${text}` };
  }

  throw new Error(`'${file.name}'은(는) 지원하지 않는 형식입니다. PDF, DOCX, HWP만 업로드할 수 있습니다.`);
};
