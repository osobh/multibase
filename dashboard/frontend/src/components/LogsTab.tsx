import { useState, useEffect, useRef } from 'react';
import type { SupabaseInstance } from '../types';
import { useInstanceLogs } from '../hooks/useInstances';
import { useWebSocket } from '../hooks/useWebSocket';
import { FileText, Download, RefreshCw } from 'lucide-react';

interface LogsTabProps {
  instance: SupabaseInstance;
}

export default function LogsTab({ instance }: LogsTabProps) {
  const [selectedService, setSelectedService] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const { data: fetchedLogs, refetch } = useInstanceLogs(
    instance.name,
    selectedService || undefined,
    100
  );

  const { subscribeLogs, unsubscribeLogs, onLogs, offLogs } = useWebSocket();

  useEffect(() => {
    if (fetchedLogs) {
      setLogs(fetchedLogs.split('\n').filter(Boolean));
    }
  }, [fetchedLogs]);

  useEffect(() => {
    // Subscribe to real-time logs
    subscribeLogs(instance.name, selectedService || undefined);

    const handleLogData = (data: any) => {
      if (data.logs) {
        setLogs((prev) => [...prev, ...data.logs.split('\n').filter(Boolean)]);
      }
    };

    onLogs(handleLogData);

    return () => {
      offLogs(handleLogData);
      unsubscribeLogs();
    };
  }, [instance.name, selectedService]);

  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleDownload = () => {
    const blob = new Blob([logs.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${instance.name}-${selectedService || 'all'}-logs.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    setLogs([]);
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-card border rounded-lg p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <select
              value={selectedService}
              onChange={(e) => {
                setSelectedService(e.target.value);
                setLogs([]);
              }}
              className="px-4 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All Services</option>
              {instance.services.map((service) => (
                <option key={service.name} value={service.name}>
                  {service.name}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded border-gray-300"
              />
              Auto-scroll
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 rounded-md transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={handleClear}
              className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-md transition-colors"
            >
              Clear
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          </div>
        </div>
      </div>

      {/* Logs Display */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          <span className="font-medium">
            {selectedService || 'All Services'} Logs
          </span>
          <span className="text-sm text-muted-foreground">
            ({logs.length} lines)
          </span>
        </div>
        <div className="h-[600px] overflow-y-auto bg-black/95 text-green-400 font-mono text-sm">
          <div className="p-4">
            {logs.length === 0 ? (
              <div className="text-muted-foreground text-center py-12">
                No logs available. Logs will appear here in real-time.
              </div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="hover:bg-white/5 px-2 py-1">
                  <span className="text-gray-500 mr-4">{index + 1}</span>
                  {log}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
