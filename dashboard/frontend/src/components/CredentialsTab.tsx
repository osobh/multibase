import { useState } from 'react';
import type { SupabaseInstance } from '../types';
import { Eye, EyeOff, Copy, Check, Key, Link as LinkIcon, Database } from 'lucide-react';

interface CredentialsTabProps {
  instance: SupabaseInstance;
}

interface CredentialItemProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  isSecret?: boolean;
}

function CredentialItem({ label, value, icon, isSecret = false }: CredentialItemProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const displayValue = isSecret && !isRevealed ? '•'.repeat(20) : value;

  return (
    <div className="border rounded-lg p-4 hover:border-primary/50 transition-colors">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-muted-foreground mb-1">{label}</p>
          <div className="flex items-center gap-2">
            <code className="block px-3 py-2 bg-muted rounded text-sm font-mono break-all flex-1">
              {displayValue}
            </code>
            <div className="flex gap-1">
              {isSecret && (
                <button
                  onClick={() => setIsRevealed(!isRevealed)}
                  className="p-2 hover:bg-muted rounded transition-colors"
                  title={isRevealed ? 'Hide' : 'Reveal'}
                >
                  {isRevealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              )}
              <button
                onClick={handleCopy}
                className="p-2 hover:bg-muted rounded transition-colors"
                title="Copy to clipboard"
              >
                {isCopied ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CredentialsTab({ instance }: CredentialsTabProps) {
  const credentials = [
    {
      label: 'Project URL',
      value: instance.credentials.project_url,
      icon: <LinkIcon className="w-5 h-5 text-blue-600" />,
      isSecret: false,
    },
    {
      label: 'Anon Key',
      value: instance.credentials.anon_key,
      icon: <Key className="w-5 h-5 text-green-600" />,
      isSecret: true,
    },
    {
      label: 'Service Role Key',
      value: instance.credentials.service_role_key,
      icon: <Key className="w-5 h-5 text-red-600" />,
      isSecret: true,
    },
    {
      label: 'JWT Secret',
      value: instance.credentials.jwt_secret,
      icon: <Key className="w-5 h-5 text-purple-600" />,
      isSecret: true,
    },
    {
      label: 'Postgres Password',
      value: instance.credentials.postgres_password,
      icon: <Database className="w-5 h-5 text-yellow-600" />,
      isSecret: true,
    },
    {
      label: 'Dashboard Username',
      value: instance.credentials.dashboard_username,
      icon: <Key className="w-5 h-5 text-cyan-600" />,
      isSecret: false,
    },
    {
      label: 'Dashboard Password',
      value: instance.credentials.dashboard_password,
      icon: <Key className="w-5 h-5 text-orange-600" />,
      isSecret: true,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Warning Banner */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-medium text-yellow-800">Sensitive Information</h3>
            <p className="mt-1 text-sm text-yellow-700">
              These credentials provide access to your Supabase instance. Keep them secure and never share them publicly.
            </p>
          </div>
        </div>
      </div>

      {/* Credentials Grid */}
      <div className="grid grid-cols-1 gap-4">
        {credentials.map((cred) => (
          <CredentialItem
            key={cred.label}
            label={cred.label}
            value={cred.value}
            icon={cred.icon}
            isSecret={cred.isSecret}
          />
        ))}
      </div>

      {/* Port Mappings */}
      {instance.ports && Object.keys(instance.ports).length > 0 && (
        <div className="bg-card border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Port Mappings</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(instance.ports).map(([service, port]) => (
              <div key={service} className="border rounded p-3">
                <p className="text-sm text-muted-foreground capitalize">
                  {service.replace(/_/g, ' ')}
                </p>
                <p className="text-lg font-bold mt-1">{port || 'N/A'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instance Info */}
      <div className="bg-card border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Instance Information</h2>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Instance ID:</span>
            <span className="font-mono">{instance.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Instance Name:</span>
            <span className="font-mono">{instance.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status:</span>
            <span className={`px-2 py-1 rounded text-sm font-medium ${
              instance.status === 'running'
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-700'
            }`}>
              {instance.status}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Created:</span>
            <span>{new Date(instance.createdAt).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Last Updated:</span>
            <span>{new Date(instance.updatedAt).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
