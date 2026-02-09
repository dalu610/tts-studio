import { useState } from 'react';
import { FolderOpen } from 'lucide-react';
import InputZone from './components/InputZone';
import WorkZone from './components/WorkZone';
import ManagementPanel from './components/ManagementPanel';

function App() {
  const [variants, setVariants] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showManagement, setShowManagement] = useState(false);

  const handleGenerate = async (seedText) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/expand-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          seed_text: seedText,
          count: 5,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setVariants(data.variants);
      } else {
        console.error('Generation failed');
        alert('生成失败，请重试');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('网络错误，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVariantsChange = (index, newText, isDelete = false) => {
    setVariants((prev) => {
      const newVariants = [...prev];
      if (isDelete) {
        newVariants.splice(index, 1);
      } else {
        newVariants[index] = newText;
      }
      return newVariants;
    });
  };

  const handleExcelUpload = (texts) => {
    // Add Excel texts to variants directly
    setVariants(texts);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
              TTS 数据采集服务
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              用于语音合成模型训练的数据采集工具
            </p>
          </div>
          <button
            onClick={() => setShowManagement(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <FolderOpen className="w-4 h-4" />
            <span>管理录音</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-[calc(100vh-180px)]">
          {/* Left: Input Zone */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <InputZone onGenerate={handleGenerate} isLoading={isLoading} onExcelUpload={handleExcelUpload} />
          </div>

          {/* Right: Work Zone */}
          <div className="lg:col-span-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <WorkZone
              variants={variants}
              isLoading={isLoading}
              onVariantsChange={handleVariantsChange}
            />
          </div>
        </div>
      </main>

      {/* Management Panel */}
      <ManagementPanel isOpen={showManagement} onClose={() => setShowManagement(false)} />
    </div>
  );
}

export default App;
