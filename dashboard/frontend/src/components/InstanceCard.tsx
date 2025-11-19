import { Link, useNavigate } from 'react-router-dom';
import type { SupabaseInstance } from '../types';
import { Activity, Server, CheckCircle, XCircle, AlertCircle, Play, Square } from 'lucide-react';
import { useStartInstance, useStopInstance } from '../hooks/useInstances';

interface InstanceCardProps {
  instance: SupabaseInstance;
}

export default function InstanceCard({ instance }: InstanceCardProps) {
  const navigate = useNavigate();
  const startMutation = useStartInstance();
  const stopMutation = useStopInstance();

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-100';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-100';
      case 'unhealthy':
        return 'text-red-600 bg-red-100';
      case 'stopped':
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5" />;
      case 'degraded':
        return <AlertCircle className="w-5 h-5" />;
      case 'unhealthy':
        return <XCircle className="w-5 h-5" />;
      default:
        return <Activity className="w-5 h-5" />;
    }
  };

  const handleStart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await startMutation.mutateAsync(instance.name);
  };

  const handleStop = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm(`Are you sure you want to stop ${instance.name}?`)) {
      await stopMutation.mutateAsync(instance.name);
    }
  };

  return (
    <Link to={`/instances/${instance.name}`} className="block">
      <div className="bg-card border rounded-lg p-6 hover:shadow-lg transition-all hover:border-primary/50 cursor-pointer">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Server className="w-5 h-5 text-primary" />
              {instance.name}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {instance.credentials.project_url}
            </p>
          </div>
          <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${getHealthColor(instance.health.overall)}`}>
            {getHealthIcon(instance.health.overall)}
            <span className="capitalize">{instance.health.overall}</span>
          </div>
        </div>

        {/* Services Stats */}
        <div className="mb-4 pb-4 border-b">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Services</span>
            <span className="font-medium">
              {instance.health.healthyServices} / {instance.health.totalServices} healthy
            </span>
          </div>
          <div className="mt-2 flex-1 bg-muted rounded-full h-2 overflow-hidden">
            <div
              className="bg-green-500 h-full transition-all"
              style={{
                width: `${(instance.health.healthyServices / instance.health.totalServices) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* Metrics */}
        {instance.metrics && (
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs text-muted-foreground">CPU</p>
              <p className="text-lg font-semibold">{instance.metrics.cpu.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Memory</p>
              <p className="text-lg font-semibold">{(instance.metrics.memory / 1024).toFixed(1)} GB</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {instance.status === 'running' || instance.health.overall === 'healthy' ? (
            <button
              onClick={handleStop}
              disabled={stopMutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-destructive/10 text-destructive rounded-md hover:bg-destructive/20 transition-colors text-sm font-medium disabled:opacity-50"
            >
              <Square className="w-4 h-4" />
              {stopMutation.isPending ? 'Stopping...' : 'Stop'}
            </button>
          ) : (
            <button
              onClick={handleStart}
              disabled={startMutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors text-sm font-medium disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              {startMutation.isPending ? 'Starting...' : 'Start'}
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/instances/${instance.name}`);
            }}
            className="flex items-center justify-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            View Details
          </button>
        </div>

        {/* Last Checked */}
        <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
          Last checked: {new Date(instance.health.lastChecked).toLocaleTimeString()}
        </div>
      </div>
    </Link>
  );
}
