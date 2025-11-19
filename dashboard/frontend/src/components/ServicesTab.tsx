import type { SupabaseInstance } from '../types';
import { CheckCircle, XCircle, AlertCircle, RotateCw, Activity } from 'lucide-react';
import { useRestartService } from '../hooks/useInstances';

interface ServicesTabProps {
  instance: SupabaseInstance;
}

export default function ServicesTab({ instance }: ServicesTabProps) {
  const restartServiceMutation = useRestartService();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-100';
      case 'unhealthy':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5" />;
      case 'unhealthy':
        return <XCircle className="w-5 h-5" />;
      default:
        return <AlertCircle className="w-5 h-5" />;
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const handleRestartService = async (serviceName: string) => {
    if (confirm(`Are you sure you want to restart the ${serviceName} service?`)) {
      await restartServiceMutation.mutateAsync({
        name: instance.name,
        service: serviceName,
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Overview */}
      <div className="bg-card border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Services Overview</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Total Services</p>
            <p className="text-2xl font-bold mt-1">{instance.health.totalServices}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Healthy</p>
            <p className="text-2xl font-bold mt-1 text-green-600">{instance.health.healthyServices}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Unhealthy</p>
            <p className="text-2xl font-bold mt-1 text-red-600">
              {instance.health.totalServices - instance.health.healthyServices}
            </p>
          </div>
        </div>
      </div>

      {/* Services List */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b bg-muted/30">
          <h2 className="text-lg font-semibold">Services</h2>
        </div>
        <div className="divide-y">
          {instance.services.map((service) => (
            <div key={service.name} className="p-6 hover:bg-muted/30 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <Activity className="w-5 h-5 text-primary" />
                    <div>
                      <h3 className="font-semibold text-lg">{service.name}</h3>
                      <p className="text-sm text-muted-foreground">{service.containerName}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  {/* Status */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Status</p>
                    <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(service.health)}`}>
                      {getStatusIcon(service.health)}
                      <span className="capitalize">{service.health}</span>
                    </div>
                  </div>

                  {/* Uptime */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Uptime</p>
                    <p className="text-sm font-medium">{formatUptime(service.uptime)}</p>
                  </div>

                  {/* CPU */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">CPU</p>
                    <p className="text-sm font-medium">{service.cpu.toFixed(1)}%</p>
                  </div>

                  {/* Memory */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Memory</p>
                    <p className="text-sm font-medium">{service.memory.toFixed(0)} MB</p>
                  </div>

                  {/* Actions */}
                  <button
                    onClick={() => handleRestartService(service.name)}
                    disabled={restartServiceMutation.isPending}
                    className="p-2 hover:bg-muted rounded-md transition-colors disabled:opacity-50"
                    title="Restart service"
                  >
                    <RotateCw className={`w-4 h-4 ${restartServiceMutation.isPending ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
