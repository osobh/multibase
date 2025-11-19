import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Check,
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  Settings,
} from 'lucide-react';
import { useAlerts, useAlertStats, useAcknowledgeAlert, useResolveAlert } from '../hooks/useAlerts';
import { Alert } from '../types';
import { format } from 'date-fns';

type StatusFilter = 'all' | 'active' | 'acknowledged' | 'resolved';

export default function Alerts() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const { data: stats, isLoading: statsLoading } = useAlertStats();
  const { data: alerts, isLoading: alertsLoading } = useAlerts(
    statusFilter !== 'all' ? { status: statusFilter } : {}
  );

  const acknowledge = useAcknowledgeAlert();
  const resolve = useResolveAlert();

  const getStatusColor = (status: Alert['status']) => {
    switch (status) {
      case 'active':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'acknowledged':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'resolved':
        return 'bg-green-100 text-green-700 border-green-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusIcon = (status: Alert['status']) => {
    switch (status) {
      case 'active':
        return <XCircle className="w-4 h-4" />;
      case 'acknowledged':
        return <Clock className="w-4 h-4" />;
      case 'resolved':
        return <CheckCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getRuleName = (rule: string) => {
    const ruleMap: Record<string, string> = {
      service_down: 'Service Down',
      high_cpu: 'High CPU Usage',
      high_memory: 'High Memory Usage',
      high_disk: 'High Disk Usage',
      slow_response: 'Slow Response Time',
    };
    return ruleMap[rule] || rule;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                <AlertTriangle className="w-8 h-8" />
                Alerts Center
              </h1>
              <p className="text-muted-foreground mt-1">
                Monitor and manage alerts across all instances
              </p>
            </div>
            <Link
              to="/alert-rules"
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              <Settings className="w-4 h-4" />
              Manage Rules
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-card border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Alerts</p>
                <p className="text-3xl font-bold mt-1">
                  {statsLoading ? '...' : stats?.total || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-gray-600" />
              </div>
            </div>
          </div>

          <div className="bg-card border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-3xl font-bold mt-1 text-red-600">
                  {statsLoading ? '...' : stats?.active || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-card border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Acknowledged</p>
                <p className="text-3xl font-bold mt-1 text-yellow-600">
                  {statsLoading ? '...' : stats?.acknowledged || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-card border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Resolved</p>
                <p className="text-3xl font-bold mt-1 text-green-600">
                  {statsLoading ? '...' : stats?.resolved || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-card border rounded-lg p-4 mb-6">
          <div className="flex items-center gap-4">
            <Filter className="w-5 h-5 text-muted-foreground" />
            <div className="flex gap-2">
              {(['all', 'active', 'acknowledged', 'resolved'] as StatusFilter[]).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    statusFilter === status
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Alerts List */}
        <div className="bg-card border rounded-lg overflow-hidden">
          {alertsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !alerts || alerts.length === 0 ? (
            <div className="text-center py-12">
              <AlertTriangle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No alerts found</h3>
              <p className="text-muted-foreground">
                {statusFilter === 'all'
                  ? 'No alerts have been triggered yet'
                  : `No ${statusFilter} alerts`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Alert
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Instance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Rule Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Triggered
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {alerts.map((alert) => (
                    <tr key={alert.id} className="hover:bg-muted/30">
                      <td className="px-6 py-4">
                        <div className="font-medium">{alert.name}</div>
                        {alert.message && (
                          <div className="text-sm text-muted-foreground mt-1">
                            {alert.message}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          to={`/instances/${alert.instance?.name}`}
                          className="text-blue-600 hover:underline"
                        >
                          {alert.instance?.name || alert.instanceId}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm">{getRuleName(alert.rule)}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(
                            alert.status
                          )}`}
                        >
                          {getStatusIcon(alert.status)}
                          {alert.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        {alert.triggeredAt
                          ? format(new Date(alert.triggeredAt), 'MMM d, HH:mm')
                          : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <div className="flex items-center justify-end gap-2">
                          {alert.status === 'active' && (
                            <button
                              onClick={() => acknowledge.mutate(alert.id)}
                              disabled={acknowledge.isPending}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium"
                            >
                              <Clock className="w-3 h-3" />
                              Acknowledge
                            </button>
                          )}
                          {(alert.status === 'active' || alert.status === 'acknowledged') && (
                            <button
                              onClick={() => resolve.mutate(alert.id)}
                              disabled={resolve.isPending}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium"
                            >
                              <Check className="w-3 h-3" />
                              Resolve
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
