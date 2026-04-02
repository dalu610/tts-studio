import { Radio } from 'lucide-react';
import { motion } from 'framer-motion';
import RecordingCard from './RecordingCard';
import LoadingSkeleton from './LoadingSkeleton';

export default function WorkZone({
  variants,
  isLoading,
  completedIds,
  onVariantsChange,
  onRecordingComplete,
}) {
  const completedCount = completedIds.size;
  const totalCount = variants.length;
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const handleRecordingComplete = (index, completed) => {
    // Use index as the key since variants are stable
    onRecordingComplete?.(String(index), completed);
  };

  const handleDeleteVariant = (index) => {
    onVariantsChange?.(index, null, true);
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-1 h-5 bg-gradient-to-b from-cyan-500 to-cyan-600 rounded-full" />
          <h2 className="font-display font-semibold text-base text-white tracking-tight">
            话术变体
          </h2>
          {totalCount > 0 && (
            <div className="flex items-center gap-2 bg-studio-bg border border-studio-border rounded-xl px-3 py-1">
              <span className="font-mono text-sm text-emerald-400">{completedCount}</span>
              <span className="text-slate-600 text-sm">/</span>
              <span className="font-mono text-sm text-slate-400">{totalCount}</span>
              <span className="text-xs text-slate-600 ml-1">已完成</span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {totalCount > 0 && (
          <div className="flex items-center gap-3">
            <div className="w-32 h-1.5 bg-studio-bg rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
            <span className="font-mono text-xs text-slate-500">{Math.round(progressPct)}%</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0 pr-0.5">
        {isLoading ? (
          <LoadingSkeleton count={15} />
        ) : variants.length > 0 ? (
          <div className="space-y-3">
            {variants.map((text, index) => (
              <RecordingCard
                key={`${text}-${index}`}
                text={text}
                index={index}
                isRecorded={completedIds.has(String(index))}
                onRecordingComplete={handleRecordingComplete}
                onTextChange={(idx, newText) => onVariantsChange?.(idx, newText)}
                onDelete={handleDeleteVariant}
              />
            ))}
          </div>
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center py-12">
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-3xl bg-studio-card border border-studio-border flex items-center justify-center">
          <Radio className="w-9 h-9 text-slate-600" />
        </div>
        <div className="absolute inset-0 rounded-3xl border border-dashed border-studio-border -z-10 scale-125" />
      </div>
      <h3 className="font-display font-semibold text-slate-400 text-base mb-2">
        还没有话术变体
      </h3>
      <p className="text-slate-600 text-sm max-w-[240px] leading-relaxed">
        在左侧输入种子话术或导入 Excel 文件，即可开始创建录音数据集
      </p>
      <div className="flex items-center gap-1.5 mt-8">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-studio-border"
            style={{ animationDelay: `${i * 200}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
