import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface DataPoint {
  name: string;
  [key: string]: any;
}

interface BarConfig {
  key: string;
  label: string;
  color: string;
}

interface BarChartProps {
  data: DataPoint[];
  bars: BarConfig[];
  title?: string;
  height?: number;
  yAxisLabel?: string;
  yAxisFormatter?: (value: number) => string;
  tooltipFormatter?: (value: number, name: string) => string;
  loading?: boolean;
}

const defaultYAxisFormatter = (value: number) => {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return value.toFixed(0);
};

const defaultTooltipFormatter = (value: number) => {
  return value.toFixed(2);
};

export default function BarChart({
  data,
  bars,
  title,
  height = 300,
  yAxisLabel,
  yAxisFormatter = defaultYAxisFormatter,
  tooltipFormatter = defaultTooltipFormatter,
  loading = false,
}: BarChartProps) {
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
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
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
        <RechartsBarChart
          data={data}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="name"
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis
            tickFormatter={yAxisFormatter}
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
            label={
              yAxisLabel
                ? {
                    value: yAxisLabel,
                    angle: -90,
                    position: 'insideLeft',
                    style: { fontSize: '12px', fill: '#6b7280' },
                  }
                : undefined
            }
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              padding: '8px 12px',
            }}
            formatter={(value: number, name: string) => [
              tooltipFormatter(value, name),
              bars.find((b) => b.key === name)?.label || name,
            ]}
          />
          <Legend
            wrapperStyle={{ fontSize: '12px' }}
            formatter={(value) => {
              const bar = bars.find((b) => b.key === value);
              return bar?.label || value;
            }}
          />
          {bars.map((bar) => (
            <Bar
              key={bar.key}
              dataKey={bar.key}
              fill={bar.color}
              name={bar.key}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
