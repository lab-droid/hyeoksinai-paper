import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { CheckCircle2, UploadCloud, X } from 'lucide-react';
import { isAcceptedFile, ACCEPTED_EXTENSIONS } from '../lib/files';

interface Props {
  title: string;
  icon: LucideIcon;
  colorClass: string;
  files: File[];
  setFiles: React.Dispatch<React.SetStateAction<File[]>>;
  required?: boolean;
}

export default function FileUploadSection({ title, icon: Icon, colorClass, files, setFiles, required }: Props) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const dropped = Array.from(e.dataTransfer.files).filter(f => isAcceptedFile(f.name));
      if (dropped.length > 0) setFiles(prev => [...prev, ...dropped]);
    }
  };

  return (
    <div className="bg-white p-4 rounded-xl border border-neutral-200">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className={`w-4 h-4 ${colorClass}`} />
        <h3 className="text-sm font-semibold text-neutral-800">{title} {required && <span className="text-rose-500">*</span>}</h3>
      </div>
      <label
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
        onDrop={handleDrop}
        className={`flex items-center justify-center gap-2 w-full h-11 border border-dashed rounded-lg cursor-pointer transition-colors text-xs ${
          isDragging ? 'border-blue-500 bg-blue-50 text-blue-600' :
          files.length > 0 ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'border-neutral-300 bg-neutral-50 text-neutral-500 hover:bg-neutral-100'
        }`}
      >
        {files.length > 0 ? (
          <><CheckCircle2 className="w-4 h-4" /><span className="font-medium">{files.length}개 첨부됨 · 추가하려면 클릭</span></>
        ) : (
          <><UploadCloud className="w-4 h-4" /><span>{isDragging ? '여기에 놓으세요' : '클릭 또는 드래그 (PDF·DOCX·HWP)'}</span></>
        )}
        <input
          type="file"
          className="hidden"
          accept={ACCEPTED_EXTENSIONS}
          multiple
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              const selected = Array.from(e.target.files);
              setFiles(prev => [...prev, ...selected]);
            }
            e.target.value = '';
          }}
        />
      </label>
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {files.map((file, idx) => (
            <div key={idx} className="flex items-center gap-1 bg-neutral-100 px-2 py-1 rounded-md text-[11px] border border-neutral-200">
              <span className="truncate max-w-[140px] font-medium text-neutral-600" title={file.name}>{file.name}</span>
              <button onClick={() => setFiles(prev => prev.filter((_, i) => i !== idx))} className="text-neutral-400 hover:text-red-500 transition-colors">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
