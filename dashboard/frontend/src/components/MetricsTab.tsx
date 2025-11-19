import { useState } from 'react';
import type { SupabaseInstance } from '../types';
import { Activity, Cpu, HardDrive, Network, TrendingUp, Clock, BarChart3 } from 'lucide-react';
import GaugeChart from './charts/GaugeChart';
import LineChart from './charts/LineChart';
import BarChart from './charts/BarChart';
import { useInstanceMetricsHistory } from '../hooks/useInstances';

interface MetricsTabProps {
  instance: SupabaseInstance;
}

type TimeRange = '1h' | '6h' | '24h' | '7d';

export default function MetricsTab({ instance }: MetricsTabProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('1h');
  const { data: historyData, isLoading: historyLoading } = useInstanceMetricsHistory(
    instance.name,
    timeRange
  );
  if (!instance.metrics) {
    return (
      <div className="bg-card border rounded-lg p-12 text-center">
        <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-lg text-muted-foreground">No metrics available</p>
      </div>
    );
  }

  // Assume memory is in MB, calculate percentage based on typical 4GB limit (adjustable)
  const memoryLimitGB = 4;
  const memoryGB = instance.metrics.memory / 1024;
  const memoryPercent = (memoryGB / memoryLimitGB) * 100;

  const secondaryMetrics = [
    {
      label: 'Network RX',
      value: `${(instance.metrics.networkRx / 1024 / 1024).toFixed(2)} MB/s`,
      icon: Network,
      color: 'text-purple-600 bg-purple-100',
    },
    {
      label: 'Network TX',
      value: `${(instance.metrics.networkTx / 1024 / 1024).toFixed(2)} MB/s`,
      icon: TrendingUp,
      color: 'text-orange-600 bg-orange-100',
    },
    {
      label: 'Disk Read',
      value: `${(instance.metrics.diskRead / 1024 / 1024).toFixed(2)} MB/s`,
      icon: HardDrive,
      color: 'text-cyan-600 bg-cyan-100',
    },
    {
      label: 'Disk Write',
      value: `${(instance.metrics.diskWrite / 1024 / 1024).toFixed(2)} MB/s`,
      icon: HardDrive,
      color: 'text-pink-600 bg-pink-100',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Primary Metrics - Gauges */}
      <div className="bg-card border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Current Resource Usage
        </h2>
        <div className="flex justify-center gap-12 flex-wrap">
          <GaugeChart
            label="CPU Usage"
            value={instance.metrics.cpu}
            icon={Cpu}
            size="lg"
          />
          <GaugeChart
            label="Memory"
            value={memoryPercent}
            displayValue={`${memoryGB.toFixed(1)} GB`}
            icon={HardDrive}
            color="green"
            size="lg"
          />
        </div>
      </div>

      {/* Secondary Metrics - Cards */}
      <div className="bg-card border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-6">Network & Disk I/O</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {secondaryMetrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <div key={metric.label} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-lg ${metric.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <p className="text-sm text-muted-foreground">{metric.label}</p>
                </div>
                <p className="text-xl font-bold">{metric.value}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Time Series Trends */}
      <div className="bg-card border rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Resource Trends
          </h2>

          {/* Time Range Selector */}
          <div className="flex gap-2">
            {(['1h', '6h', '24h', '7d'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  timeRange === range
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {range.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-8">
          {/* CPU & Memory Chart */}
          <div className="border rounded-lg p-4">
            <LineChart
              data={historyData || []}
              lines={[
                { key: 'cpu', label: 'CPU Usage (%)', color: '#3b82f6' },
                { key: 'memory', label: 'Memory (MB)', color: '#10b981' },
              ]}
              title="CPU & Memory Usage"
              height={300}
              loading={historyLoading}
              tooltipFormatter={(value, name) => {
                if (name === 'cpu') return `${value.toFixed(1)}%`;
                if (name === 'memory') return `${value.toFixed(0)} MB`;
                return value.toFixed(2);
              }}
            />
          </div>

          {/* Network Chart */}
          <div className="border rounded-lg p-4">
            <LineChart
              data={historyData || []}
              lines={[
                { key: 'networkRx', label: 'Network RX (MB/s)', color: '#8b5cf6' },
                { key: 'networkTx', label: 'Network TX (MB/s)', color: '#f97316' },
              ]}
              title="Network Traffic"
              height={250}
              loading={historyLoading}
              tooltipFormatter={(value) => `${(value / 1024 / 1024).toFixed(3)} MB/s`}
              yAxisFormatter={(value) => `${(value / 1024 / 1024).toFixed(1)}`}
            />
          </div>

          {/* Disk I/O Chart */}
          <div className="border rounded-lg p-4">
            <LineChart
              data={historyData || []}
              lines={[
                { key: 'diskRead', label: 'Disk Read (MB/s)', color: '#06b6d4' },
                { key: 'diskWrite', label: 'Disk Write (MB/s)', color: '#ec4899' },
              ]}
              title="Disk I/O"
              height={250}
              loading={historyLoading}
              tooltipFormatter={(value) => `${(value / 1024 / 1024).toFixed(3)} MB/s`}
              yAxisFormatter={(value) => `${(value / 1024 / 1024).toFixed(1)}`}
            />
          </div>
        </div>
      </div>

      {/* Service Comparison Bar Charts */}
      <div className="bg-card border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Service Resource Comparison
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* CPU Comparison */}
          <div className="border rounded-lg p-4">
            <BarChart
              data={instance.services.map((service) => ({
                name: service.name,
                cpu: service.cpu,
              }))}
              bars={[{ key: 'cpu', label: 'CPU Usage (%)', color: '#3b82f6' }]}
              title="CPU Usage by Service"
              height={300}
              yAxisFormatter={(value) => `${value.toFixed(0)}%`}
              tooltipFormatter={(value) => `${value.toFixed(1)}%`}
            />
          </div>

          {/* Memory Comparison */}
          <div className="border rounded-lg p-4">
            <BarChart
              data={instance.services.map((service) => ({
                name: service.name,
                memory: service.memory,
              }))}
              bars={[{ key: 'memory', label: 'Memory (MB)', color: '#10b981' }]}
              title="Memory Usage by Service"
              height={300}
              yAxisFormatter={(value) => `${value.toFixed(0)}`}
              tooltipFormatter={(value) => `${value.toFixed(0)} MB`}
            />
          </div>
        </div>
      </div>

      {/* Per-Service Metrics Table */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b bg-muted/30">
          <h2 className="text-lg font-semibold">Service Metrics Table</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Service
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  CPU
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Memory
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {instance.services.map((service) => (
                <tr key={service.name} className="hover:bg-muted/30">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium">{service.name}</div>
                    <div className="text-sm text-muted-foreground">{service.containerName}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium">{service.cpu.toFixed(1)}%</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium">{service.memory.toFixed(0)} MB</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      service.health === 'healthy'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {service.health}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Timestamp */}
      <div className="text-sm text-muted-foreground text-center">
        Last updated: {new Date(instance.metrics.timestamp).toLocaleString()}
      </div>
    </div>
  );
}
