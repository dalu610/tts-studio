import { useState, useRef } from 'react';
import { Wand2, Upload, FileSpreadsheet, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';

const TABS = [
  { id: 'text', label: '话术变体', icon: Sparkles },
  { id: 'excel', label: 'Excel 导入', icon: FileSpreadsheet },
];

export default function InputZone({ onGenerate, isLoading, onExcelUpload }) {
  const [activeTab, setActiveTab] = useState('text');
  const [seedText, setSeedText] = useState('');
  const [excelFileName, setExcelFileName] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDraggingInput, setIsDraggingInput] = useState(false);
  const fileInputRef = useRef(null);

  const charCount = seedText.length;
  const isValid = seedText.trim().length > 0;

  const handleGenerate = () => {
    if (!isValid) return;
    onGenerate(seedText.trim());
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && isValid) {
      handleGenerate();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = (file) => {
    setExcelFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);

        let texts = [];
        if (jsonData.length > 0) {
          const firstRow = jsonData[0];
          const columnKey = Object.keys(firstRow).find(
            (k) => k.trim() === '话术库' || k.trim().includes('话术')
          );
          if (columnKey) {
            texts = jsonData
              .map((row) => row[columnKey])
              .filter((t) => t && String(t).trim() && String(t).trim() !== columnKey)
              .map((t) => String(t).trim());
          } else {
            const allKeys = Object.keys(firstRow);
            for (const key of allKeys) {
              const col = jsonData.map((row) => row[key]).filter((t) => t && String(t).trim());
              if (col.length > texts.length) texts = col.map((t) => String(t).trim());
            }
          }
        }

        if (texts.length === 0) {
          alert('Excel 中未找到有效文本，请确保包含"话术库"列');
          return;
        }
        onExcelUpload(texts);
      } catch (err) {
        alert('Excel 解析失败，请检查文件格式');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      processFile(file);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Tab Navigation */}
      <div className="flex gap-1.5 bg-studio-bg rounded-xl p-1 mb-5 border border-studio-border">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 relative flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === id
                ? 'bg-studio-card text-white shadow-lg'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {activeTab === id && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute inset-0 bg-gradient-to-r from-amber-500/10 to-cyan-500/10 rounded-lg border border-amber-500/20 -z-10"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'text' && (
          <motion.div
            key="text-tab"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col min-h-0"
          >
            {/* Section label */}
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-4 bg-gradient-to-b from-amber-500 to-amber-600 rounded-full" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                种子话术
              </span>
            </div>

            {/* Textarea */}
            <div className="relative flex-1 flex flex-col mb-4">
              <textarea
                value={seedText}
                onChange={(e) => setSeedText(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsDraggingInput(true)}
                onBlur={() => setIsDraggingInput(false)}
                placeholder="输入你想扩展的种子话术，LLM 将生成 15 条风格相似但句式各异的变体..."
                className="flex-1 studio-input resize-none rounded-xl pt-4 pb-10 text-sm leading-relaxed"
                style={{ minHeight: '160px' }}
              />
              {/* Character counter */}
              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                <div
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    charCount === 0
                      ? 'w-0'
                      : charCount < 100
                      ? 'w-8 bg-emerald-500/60'
                      : charCount < 300
                      ? 'w-12 bg-amber-500/60'
                      : 'w-16 bg-red-500/60'
                  }`}
                />
                <span
                  className={`font-mono text-[10px] ${
                    charCount === 0 ? 'text-slate-600' : charCount < 100 ? 'text-emerald-500/70' : charCount < 300 ? 'text-amber-500/70' : 'text-red-500/70'
                  }`}
                >
                  {charCount}
                </span>
              </div>
              {/* Focus glow border */}
              <div
                className={`absolute inset-0 rounded-xl transition-all duration-300 pointer-events-none ${
                  isDraggingInput
                    ? 'ring-2 ring-cyan-500/40 ring-offset-0'
                    : ''
                }`}
              />
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={!isValid || isLoading}
              className={`group relative w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2.5 transition-all duration-200 ${
                isValid && !isLoading
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-studio-bg hover:from-amber-400 hover:to-amber-500 shadow-lg hover:shadow-amber-500/25 active:scale-[0.98]'
                  : 'bg-studio-card border border-studio-border text-slate-600 cursor-not-allowed'
              }`}
            >
              {isLoading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="12" strokeLinecap="round" />
                  </svg>
                  <span>正在生成变体...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 transition-transform group-hover:rotate-12" />
                  <span>生成 15 条变体</span>
                  <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-black/20 font-mono">
                    ⌘↵
                  </kbd>
                </>
              )}
            </button>

            {/* Tip */}
            <p className="mt-3 text-[11px] text-slate-600 text-center">
              基于种子话术生成 15 条适合 TTS 训练的表达变体
            </p>
          </motion.div>
        )}

        {activeTab === 'excel' && (
          <motion.div
            key="excel-tab"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col min-h-0"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-4 bg-gradient-to-b from-cyan-500 to-cyan-600 rounded-full" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                Excel 导入
              </span>
            </div>

            {/* Drop Zone */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
              className={`flex-1 flex flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer min-h-[180px] ${
                isDragOver
                  ? 'border-cyan-500/60 bg-cyan-500/5'
                  : excelFileName
                  ? 'border-emerald-500/40 bg-emerald-500/5'
                  : 'border-studio-border hover:border-studio-border-light hover:bg-studio-card/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />

              {excelFileName ? (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center"
                >
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-3">
                    <FileSpreadsheet className="w-7 h-7 text-emerald-400" />
                  </div>
                  <p className="text-sm font-medium text-emerald-300 mb-1">{excelFileName}</p>
                  <p className="text-xs text-emerald-500/60">点击或拖拽替换文件</p>
                </motion.div>
              ) : (
                <div className="flex flex-col items-center">
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 transition-colors ${
                      isDragOver
                        ? 'bg-cyan-500/15 border border-cyan-500/30'
                        : 'bg-studio-card border border-studio-border'
                    }`}
                  >
                    <Upload className={`w-6 h-6 ${isDragOver ? 'text-cyan-400' : 'text-slate-500'}`} />
                  </div>
                  <p className="text-sm text-slate-300 mb-1">
                    {isDragOver ? '释放以上传文件' : '点击或拖拽上传 Excel'}
                  </p>
                  <p className="text-xs text-slate-600">支持 .xlsx / .xls，自动提取"话术库"列</p>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="mt-4 p-3 rounded-xl bg-studio-card border border-studio-border">
              <p className="text-[11px] text-slate-500 leading-relaxed">
                <span className="text-amber-500/80 font-medium">提示：</span>
                Excel 文件需包含"话术库"列，每行文本将作为一条独立的录音任务导入工作区。
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
