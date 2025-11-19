// Multibase Dashboard TypeScript Type Definitions

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
  createdAt: Date;
  updatedAt: Date;
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
  uptime: number; // seconds
  cpu: number; // percentage
  memory: number; // MB
}

export interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy' | 'stopped';
  healthyServices: number;
  totalServices: number;
  lastChecked: Date;
}

export interface ResourceMetrics {
  cpu: number;
  memory: number;
  networkRx: number;
  networkTx: number;
  diskRead: number;
  diskWrite: number;
  timestamp: Date;
}

export interface ContainerStats {
  cpu_stats: {
    cpu_usage: {
      total_usage: number;
      percpu_usage?: number[];
    };
    system_cpu_usage: number;
    online_cpus: number;
  };
  precpu_stats: {
    cpu_usage: {
      total_usage: number;
    };
    system_cpu_usage: number;
  };
  memory_stats: {
    usage: number;
    max_usage: number;
    limit: number;
  };
  networks?: {
    [key: string]: {
      rx_bytes: number;
      tx_bytes: number;
    };
  };
  blkio_stats: {
    io_service_bytes_recursive?: Array<{
      op: string;
      value: number;
    }>;
  };
}

export interface CreateInstanceRequest {
  name: string;
  basePort?: number;
  deploymentType: 'localhost' | 'cloud';
  domain?: string;
  protocol?: 'http' | 'https';
  corsOrigins?: string[];
}

export interface UpdateInstanceRequest {
  corsOrigins?: string[];
  domain?: string;
  protocol?: 'http' | 'https';
  regenerateKeys?: boolean;
}

export interface AlertRule {
  id?: number;
  instanceId: string;
  name: string;
  rule: 'service_down' | 'high_cpu' | 'high_memory' | 'high_disk' | 'error_rate' | 'connection_count';
  condition: AlertCondition;
  threshold?: number;
  duration?: number; // seconds
  enabled: boolean;
  notificationChannels?: ('browser' | 'webhook')[];
  webhookUrl?: string;
}

export interface AlertCondition {
  operator: '>' | '<' | '=' | '>=' | '<=';
  value: number;
  service?: string;
}

export interface Alert {
  id: number;
  instanceId: string;
  name: string;
  rule: string;
  message: string;
  status: 'active' | 'acknowledged' | 'resolved';
  triggeredAt: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
}

export interface DockerContainerInfo {
  Id: string;
  Name: string;
  State: {
    Status: string;
    Running: boolean;
    StartedAt: string;
  };
  Config: {
    Labels: {
      [key: string]: string;
    };
  };
  NetworkSettings: {
    Ports: {
      [key: string]: Array<{
        HostPort: string;
      }> | null;
    };
  };
}

export interface LogFilter {
  instanceId?: string;
  service?: string;
  level?: 'error' | 'warn' | 'info' | 'debug';
  search?: string;
  since?: Date;
  tail?: number;
}

export interface EnvConfig {
  [key: string]: string;
}

export interface SystemMetrics {
  totalCpu: number;
  totalMemory: number;
  totalDisk: number;
  instanceCount: number;
  runningCount: number;
  timestamp: Date;
}
