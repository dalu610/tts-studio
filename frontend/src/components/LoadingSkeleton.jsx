import { motion } from 'framer-motion';

export default function LoadingSkeleton({ count = 15 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.03, duration: 0.3 }}
          className="rounded-xl border border-studio-border bg-studio-card overflow-hidden"
        >
          {/* Header skeleton */}
          <div className="p-4">
            <div className="flex items-start gap-3 mb-3">
              {/* Index badge skeleton */}
              <div className="w-8 h-8 rounded-lg skeleton-pulse bg-studio-bg flex-shrink-0" />

              {/* Text skeleton */}
              <div className="flex-1 space-y-2">
                <div className="h-3.5 rounded-full bg-studio-bg skeleton-pulse" style={{ width: `${60 + Math.random() * 30}%` }} />
                <div className="h-3 rounded-full bg-studio-bg skeleton-pulse" style={{ width: `${30 + Math.random() * 40}%` }} />
              </div>

              {/* Status badge skeleton */}
              <div className="w-16 h-6 rounded-lg skeleton-pulse bg-studio-bg flex-shrink-0" />
            </div>

            {/* Controls skeleton */}
            <div className="flex items-center gap-2">
              <div className="h-8 w-20 rounded-xl skeleton-pulse bg-studio-bg" />
              <div className="h-8 w-16 rounded-xl skeleton-pulse bg-studio-bg" />
            </div>
          </div>
        </motion.div>
      ))}

      <style>{`
        .skeleton-pulse {
          animation: shimmer 1.8s ease-in-out infinite;
          background: linear-gradient(
            90deg,
            rgba(30, 35, 51, 0.6) 25%,
            rgba(37, 43, 61, 0.8) 50%,
            rgba(30, 35, 51, 0.6) 75%
          );
          background-size: 200% 100%;
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
