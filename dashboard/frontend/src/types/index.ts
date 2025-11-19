// Multibase Dashboard Frontend Types

export interface SupabaseInstance {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'degraded' | 'healthy' | 'unhealthy';
  basePort: number;
  ports: PortMapping;
  credentials: InstanceCredentials;
  services: ServiceStatus[];
  health: HealthStatus;
  metrics?: ResourceMetrics;
  createdAt: string;
  updatedAt: string;
}

export interface PortMapping {
  kong_http: number;
  kong_https: number;
  studio: number;
  postgres: number;
  pooler: number;
  analytics: number;
}

export interface InstanceCredentials {
  project_url: string;
  anon_key: string;
  service_role_key: string;
  postgres_password: string;
  jwt_secret: string;
  dashboard_username: string;
  dashboard_password: string;
}

export interface ServiceStatus {
  name: string;
  containerName: string;
  status: 'running' | 'stopped' | 'healthy' | 'unhealthy' | 'starting';
  health: 'healthy' | 'unhealthy' | 'unknown';
  uptime: number;
  cpu: number;
  memory: number;
}

export interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy' | 'stopped';
  healthyServices: number;
  totalServices: number;
  lastChecked: string;
}

export interface ResourceMetrics {
  cpu: number;
  memory: number;
  networkRx: number;
  networkTx: number;
  diskRead: number;
  diskWrite: number;
  timestamp: string;
}

export interface CreateInstanceRequest {
  name: string;
  basePort?: number;
  deploymentType: 'localhost' | 'cloud';
  domain?: string;
  protocol?: 'http' | 'https';
  corsOrigins?: string[];
}

export interface SystemMetrics {
  totalCpu: number;
  totalMemory: number;
  totalDisk: number;
  instanceCount: number;
  runningCount: number;
  timestamp: string;
}

export interface Alert {
  id: number;
  instanceId: string;
  name: string;
  rule: string;
  condition: string;
  threshold?: number;
  duration?: number;
  enabled: boolean;
  status: 'active' | 'acknowledged' | 'resolved';
  triggeredAt?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  message?: string;
  notificationChannels?: string;
  webhookUrl?: string;
  createdAt: string;
  updatedAt: string;
  instance?: {
    name: string;
    status?: string;
  };
}

export interface AlertStats {
  total: number;
  active: number;
  acknowledged: number;
  resolved: number;
}

export interface CreateAlertRuleRequest {
  instanceId: string;
  name: string;
  rule: string;
  condition: any;
  threshold?: number;
  duration?: number;
  enabled?: boolean;
  notificationChannels?: string[];
  webhookUrl?: string;
}
