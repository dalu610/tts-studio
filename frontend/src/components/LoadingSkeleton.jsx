export default function LoadingSkeleton({ count = 15 }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 animate-pulse"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded flex-1 mr-2"></div>
          </div>
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
        </div>
      ))}
    </div>
  );
}
