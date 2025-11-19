// React Query hooks for instances

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { instancesApi, healthApi, metricsApi, logsApi } from '../lib/api';
import type { CreateInstanceRequest } from '../types';

// Query keys
export const instanceKeys = {
  all: ['instances'] as const,
  lists: () => [...instanceKeys.all, 'list'] as const,
  list: () => [...instanceKeys.lists()] as const,
  details: () => [...instanceKeys.all, 'detail'] as const,
  detail: (name: string) => [...instanceKeys.details(), name] as const,
  health: (name: string) => [...instanceKeys.all, 'health', name] as const,
  metrics: (name: string) => [...instanceKeys.all, 'metrics', name] as const,
  logs: (name: string, service?: string) =>
    [...instanceKeys.all, 'logs', name, service] as const,
};

// List all instances
export const useInstances = () => {
  return useQuery({
    queryKey: instanceKeys.list(),
    queryFn: instancesApi.list,
    refetchInterval: 10000, // Refetch every 10 seconds
  });
};

// Get single instance
export const useInstance = (name: string) => {
  return useQuery({
    queryKey: instanceKeys.detail(name),
    queryFn: () => instancesApi.get(name),
    enabled: !!name,
    refetchInterval: 5000, // Refetch every 5 seconds
  });
};

// Get instance health
export const useInstanceHealth = (name: string) => {
  return useQuery({
    queryKey: instanceKeys.health(name),
    queryFn: () => healthApi.get(name),
    enabled: !!name,
    refetchInterval: 10000,
  });
};

// Get instance metrics
export const useInstanceMetrics = (name: string) => {
  return useQuery({
    queryKey: instanceKeys.metrics(name),
    queryFn: () => metricsApi.getInstance(name),
    enabled: !!name,
    refetchInterval: 15000,
  });
};

// Get instance metrics history
export const useInstanceMetricsHistory = (
  name: string,
  timeRange: '1h' | '6h' | '24h' | '7d' = '1h'
) => {
  const getTimeRangeInMs = (range: string) => {
    const ranges: Record<string, number> = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
    };
    return ranges[range] || ranges['1h'];
  };

  const since = new Date(Date.now() - getTimeRangeInMs(timeRange)).toISOString();

  return useQuery({
    queryKey: [...instanceKeys.metrics(name), 'history', timeRange],
    queryFn: () => metricsApi.getHistory(name, since, 500),
    enabled: !!name,
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 20000, // Consider data stale after 20 seconds
  });
};

// Get instance logs
export const useInstanceLogs = (name: string, service?: string, tail = 100) => {
  return useQuery({
    queryKey: instanceKeys.logs(name, service),
    queryFn: () =>
      service
        ? logsApi.getService(name, service, tail)
        : logsApi.getInstance(name, tail),
    enabled: !!name,
    refetchInterval: 5000,
  });
};

// Get system metrics
export const useSystemMetrics = () => {
  return useQuery({
    queryKey: ['system', 'metrics'],
    queryFn: () => metricsApi.getSystem(),
    refetchInterval: 15000, // Refetch every 15 seconds
  });
};

// Create instance mutation
export const useCreateInstance = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (instance: CreateInstanceRequest) => instancesApi.create(instance),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: instanceKeys.lists() });
    },
  });
};

// Delete instance mutation
export const useDeleteInstance = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, removeVolumes }: { name: string; removeVolumes?: boolean }) =>
      instancesApi.delete(name, removeVolumes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: instanceKeys.lists() });
    },
  });
};

// Start instance mutation
export const useStartInstance = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => instancesApi.start(name),
    onSuccess: (_, name) => {
      queryClient.invalidateQueries({ queryKey: instanceKeys.detail(name) });
      queryClient.invalidateQueries({ queryKey: instanceKeys.lists() });
    },
  });
};

// Stop instance mutation
export const useStopInstance = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => instancesApi.stop(name),
    onSuccess: (_, name) => {
      queryClient.invalidateQueries({ queryKey: instanceKeys.detail(name) });
      queryClient.invalidateQueries({ queryKey: instanceKeys.lists() });
    },
  });
};

// Restart instance mutation
export const useRestartInstance = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => instancesApi.restart(name),
    onSuccess: (_, name) => {
      queryClient.invalidateQueries({ queryKey: instanceKeys.detail(name) });
      queryClient.invalidateQueries({ queryKey: instanceKeys.lists() });
    },
  });
};

// Restart service mutation
export const useRestartService = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, service }: { name: string; service: string }) =>
      instancesApi.restartService(name, service),
    onSuccess: (_, { name }) => {
      queryClient.invalidateQueries({ queryKey: instanceKeys.detail(name) });
    },
  });
};

// Refresh health mutation
export const useRefreshHealth = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => healthApi.refresh(name),
    onSuccess: (_, name) => {
      queryClient.invalidateQueries({ queryKey: instanceKeys.health(name) });
      queryClient.invalidateQueries({ queryKey: instanceKeys.detail(name) });
    },
  });
};
