import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';

interface DataPoint {
  timestamp: string;
  [key: string]: any; // Allow any additional metrics
}

interface LineConfig {
  key: string;
  label: string;
  color: string;
}

interface LineChartProps {
  data: DataPoint[];
  lines: LineConfig[];
  title?: string;
  height?: number;
  xAxisFormatter?: (value: string) => string;
  yAxisFormatter?: (value: number) => string;
  tooltipFormatter?: (value: number, name: string) => string;
  loading?: boolean;
}

const defaultXAxisFormatter = (value: string) => {
  try {
    return format(new Date(value), 'HH:mm');
  } catch {
    return value;
  }
};

const defaultYAxisFormatter = (value: number) => {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return value.toFixed(0);
};

const defaultTooltipFormatter = (value: number) => {
  if (typeof value === 'number') {
    return value.toFixed(2);
  }
  return value;
};

export default function LineChart({
  data,
  lines,
  title,
  height = 300,
  xAxisFormatter = defaultXAxisFormatter,
  yAxisFormatter = defaultYAxisFormatter,
  tooltipFormatter = defaultTooltipFormatter,
  loading = false,
}: LineChartProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-gray-400" style={{ height }}>
        <svg
          className="w-16 h-16 mb-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
          />
        </svg>
        <p className="text-sm">No data available</p>
      </div>
    );
  }

  return (
    <div>
      {title && (
        <h3 className="text-base font-semibold mb-4 text-gray-900 dark:text-white">
          {title}
        </h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsLineChart
          data={data}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={xAxisFormatter}
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
          />
          <YAxis
            tickFormatter={yAxisFormatter}
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              padding: '8px 12px',
            }}
            labelFormatter={(label) => {
              try {
                return format(new Date(label), 'MMM d, HH:mm:ss');
              } catch {
                return label;
              }
            }}
            formatter={(value: number, name: string) => [
              tooltipFormatter(value, name),
              lines.find((l) => l.key === name)?.label || name,
            ]}
          />
          <Legend
            wrapperStyle={{ fontSize: '12px' }}
            formatter={(value) => {
              const line = lines.find((l) => l.key === value);
              return line?.label || value;
            }}
          />
          {lines.map((line) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              stroke={line.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              name={line.key}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}
