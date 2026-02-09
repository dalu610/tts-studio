import { useState } from 'react';
import RecordingCard from './RecordingCard';
import LoadingSkeleton from './LoadingSkeleton';

export default function WorkZone({ variants, isLoading, onGenerate, onVariantsChange }) {
  const [recordedIndices, setRecordedIndices] = useState(new Set());

  const handleRecordingComplete = (index, completed) => {
    setRecordedIndices((prev) => {
      const newSet = new Set(prev);
      if (completed) {
        newSet.add(index);
      } else {
        newSet.delete(index);
      }
      return newSet;
    });
  };

  const handleTextChange = (index, newText) => {
    onVariantsChange?.(index, newText);
  };

  const handleDeleteVariant = (index) => {
    onVariantsChange?.(index, null, true); // null for newText, true for delete flag
  };

  const completedCount = recordedIndices.size;
  const totalCount = variants.length;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
          话术变体
          {variants.length > 0 && (
            <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
              ({completedCount}/{totalCount} 已录制)
            </span>
          )}
        </h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <LoadingSkeleton count={5} />
        ) : variants.length > 0 ? (
          <div className="space-y-4">
            {variants.map((text, index) => (
              <RecordingCard
                key={index}
                text={text}
                index={index}
                onRecordingComplete={handleRecordingComplete}
                onTextChange={handleTextChange}
                onDelete={handleDeleteVariant}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-600">
            <p>在左侧输入种子话术生成变体，或导入 Excel 文件</p>
          </div>
        )}
      </div>
    </div>
  );
}
