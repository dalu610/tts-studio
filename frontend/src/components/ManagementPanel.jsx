import { useState, useEffect } from 'react';
import { Download, RefreshCw, Play, Pause, Trash2, CheckSquare, Square, X, FolderOpen, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ManagementPanel({ isOpen, onClose, onRecordingsChange }) {
  const [recordings, setRecordings] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [playingId, setPlayingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchRecordings();
      setSearchQuery('');
      setSelected(new Set());
    }
  }, [isOpen]);

  const fetchRecordings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/recordings');
      if (res.ok) setRecordings((await res.json()).recordings || []);
    } catch {} finally {
      setLoading(false);
    }
  };

  const filtered = recordings.filter((r) =>
    r.text?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.filename?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectAll = () => {
    setSelected((prev) =>
      prev.size === filtered.length ? new Set() : new Set(filtered.map((r) => r.filename))
    );
  };

  const handleSelect = (fn) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(fn) ? next.delete(fn) : next.add(fn);
      return next;
    });
  };

  const handleDelete = async (fn) => {
    if (!confirm('确定删除这条录音？')) return;
    const fd = new FormData();
    fd.append('filename', fn);
    const res = await fetch('/api/delete-audio', { method: 'POST', body: fd });
    if (res.ok) {
      setRecordings((p) => p.filter((r) => r.filename !== fn));
      setSelected((p) => { const n = new Set(p); n.delete(fn); return n; });
      onRecordingsChange?.();
    }
  };

  const handleDeleteSelected = async () => {
    if (!selected.size || !confirm(`删除选中的 ${selected.size} 条录音？`)) return;
    let ok = 0;
    for (const fn of selected) {
      const fd = new FormData();
      fd.append('filename', fn);
      if (await fetch('/api/delete-audio', { method: 'POST', body: fd }).then((r) => r.ok)) ok++;
    }
    if (ok) {
      setRecordings((p) => p.filter((r) => !selected.has(r.filename)));
      setSelected(new Set());
      onRecordingsChange?.();
    }
  };

  const handleExportAll = async () => {
    try {
      const res = await fetch('/api/export-dataset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: recordings.map((r) => r.filename) }),
      });
      if (res.ok) downloadBlob(await res.blob(), 'tts_dataset_all.zip');
    } catch {}
  };

  const handleExportSelected = async () => {
    if (!selected.size) return;
    try {
      const res = await fetch('/api/export-dataset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: Array.from(selected) }),
      });
      if (res.ok) downloadBlob(await res.blob(), `tts_dataset_${selected.size}files.zip`);
    } catch {}
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePlay = (recording) => {
    if (playingId === recording.filename) { setPlayingId(null); return; }
    setPlayingId(recording.filename);
    const audio = new Audio(`/api/audio/${recording.filename}`);
    audio.play();
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => setPlayingId(null);
  };

  const handleCopyText = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(9,11,17,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="w-full max-w-5xl max-h-[88vh] rounded-2xl border border-studio-border bg-studio-surface shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-studio-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <FolderOpen className="w-4.5 h-4.5 text-amber-400" />
            </div>
            <div>
              <h2 className="font-display font-700 text-white text-base">录音管理</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {loading ? '加载中...' : `${recordings.length} 条录音`}
                {selected.size > 0 && <span className="text-cyan-400 ml-1">· 已选 {selected.size}</span>}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-studio-card border border-studio-border text-slate-500 hover:text-white hover:border-studio-border-light transition-all flex items-center justify-center active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-studio-border flex-shrink-0 bg-studio-bg/50">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索话术或文件名..."
              className="w-full pl-9 pr-3 py-2 bg-studio-card border border-studio-border rounded-xl text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
            />
          </div>

          <div className="w-px h-5 bg-studio-border" />

          {/* Select all */}
          <button
            onClick={handleSelectAll}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-studio-border text-xs text-slate-400 hover:text-white hover:border-studio-border-light transition-all active:scale-95"
          >
            {selected.size === filtered.length && filtered.length > 0
              ? <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
              : <Square className="w-3.5 h-3.5" />
            }
            {selected.size === filtered.length && filtered.length > 0 ? '取消全选' : '全选'}
          </button>

          {/* Export selected */}
          <button
            onClick={handleExportSelected}
            disabled={!selected.size}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs hover:bg-emerald-500/20 hover:border-emerald-500/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            导出选中 {selected.size > 0 ? `(${selected.size})` : ''}
          </button>

          {/* Export all */}
          <button
            onClick={handleExportAll}
            disabled={!recordings.length}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs hover:bg-cyan-500/20 hover:border-cyan-500/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            导出全部
          </button>

          {/* Delete selected */}
          <button
            onClick={handleDeleteSelected}
            disabled={!selected.size}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs hover:bg-red-500/20 hover:border-red-500/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
          >
            <Trash2 className="w-3.5 h-3.5" />
            删除 {selected.size > 0 ? `(${selected.size})` : ''}
          </button>

          <div className="flex-1" />

          {/* Refresh */}
          <button
            onClick={fetchRecordings}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-studio-border text-xs text-slate-400 hover:text-white hover:border-studio-border-light transition-all active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="flex flex-col items-center gap-3">
                <svg className="w-6 h-6 animate-spin text-amber-500" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="12" strokeLinecap="round" />
                </svg>
                <span className="text-sm text-slate-500">加载中...</span>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center h-48">
              <p className="text-sm text-slate-600">
                {recordings.length === 0 ? '暂无录音数据' : '没有匹配的录音'}
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 bg-studio-surface z-10">
                <tr className="border-b border-studio-border">
                  <th className="w-10 px-4 py-2" />
                  <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">话术文本</th>
                  <th className="w-28 text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">文件名</th>
                  <th className="w-28 px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((recording, i) => (
                  <motion.tr
                    key={recording.filename}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className={`border-b border-studio-border/50 hover:bg-studio-card/50 transition-colors group ${
                      selected.has(recording.filename) ? 'bg-cyan-500/[0.04]' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(recording.filename)}
                        onChange={() => handleSelect(recording.filename)}
                        className="w-4 h-4 rounded border-studio-border bg-studio-card accent-cyan-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-sm text-slate-300 cursor-pointer hover:text-amber-400 transition-colors"
                          onClick={() => handleCopyText(recording.text)}
                          title="点击复制"
                        >
                          {recording.text}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="font-mono text-[11px] text-slate-600">{recording.filename}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handlePlay(recording)}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                            playingId === recording.filename
                              ? 'bg-cyan-500/20 text-cyan-400'
                              : 'text-slate-600 hover:text-cyan-400 hover:bg-cyan-500/10'
                          }`}
                          title="播放"
                        >
                          {playingId === recording.filename
                            ? <Pause className="w-3.5 h-3.5" />
                            : <Play className="w-3.5 h-3.5" />
                          }
                        </button>
                        <button
                          onClick={() => handleDelete(recording.filename)}
                          className="w-8 h-8 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-colors"
                          title="删除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </motion.div>

      {/* Copied toast */}
      <AnimatePresence>
        {copied && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-medium"
          >
            已复制到剪贴板
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
