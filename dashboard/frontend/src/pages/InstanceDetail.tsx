import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { useInstance, useStartInstance, useStopInstance, useRestartInstance } from '../hooks/useInstances';
import { Loader2, ChevronLeft, Play, Square, RotateCw, Server, Activity, BarChart3, FileText, Key } from 'lucide-react';
import ServicesTab from '../components/ServicesTab';
import MetricsTab from '../components/MetricsTab';
import LogsTab from '../components/LogsTab';
import CredentialsTab from '../components/CredentialsTab';

type TabType = 'services' | 'metrics' | 'logs' | 'credentials';

export default function InstanceDetail() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('services');

  const { data: instance, isLoading, error } = useInstance(name!);
  const startMutation = useStartInstance();
  const stopMutation = useStopInstance();
  const restartMutation = useRestartInstance();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !instance) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Server className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Instance not found</h2>
          <p className="text-muted-foreground mb-4">
            The instance "{name}" could not be found
          </p>
          <Link
            to="/"
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 inline-block"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'degraded':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'unhealthy':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const tabs = [
    { id: 'services' as TabType, label: 'Services', icon: Activity },
    { id: 'metrics' as TabType, label: 'Metrics', icon: BarChart3 },
    { id: 'logs' as TabType, label: 'Logs', icon: FileText },
    { id: 'credentials' as TabType, label: 'Credentials', icon: Key },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 hover:bg-muted rounded-md transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <Server className="w-6 h-6 text-primary" />
                <h1 className="text-2xl font-bold">{instance.name}</h1>
                <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getHealthColor(instance.health.overall)}`}>
                  {instance.health.overall}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {instance.credentials.project_url}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => restartMutation.mutate(instance.name)}
                disabled={restartMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 rounded-md transition-colors disabled:opacity-50"
              >
                <RotateCw className={`w-4 h-4 ${restartMutation.isPending ? 'animate-spin' : ''}`} />
                {restartMutation.isPending ? 'Restarting...' : 'Restart'}
              </button>
              {instance.status === 'running' || instance.health.overall === 'healthy' ? (
                <button
                  onClick={() => stopMutation.mutate(instance.name)}
                  disabled={stopMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-md transition-colors disabled:opacity-50"
                >
                  <Square className="w-4 h-4" />
                  {stopMutation.isPending ? 'Stopping...' : 'Stop'}
                </button>
              ) : (
                <button
                  onClick={() => startMutation.mutate(instance.name)}
                  disabled={startMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-md transition-colors disabled:opacity-50"
                >
                  <Play className="w-4 h-4" />
                  {startMutation.isPending ? 'Starting...' : 'Start'}
                </button>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-background rounded-lg p-4 border">
              <p className="text-xs text-muted-foreground mb-1">Services</p>
              <p className="text-2xl font-bold">
                {instance.health.healthyServices}/{instance.health.totalServices}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Healthy</p>
            </div>
            {instance.metrics && (
              <>
                <div className="bg-background rounded-lg p-4 border">
                  <p className="text-xs text-muted-foreground mb-1">CPU Usage</p>
                  <p className="text-2xl font-bold">{instance.metrics.cpu.toFixed(1)}%</p>
                </div>
                <div className="bg-background rounded-lg p-4 border">
                  <p className="text-xs text-muted-foreground mb-1">Memory</p>
                  <p className="text-2xl font-bold">{(instance.metrics.memory / 1024).toFixed(1)} GB</p>
                </div>
                <div className="bg-background rounded-lg p-4 border">
                  <p className="text-xs text-muted-foreground mb-1">Network</p>
                  <p className="text-2xl font-bold">
                    {((instance.metrics.networkRx + instance.metrics.networkTx) / 1024 / 1024).toFixed(1)} MB/s
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-6">
          <div className="flex gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-primary text-primary font-medium'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <main className="container mx-auto px-6 py-6">
        {activeTab === 'services' && <ServicesTab instance={instance} />}
        {activeTab === 'metrics' && <MetricsTab instance={instance} />}
        {activeTab === 'logs' && <LogsTab instance={instance} />}
        {activeTab === 'credentials' && <CredentialsTab instance={instance} />}
      </main>
    </div>
  );
}
