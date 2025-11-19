import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Settings,
  Plus,
  Trash2,
  ArrowLeft,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import {
  useAlertRules,
  useCreateAlertRule,
  useDeleteAlertRule,
  useUpdateAlertRule,
} from '../hooks/useAlerts';
import { useInstances } from '../hooks/useInstances';
import { Alert, CreateAlertRuleRequest } from '../types';
import { format } from 'date-fns';

export default function AlertRules() {
  const { data: rules, isLoading: rulesLoading } = useAlertRules();
  const { data: instances } = useInstances();
  const createRule = useCreateAlertRule();
  const updateRule = useUpdateAlertRule();
  const deleteRule = useDeleteAlertRule();

  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<Partial<CreateAlertRuleRequest>>({
    instanceId: '',
    name: '',
    rule: 'high_cpu',
    condition: {},
    threshold: 80,
    duration: 300,
    enabled: true,
    notificationChannels: ['browser'],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.instanceId || !formData.name || !formData.rule) {
      return;
    }

    const ruleData: CreateAlertRuleRequest = {
      instanceId: formData.instanceId,
      name: formData.name,
      rule: formData.rule,
      condition: formData.condition || {},
      threshold: formData.threshold,
      duration: formData.duration,
      enabled: formData.enabled,
      notificationChannels: formData.notificationChannels,
    };

    await createRule.mutateAsync(ruleData);
    setIsCreating(false);
    setFormData({
      instanceId: '',
      name: '',
      rule: 'high_cpu',
      condition: {},
      threshold: 80,
      duration: 300,
      enabled: true,
      notificationChannels: ['browser'],
    });
  };

  const handleToggleEnabled = async (rule: Alert) => {
    await updateRule.mutateAsync({
      id: rule.id,
      updates: { enabled: !rule.enabled },
    });
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this alert rule?')) {
      await deleteRule.mutateAsync(id);
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
              <Link
                to="/alerts"
                className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Alerts
              </Link>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                <Settings className="w-8 h-8" />
                Alert Rules
              </h1>
              <p className="text-muted-foreground mt-1">
                Configure alert rules and notification settings
              </p>
            </div>
            <button
              onClick={() => setIsCreating(!isCreating)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {isCreating ? 'Cancel' : 'Create Rule'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {/* Create Rule Form */}
        {isCreating && (
          <div className="bg-card border rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Create New Alert Rule</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Instance Selection */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Instance <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.instanceId}
                    onChange={(e) => setFormData({ ...formData, instanceId: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">Select instance...</option>
                    {instances?.map((instance) => (
                      <option key={instance.id} value={instance.id}>
                        {instance.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Rule Name */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Rule Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., High CPU Alert"
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                {/* Rule Type */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Rule Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.rule}
                    onChange={(e) => setFormData({ ...formData, rule: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="high_cpu">High CPU Usage</option>
                    <option value="high_memory">High Memory Usage</option>
                    <option value="high_disk">High Disk Usage</option>
                    <option value="service_down">Service Down</option>
                    <option value="slow_response">Slow Response Time</option>
                  </select>
                </div>

                {/* Threshold */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Threshold (%)
                  </label>
                  <input
                    type="number"
                    value={formData.threshold || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, threshold: parseFloat(e.target.value) })
                    }
                    placeholder="80"
                    min="0"
                    max="100"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                {/* Duration */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Duration (seconds)
                  </label>
                  <input
                    type="number"
                    value={formData.duration || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, duration: parseInt(e.target.value, 10) })
                    }
                    placeholder="300"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    How long the condition must persist before triggering
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createRule.isPending}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createRule.isPending ? 'Creating...' : 'Create Rule'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Rules List */}
        <div className="bg-card border rounded-lg overflow-hidden">
          {rulesLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !rules || rules.length === 0 ? (
            <div className="text-center py-12">
              <Settings className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No alert rules configured</h3>
              <p className="text-muted-foreground mb-4">
                Create your first alert rule to start monitoring
              </p>
              <button
                onClick={() => setIsCreating(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                <Plus className="w-4 h-4" />
                Create Rule
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Rule Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Instance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Threshold
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-muted/30">
                      <td className="px-6 py-4">
                        <div className="font-medium">{rule.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          to={`/instances/${rule.instance?.name}`}
                          className="text-blue-600 hover:underline"
                        >
                          {rule.instance?.name || rule.instanceId}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm">{getRuleName(rule.rule)}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm">{rule.threshold ? `${rule.threshold}%` : 'N/A'}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleEnabled(rule)}
                          disabled={updateRule.isPending}
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            rule.enabled
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {rule.enabled ? (
                            <>
                              <ToggleRight className="w-4 h-4" />
                              Enabled
                            </>
                          ) : (
                            <>
                              <ToggleLeft className="w-4 h-4" />
                              Disabled
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        {format(new Date(rule.createdAt), 'MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleDelete(rule.id)}
                            disabled={deleteRule.isPending}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium"
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </button>
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
