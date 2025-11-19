import { LucideIcon } from 'lucide-react';

interface GaugeChartProps {
  label: string;
  value: number; // 0-100 percentage
  displayValue?: string; // Optional custom display value
  icon?: LucideIcon;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'cyan' | 'pink' | 'yellow' | 'red';
  size?: 'sm' | 'md' | 'lg';
}

const colorClasses = {
  blue: {
    stroke: 'stroke-blue-600',
    text: 'text-blue-600',
    bg: 'bg-blue-100',
    ringBg: 'stroke-blue-100',
  },
  green: {
    stroke: 'stroke-green-600',
    text: 'text-green-600',
    bg: 'bg-green-100',
    ringBg: 'stroke-green-100',
  },
  purple: {
    stroke: 'stroke-purple-600',
    text: 'text-purple-600',
    bg: 'bg-purple-100',
    ringBg: 'stroke-purple-100',
  },
  orange: {
    stroke: 'stroke-orange-600',
    text: 'text-orange-600',
    bg: 'bg-orange-100',
    ringBg: 'stroke-orange-100',
  },
  cyan: {
    stroke: 'stroke-cyan-600',
    text: 'text-cyan-600',
    bg: 'bg-cyan-100',
    ringBg: 'stroke-cyan-100',
  },
  pink: {
    stroke: 'stroke-pink-600',
    text: 'text-pink-600',
    bg: 'bg-pink-100',
    ringBg: 'stroke-pink-100',
  },
  yellow: {
    stroke: 'stroke-yellow-600',
    text: 'text-yellow-600',
    bg: 'bg-yellow-100',
    ringBg: 'stroke-yellow-100',
  },
  red: {
    stroke: 'stroke-red-600',
    text: 'text-red-600',
    bg: 'bg-red-100',
    ringBg: 'stroke-red-100',
  },
};

const sizeConfig = {
  sm: {
    width: 80,
    height: 80,
    strokeWidth: 6,
    fontSize: 'text-lg',
    iconSize: 'w-4 h-4',
  },
  md: {
    width: 120,
    height: 120,
    strokeWidth: 8,
    fontSize: 'text-2xl',
    iconSize: 'w-5 h-5',
  },
  lg: {
    width: 160,
    height: 160,
    strokeWidth: 10,
    fontSize: 'text-3xl',
    iconSize: 'w-6 h-6',
  },
};

export default function GaugeChart({
  label,
  value,
  displayValue,
  icon: Icon,
  color = 'blue',
  size = 'md',
}: GaugeChartProps) {
  // Clamp value between 0-100, handle both undefined and NaN
  const safeValue = (value == null || isNaN(value)) ? 0 : value;
  const normalizedValue = Math.min(Math.max(safeValue, 0), 100);

  // Get dynamic color based on value if not specified
  const getAutoColor = (val: number): typeof color => {
    if (val >= 90) return 'red';
    if (val >= 75) return 'orange';
    if (val >= 50) return 'yellow';
    return 'green';
  };

  const finalColor = value > 100 ? getAutoColor(normalizedValue) : color;
  const colors = colorClasses[finalColor];
  const config = sizeConfig[size];

  // SVG circle calculations
  const radius = (config.width - config.strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (normalizedValue / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Gauge SVG */}
      <div className="relative" style={{ width: config.width, height: config.height }}>
        <svg
          width={config.width}
          height={config.height}
          className="transform -rotate-90"
          viewBox={`0 0 ${config.width} ${config.height}`}
        >
          {/* Background circle */}
          <circle
            cx={config.width / 2}
            cy={config.height / 2}
            r={radius}
            className={colors.ringBg}
            strokeWidth={config.strokeWidth}
            fill="none"
          />

          {/* Progress circle */}
          <circle
            cx={config.width / 2}
            cy={config.height / 2}
            r={radius}
            className={`${colors.stroke} transition-all duration-500 ease-in-out`}
            strokeWidth={config.strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {Icon && (
            <div className={`${colors.bg} p-2 rounded-full mb-1`}>
              <Icon className={`${config.iconSize} ${colors.text}`} />
            </div>
          )}
          <span className={`${config.fontSize} font-bold ${colors.text}`}>
            {displayValue || `${normalizedValue.toFixed(0)}%`}
          </span>
        </div>
      </div>

      {/* Label */}
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 text-center">
        {label}
      </p>
    </div>
  );
}
