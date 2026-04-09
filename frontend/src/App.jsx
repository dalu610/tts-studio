import { useState, useEffect } from 'react';
import { FolderOpen, Download, Radio, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import InputZone from './components/InputZone';
import WorkZone from './components/WorkZone';
import ManagementPanel from './components/ManagementPanel';

function App() {
  const [texts, setTexts] = useState([]);
  const [showManagement, setShowManagement] = useState(false);
  const [mounted, setMounted] = useState(false);
  // 统一管理已完成的录音 ID
  const [completedIds, setCompletedIds] = useState(new Set());

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleExcelUpload = (uploadedTexts) => {
    setTexts(uploadedTexts);
    setCompletedIds(new Set());
  };

  // 录音完成/删除时同步 completedIds
  const handleRecordingComplete = (filename, completed) => {
    setCompletedIds((prev) => {
      const next = new Set(prev);
      completed ? next.add(filename) : next.delete(filename);
      return next;
    });
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-studio-bg noise-overlay">
      {/* Ambient background gradient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-amber-500/[0.03] rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[300px] bg-cyan-500/[0.03] rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <header
        className="relative flex-shrink-0 z-10 border-b border-studio-border"
        style={{
          background: 'linear-gradient(180deg, rgba(14,17,25,0.98) 0%, rgba(14,17,25,0.92) 100%)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
          {/* Left: Branding */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="flex items-center gap-4"
          >
            {/* Logo mark */}
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg glow-amber">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-studio-bg">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="currentColor" opacity="0.2"/>
                  <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="12" cy="12" r="3" fill="currentColor"/>
                </svg>
              </div>
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-studio-bg animate-pulse" />
            </div>
            <div>
              <h1 className="font-display font-extrabold text-xl text-white tracking-tight leading-none">
                TTS Studio
              </h1>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5 tracking-widest uppercase">
                语音合成数据采集
              </p>
            </div>
          </motion.div>

          {/* Center: Stats */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15, ease: 'easeOut' }}
            className="flex items-center gap-1 bg-studio-card border border-studio-border rounded-2xl px-4 py-2"
          >
            <div className="flex items-center gap-2 px-3">
              <Radio className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs text-slate-400">话术</span>
              <span className="font-mono font-medium text-amber-400 text-sm">{texts.length}</span>
            </div>
            <div className="w-px h-5 bg-studio-border" />
            <div className="flex items-center gap-2 px-3">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-xs text-slate-400">完成</span>
              <span className="font-mono font-medium text-emerald-400 text-sm">{completedIds.size}</span>
            </div>
          </motion.div>

          {/* Right: Actions */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
            className="flex items-center gap-3"
          >
            <button
              onClick={() => setShowManagement(true)}
              className="studio-btn-secondary flex items-center gap-2"
            >
              <FolderOpen className="w-4 h-4" />
              <span>录音管理</span>
            </button>
          </motion.div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative flex-1 overflow-hidden z-10">
        <div className="h-full max-w-[1600px] mx-auto px-6 py-5 grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Left: Input Zone */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 20 }}
            transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
            className="lg:col-span-2 studio-panel p-5 flex flex-col overflow-hidden"
          >
            <InputZone
              onExcelUpload={handleExcelUpload}
            />
          </motion.div>

          {/* Right: Work Zone */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 20 }}
            transition={{ duration: 0.6, delay: 0.3, ease: 'easeOut' }}
            className="lg:col-span-3 studio-panel p-5 flex flex-col overflow-hidden"
          >
            <WorkZone
              texts={texts}
              completedIds={completedIds}
              onRecordingComplete={handleRecordingComplete}
            />
          </motion.div>
        </div>
      </main>

      {/* Management Panel */}
      <AnimatePresence>
        {showManagement && (
          <ManagementPanel
            isOpen={showManagement}
            onClose={() => setShowManagement(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
