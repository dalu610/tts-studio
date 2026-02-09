import { useState, useEffect } from 'react';
import { Download, RefreshCw, Play, Pause, Trash2, CheckSquare, Square } from 'lucide-react';

export default function ManagementPage({ onClose }) {
  const [recordings, setRecordings] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState(null);

  useEffect(() => {
    fetchRecordings();
  }, []);

  const fetchRecordings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/recordings');
      if (response.ok) {
        const data = await response.json();
        setRecordings(data.recordings || []);
      }
    } catch (error) {
      console.error('Failed to fetch recordings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selected.size === recordings.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(recordings.map((r) => r.filename)));
    }
  };

  const handleSelect = (filename) => {
    setSelected((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(filename)) {
        newSet.delete(filename);
      } else {
        newSet.add(filename);
      }
      return newSet;
    });
  };

  const handleDelete = async (filename) => {
    if (!confirm('确定要删除这条录音吗？')) return;

    const formData = new FormData();
    formData.append('filename', filename);

    try {
      const response = await fetch('/api/delete-audio', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        fetchRecordings();
        setSelected((prev) => {
          const newSet = new Set(prev);
          newSet.delete(filename);
          return newSet;
        });
      }
    } catch (error) {
      console.error('Delete failed:', error);
      alert('删除失败');
    }
  };

  const handleDeleteSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`确定要删除选中的 ${selected.size} 条录音吗？`)) return;

    let successCount = 0;
    for (const filename of selected) {
      const formData = new FormData();
      formData.append('filename', filename);

      try {
        const response = await fetch('/api/delete-audio', {
          method: 'POST',
          body: formData,
        });
        if (response.ok) successCount++;
      } catch (error) {
        console.error(`Failed to delete ${filename}:`, error);
      }
    }

    if (successCount > 0) {
      alert(`成功删除 ${successCount} 条录音`);
      fetchRecordings();
      setSelected(new Set());
    }
  };

  const handleExport = async () => {
    if (selected.size === 0) {
      alert('请先选择要导出的录音');
      return;
    }

    try {
      const response = await fetch('/api/export-dataset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: Array.from(selected),
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'tts_dataset_selected.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        alert('导出失败');
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('导出失败');
    }
  };

  const handlePlay = (recording) => {
    const audio = new Audio(`/api/audio/${recording.filename}`);
    if (playingId === recording.filename) {
      audio.pause();
      setPlayingId(null);
    } else {
      if (playingId) {
        const prevAudio = new Audio(`/api/audio/${playingId}`);
        prevAudio.pause();
      }
      audio.play();
      setPlayingId(recording.filename);
      audio.onended = () => setPlayingId(null);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
          <p className="text-gray-600 dark:text-gray-400">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-50 dark:bg-gray-900 z-50 flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
              录音管理
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              共 {recordings.length} 条录音
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <Square className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <button
            onClick={handleSelectAll}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors"
          >
            {selected.size === recordings.length ? (
              <CheckSquare className="w-4 h-4" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            <span>{selected.size === recordings.length ? '取消全选' : '全选'}</span>
          </button>
          <button
            onClick={handleExport}
            disabled={selected.size === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>导出选中 ({selected.size})</span>
          </button>
          <button
            onClick={handleDeleteSelected}
            disabled={selected.size === 0}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>删除选中 ({selected.size})</span>
          </button>
          <div className="flex-1" />
          <button
            onClick={fetchRecordings}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>刷新</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="max-w-7xl mx-auto">
          {recordings.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-600">
              <p>暂无录音数据</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recordings.map((recording) => (
                <div
                  key={recording.filename}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-4"
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selected.has(recording.filename)}
                    onChange={() => handleSelect(recording.filename)}
                    className="w-5 h-5 rounded border-gray-300 dark:border-gray-600"
                  />

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
                      {recording.text}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {recording.filename}
                    </p>
                  </div>

                  {/* Actions */}
                  <button
                    onClick={() => handlePlay(recording)}
                    className="p-2 text-gray-400 hover:text-blue-500 transition-colors"
                    title="播放"
                  >
                    {playingId === recording.filename ? (
                      <Pause className="w-5 h-5" />
                    ) : (
                      <Play className="w-5 h-5" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(recording.filename)}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    title="删除"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
