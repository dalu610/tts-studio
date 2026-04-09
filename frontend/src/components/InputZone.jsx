import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet } from 'lucide-react';
import { motion } from 'framer-motion';
import * as XLSX from 'xlsx';

export default function InputZone({ onExcelUpload }) {
  const [excelFileName, setExcelFileName] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

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
      <div className="flex items-center gap-2 mb-5">
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
    </div>
  );
}
