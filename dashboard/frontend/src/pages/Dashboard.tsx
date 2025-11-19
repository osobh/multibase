import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useInstances, useSystemMetrics } from '../hooks/useInstances';
import { useAlertStats } from '../hooks/useAlerts';
import InstanceCard from '../components/InstanceCard';
import CreateInstanceModal from '../components/CreateInstanceModal';
import GaugeChart from '../components/charts/GaugeChart';
import { Loader2, Plus, AlertCircle, Bell, Activity, TrendingUp } from 'lucide-react';

export default function Dashboard() {
  const { data: instances, isLoading, error, refetch } = useInstances();
  const { data: alertStats } = useAlertStats();
  const { data: systemMetrics } = useSystemMetrics();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Failed to load instances</h2>
          <p className="text-muted-foreground mb-4">
            {error instanceof Error ? error.message : 'An error occurred'}
          </p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Multibase Dashboard</h1>
              <p className="text-muted-foreground mt-1">
                Manage your Supabase instances
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Alert Badge */}
              <Link
                to="/alerts"
                className="relative flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <Bell className="w-4 h-4" />
                Alerts
                {alertStats && alertStats.active > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                    {alertStats.active}
                  </span>
                )}
              </Link>

              <button
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                onClick={() => setIsCreateModalOpen(true)}
              >
                <Plus className="w-4 h-4" />
                Create Instance
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-card border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Instances</p>
                <p className="text-3xl font-bold mt-1">{instances?.length || 0}</p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-card border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Healthy</p>
                <p className="text-3xl font-bold mt-1 text-green-600">
                  {instances?.filter(i => i.health.overall === 'healthy').length || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-card border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Services</p>
                <p className="text-3xl font-bold mt-1">
                  {instances?.reduce((sum, i) => sum + i.services.length, 0) || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* System Overview Charts */}
        {systemMetrics && instances && instances.length > 0 && (
          <div className="bg-card border rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Activity className="w-6 h-6" />
              System Overview
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Total CPU Gauge */}
              <div className="flex flex-col items-center">
                <GaugeChart
                  label="Total CPU Usage"
                  value={systemMetrics.totalCpu}
                  icon={Activity}
                  size="lg"
                />
                <div className="mt-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    Across {systemMetrics?.runningCount ?? 0} running instance{(systemMetrics?.runningCount ?? 0) !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Total Memory Gauge */}
              <div className="flex flex-col items-center">
                <GaugeChart
                  label="Total Memory"
                  value={systemMetrics?.totalMemory ? (systemMetrics.totalMemory / 1024 / 10) * 100 : 0}
                  displayValue={systemMetrics?.totalMemory ? `${(systemMetrics.totalMemory / 1024).toFixed(1)} GB` : '0 GB'}
                  icon={TrendingUp}
                  color="purple"
                  size="lg"
                />
                <div className="mt-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    Combined memory usage
                  </p>
                </div>
              </div>

              {/* Instance Status Summary */}
              <div className="flex flex-col items-center justify-center">
                <div className="w-full max-w-xs space-y-4">
                  <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <span className="text-sm font-medium">Total Instances</span>
                    <span className="text-2xl font-bold text-blue-600">{systemMetrics?.instanceCount ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <span className="text-sm font-medium">Running</span>
                    <span className="text-2xl font-bold text-green-600">{systemMetrics?.runningCount ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <span className="text-sm font-medium">Stopped</span>
                    <span className="text-2xl font-bold text-gray-600">
                      {(systemMetrics.instanceCount ?? 0) - (systemMetrics.runningCount ?? 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 text-center">
              <p className="text-xs text-muted-foreground">
                Last updated: {systemMetrics?.timestamp ? new Date(systemMetrics.timestamp).toLocaleTimeString() : 'N/A'}
              </p>
            </div>
          </div>
        )}

        {/* Instance Grid */}
        {!instances || instances.length === 0 ? (
          <div className="text-center py-12 bg-card border rounded-lg">
            <svg className="w-16 h-16 text-muted-foreground mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <h3 className="text-xl font-semibold mb-2">No instances yet</h3>
            <p className="text-muted-foreground mb-4">
              Get started by creating your first Supabase instance
            </p>
            <button
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <Plus className="w-4 h-4 inline mr-2" />
              Create Instance
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {instances.map((instance) => (
              <InstanceCard key={instance.id} instance={instance} />
            ))}
          </div>
        )}
      </main>

      {/* Create Instance Modal */}
      <CreateInstanceModal open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen} />
    </div>
  );
}
