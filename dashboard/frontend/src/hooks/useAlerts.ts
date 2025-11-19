// React Query hooks for alerts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { alertsApi } from '../lib/api';
import type { CreateAlertRuleRequest } from '../types';
import { toast } from 'sonner';

// Query keys
export const alertKeys = {
  all: ['alerts'] as const,
  lists: () => [...alertKeys.all, 'list'] as const,
  list: (filters?: any) => [...alertKeys.lists(), filters] as const,
  stats: (instanceId?: string) => [...alertKeys.all, 'stats', instanceId] as const,
  rules: (filters?: any) => [...alertKeys.all, 'rules', filters] as const,
};

// List alerts
export const useAlerts = (params?: {
  status?: string;
  instanceId?: string;
  rule?: string;
  limit?: number;
}) => {
  return useQuery({
    queryKey: alertKeys.list(params),
    queryFn: () => alertsApi.list(params),
    refetchInterval: 10000, // Refetch every 10 seconds
  });
};

// Get alert stats
export const useAlertStats = (instanceId?: string) => {
  return useQuery({
    queryKey: alertKeys.stats(instanceId),
    queryFn: () => alertsApi.getStats(instanceId),
    refetchInterval: 10000,
  });
};

// List alert rules
export const useAlertRules = (params?: { instanceId?: string; enabled?: boolean }) => {
  return useQuery({
    queryKey: alertKeys.rules(params),
    queryFn: () => alertsApi.getRules(params),
  });
};

// Create alert rule mutation
export const useCreateAlertRule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (rule: CreateAlertRuleRequest) => alertsApi.createRule(rule),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: alertKeys.all });
      toast.success('Alert rule created successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to create alert rule', {
        description: error.message || 'An unexpected error occurred',
      });
    },
  });
};

// Update alert rule mutation
export const useUpdateAlertRule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: Partial<CreateAlertRuleRequest> }) =>
      alertsApi.updateRule(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: alertKeys.all });
      toast.success('Alert rule updated successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to update alert rule', {
        description: error.message || 'An unexpected error occurred',
      });
    },
  });
};

// Delete alert rule mutation
export const useDeleteAlertRule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => alertsApi.deleteRule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: alertKeys.all });
      toast.success('Alert rule deleted successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to delete alert rule', {
        description: error.message || 'An unexpected error occurred',
      });
    },
  });
};

// Acknowledge alert mutation
export const useAcknowledgeAlert = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => alertsApi.acknowledge(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: alertKeys.all });
      toast.success('Alert acknowledged');
    },
    onError: (error: any) => {
      toast.error('Failed to acknowledge alert', {
        description: error.message || 'An unexpected error occurred',
      });
    },
  });
};

// Resolve alert mutation
export const useResolveAlert = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => alertsApi.resolve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: alertKeys.all });
      toast.success('Alert resolved');
    },
    onError: (error: any) => {
      toast.error('Failed to resolve alert', {
        description: error.message || 'An unexpected error occurred',
      });
    },
  });
};
