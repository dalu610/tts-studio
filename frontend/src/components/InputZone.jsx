import { useState, useRef } from 'react';
import { Wand2, FileSpreadsheet, Upload, Type } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function InputZone({ onGenerate, isLoading, onExcelUpload }) {
  const [seedText, setSeedText] = useState('');
  const [activeTab, setActiveTab] = useState('text'); // 'text' | 'excel'
  const [excelFileName, setExcelFileName] = useState('');
  const fileInputRef = useRef(null);

  const handleGenerate = () => {
    if (seedText.trim()) {
      onGenerate(seedText.trim());
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setExcelFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

        // Parse with headers to get column names
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);

        // Find "话术库" column
        let texts = [];
        if (jsonData.length > 0) {
          const firstRow = jsonData[0];
          const columnKey = Object.keys(firstRow).find(key =>
            key.trim() === '话术库' || key.trim().includes('话术')
          );

          if (columnKey) {
            // Extract from "话术库" column
            texts = jsonData
              .map(row => row[columnKey])
              .filter(text => text && String(text).trim() !== '' && String(text).trim() !== columnKey)
              .map(text => String(text).trim());
          } else {
            // Fallback: try to find any column that contains text data
            const allKeys = Object.keys(firstRow);
            for (const key of allKeys) {
              const columnData = jsonData
                .map(row => row[key])
                .filter(text => text && String(text).trim() !== '');
              if (columnData.length > texts.length) {
                texts = columnData.map(text => String(text).trim());
              }
            }
          }
        }

        if (texts.length === 0) {
          alert('Excel 文件中没有找到有效的文本数据，请确保包含"话术库"列');
          return;
        }

        if (onExcelUpload) {
          onExcelUpload(texts);
        }
      } catch (error) {
        console.error('Excel parsing error:', error);
        alert('Excel 文件解析失败，请检查文件格式');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      fileInputRef.current.files = e.dataTransfer.files;
      handleFileChange({ target: { files: e.dataTransfer.files } });
    } else {
      alert('请上传 Excel 文件 (.xlsx 或 .xls)');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  return (
    <div className="h-full flex flex-col">
      {/* Tab Navigation */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('text')}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'text'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          <Type className="w-4 h-4" />
          <span>话术变体</span>
        </button>
        <button
          onClick={() => setActiveTab('excel')}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'excel'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Excel 导入</span>
        </button>
      </div>

      {/* Text Input Tab */}
      {activeTab === 'text' && (
        <div className="flex-1 flex flex-col">
          <h2 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">种子话术输入</h2>
          <textarea
            value={seedText}
            onChange={(e) => setSeedText(e.target.value)}
            placeholder="输入种子话术，例如：你好，欢迎使用我们的产品"
            className="flex-1 w-full p-4 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white mb-4"
          />
          <button
            onClick={handleGenerate}
            disabled={isLoading || !seedText.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
          >
            <Wand2 className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? '生成中...' : '生成变体'}</span>
          </button>
        </div>
      )}

      {/* Excel Upload Tab */}
      {activeTab === 'excel' && (
        <div className="flex-1 flex flex-col">
          <h2 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">Excel 导入</h2>
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="flex-1 flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
            />
            <Upload className="w-12 h-12 text-gray-400 mb-3" />
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-1">
              点击或拖拽上传 Excel 文件
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
              支持 .xlsx, .xls 格式，将提取"话术库"列的数据
            </p>
            {excelFileName && (
              <div className="mt-4 px-3 py-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <p className="text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4" />
                  {excelFileName}
                </p>
              </div>
            )}
          </div>
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-xs text-blue-700 dark:text-blue-300">
              <strong>提示：</strong>将提取 Excel 文件中"话术库"列的每一行作为录音文本
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
