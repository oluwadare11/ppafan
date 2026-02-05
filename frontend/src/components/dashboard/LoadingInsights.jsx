// LoadingInsights.jsx - Display helpful business insights while dashboard loads
import React, { useState, useEffect } from 'react';
import { Lightbulb, TrendingUp, Target, Zap, BarChart3, Users } from 'lucide-react';

const businessInsights = [
  {
    icon: TrendingUp,
    title: "Track Your Growth",
    message: "Monitor daily sales trends to identify peak business hours",
    color: "text-blue-600 dark:text-blue-400"
  },
  {
    icon: Target,
    title: "Set Clear Goals",
    message: "Businesses with written goals are 42% more likely to achieve them",
    color: "text-green-600 dark:text-green-400"
  },
  {
    icon: Users,
    title: "Know Your Customers",
    message: "Returning customers spend 67% more than new ones on average",
    color: "text-purple-600 dark:text-purple-400"
  },
  {
    icon: BarChart3,
    title: "Data-Driven Decisions",
    message: "Review your dashboard weekly to spot opportunities early",
    color: "text-orange-600 dark:text-orange-400"
  },
  {
    icon: Zap,
    title: "Optimize Inventory",
    message: "Keep stock levels balanced to maximize cash flow and minimize waste",
    color: "text-yellow-600 dark:text-yellow-400"
  },
  {
    icon: Lightbulb,
    title: "Smart Pricing",
    message: "Use your sales data to identify best-selling products and optimize pricing",
    color: "text-indigo-600 dark:text-indigo-400"
  },
  {
    icon: TrendingUp,
    title: "Peak Performance",
    message: "Schedule staff strategically based on your busiest hours",
    color: "text-pink-600 dark:text-pink-400"
  },
  {
    icon: Target,
    title: "Focus on Profits",
    message: "Revenue is vanity, profit is sanity, cash flow is king",
    color: "text-teal-600 dark:text-teal-400"
  }
];

const LoadingInsights = ({ message = "Loading your dashboard..." }) => {
  const [currentInsight, setCurrentInsight] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Rotate insights every 3 seconds
    const insightInterval = setInterval(() => {
      setCurrentInsight((prev) => (prev + 1) % businessInsights.length);
    }, 3000);

    // Smooth progress animation
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return 90; // Cap at 90% until actual load completes
        return prev + Math.random() * 10;
      });
    }, 200);

    return () => {
      clearInterval(insightInterval);
      clearInterval(progressInterval);
    };
  }, []);

  const insight = businessInsights[currentInsight];
  const IconComponent = insight.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-2xl w-full">
        {/* Main loading card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 md:p-12 border border-gray-100">
          {/* Loading spinner */}
          <div className="flex justify-center mb-6 sm:mb-8">
            <div className="relative">
              {/* Outer spinning ring */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 border-4 border-gray-200 rounded-full" />
              <div className="absolute top-0 left-0 w-16 h-16 sm:w-20 sm:h-20 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />

              {/* Inner icon */}
              <div className="absolute inset-0 flex items-center justify-center">
                <BarChart3 className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600 animate-pulse" />
              </div>
            </div>
          </div>

          {/* Loading message */}
          <div className="text-center mb-4 sm:mb-6">
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
              {message}
            </h3>
            <p className="text-sm sm:text-base text-gray-600">
              Preparing your business insights...
            </p>
          </div>

          {/* Progress bar */}
          <div className="mb-6 sm:mb-8">
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-600 to-pink-600 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          </div>

          {/* Business insight card */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 sm:p-6 border border-purple-100">
            <div className="flex items-start gap-3 sm:gap-4">
              {/* Icon */}
              <div className={`p-2 sm:p-3 rounded-lg bg-white shadow-sm ${insight.color}`}>
                <IconComponent className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>

              {/* Content with fade-in animation */}
              <div className="flex-1 animate-fadeIn min-w-0">
                <h4 className="text-base sm:text-lg font-semibold text-gray-900 mb-1 sm:mb-2">
                  {insight.title}
                </h4>
                <p className="text-sm sm:text-base text-gray-700">
                  {insight.message}
                </p>
              </div>
            </div>
          </div>

          {/* Insight indicator dots */}
          <div className="flex justify-center gap-2 mt-4 sm:mt-6">
            {businessInsights.map((_, index) => (
              <div
                key={index}
                className={`h-2 rounded-full transition-all duration-300 ${
                  index === currentInsight
                    ? 'w-6 sm:w-8 bg-purple-600'
                    : 'w-2 bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Footer tip */}
        <div className="text-center mt-4 sm:mt-6">
          <p className="text-xs sm:text-sm text-gray-500">
            First load only - subsequent visits will be instant
          </p>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
      `}</style>
    </div>
  );
};

// Compact inline loader for silent refreshes
export const InlineLoader = ({ message = "Refreshing..." }) => {
  return (
    <div className="fixed top-4 right-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-3 animate-slideIn">
        {/* Spinner */}
        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />

        {/* Message */}
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {message}
        </span>
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default LoadingInsights;
