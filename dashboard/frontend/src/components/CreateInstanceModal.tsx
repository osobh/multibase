import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Plus, AlertCircle, Check } from 'lucide-react';
import { useCreateInstance } from '../hooks/useInstances';
import { CreateInstanceRequest } from '../types';
import { toast } from 'sonner';

interface CreateInstanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormData extends CreateInstanceRequest {
  corsOriginsList: string; // Comma-separated list for UI
}

const initialFormData: FormData = {
  name: '',
  deploymentType: 'localhost',
  basePort: undefined,
  domain: '',
  protocol: 'http',
  corsOriginsList: '',
};

export default function CreateInstanceModal({ open, onOpenChange }: CreateInstanceModalProps) {
  const navigate = useNavigate();
  const createInstance = useCreateInstance();
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate name (required, alphanumeric + hyphens, Docker-compatible)
    if (!formData.name.trim()) {
      newErrors.name = 'Instance name is required';
    } else if (!/^[a-zA-Z0-9-_]+$/.test(formData.name)) {
      newErrors.name = 'Name can only contain letters, numbers, hyphens, and underscores';
    } else if (formData.name.length < 3) {
      newErrors.name = 'Name must be at least 3 characters';
    } else if (formData.name.length > 50) {
      newErrors.name = 'Name must be less than 50 characters';
    }

    // Validate base port (optional, but must be valid if provided)
    if (formData.basePort) {
      const port = Number(formData.basePort);
      if (isNaN(port) || port < 1024 || port > 65535) {
        newErrors.basePort = 'Port must be between 1024 and 65535';
      }
    }

    // Validate domain for cloud deployment
    if (formData.deploymentType === 'cloud') {
      if (!formData.domain || !formData.domain.trim()) {
        newErrors.domain = 'Domain is required for cloud deployment';
      } else if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(formData.domain)) {
        newErrors.domain = 'Invalid domain format';
      }
    }

    // Validate CORS origins (optional, but must be valid URLs if provided)
    if (formData.corsOriginsList.trim()) {
      const origins = formData.corsOriginsList.split(',').map((o) => o.trim());
      for (const origin of origins) {
        if (origin && !isValidUrl(origin)) {
          newErrors.corsOriginsList = `Invalid URL: ${origin}`;
          break;
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Prepare request data
    const requestData: CreateInstanceRequest = {
      name: formData.name.trim(),
      deploymentType: formData.deploymentType,
      ...(formData.basePort && { basePort: Number(formData.basePort) }),
      ...(formData.domain && { domain: formData.domain.trim() }),
      ...(formData.protocol && { protocol: formData.protocol }),
    };

    // Parse CORS origins if provided
    if (formData.corsOriginsList.trim()) {
      requestData.corsOrigins = formData.corsOriginsList
        .split(',')
        .map((o) => o.trim())
        .filter((o) => o.length > 0);
    }

    try {
      await createInstance.mutateAsync(requestData);

      // Show success toast with credentials info
      toast.success('Instance created successfully!', {
        description: `${formData.name} is being initialized. Credentials have been auto-generated.`,
        duration: 5000,
      });

      // Reset form and close modal
      setFormData(initialFormData);
      setErrors({});
      onOpenChange(false);

      // Navigate to instance detail page
      navigate(`/instances/${formData.name}`);
    } catch (error: any) {
      toast.error('Failed to create instance', {
        description: error.message || 'An unexpected error occurred',
      });
    }
  };

  const handleInputChange = (field: keyof FormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto z-50">
          <div className="flex items-center justify-between mb-6">
            <Dialog.Title className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Plus className="w-6 h-6" />
              Create New Instance
            </Dialog.Title>
            <Dialog.Close className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X className="w-5 h-5" />
            </Dialog.Close>
          </div>

          <Dialog.Description className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Create a new Supabase instance. All credentials will be auto-generated securely.
          </Dialog.Description>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b pb-2">
                Basic Information
              </h3>

              {/* Instance Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Instance Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="my-supabase-instance"
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white ${
                    errors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.name}
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Alphanumeric characters, hyphens, and underscores only (3-50 chars)
                </p>
              </div>

              {/* Deployment Type */}
              <div>
                <label htmlFor="deploymentType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Deployment Type <span className="text-red-500">*</span>
                </label>
                <select
                  id="deploymentType"
                  value={formData.deploymentType}
                  onChange={(e) => handleInputChange('deploymentType', e.target.value as 'localhost' | 'cloud')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="localhost">Localhost (Development)</option>
                  <option value="cloud">Cloud (Production)</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {formData.deploymentType === 'localhost'
                    ? 'Instance will be accessible on localhost'
                    : 'Instance will be configured for cloud deployment with custom domain'}
                </p>
              </div>
            </div>

            {/* Port Configuration Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b pb-2">
                Port Configuration
              </h3>

              {/* Base Port */}
              <div>
                <label htmlFor="basePort" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Base Port (Optional)
                </label>
                <input
                  type="number"
                  id="basePort"
                  value={formData.basePort || ''}
                  onChange={(e) => handleInputChange('basePort', e.target.value)}
                  placeholder="Auto-assigned (recommended)"
                  min="1024"
                  max="65535"
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white ${
                    errors.basePort ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                />
                {errors.basePort && (
                  <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.basePort}
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Leave empty for automatic port allocation. Services will use consecutive ports from base.
                </p>
              </div>
            </div>

            {/* Cloud Configuration Section */}
            {formData.deploymentType === 'cloud' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b pb-2">
                  Cloud Configuration
                </h3>

                {/* Domain */}
                <div>
                  <label htmlFor="domain" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Domain <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="domain"
                    value={formData.domain}
                    onChange={(e) => handleInputChange('domain', e.target.value)}
                    placeholder="api.example.com"
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white ${
                      errors.domain ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                  />
                  {errors.domain && (
                    <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.domain}
                    </p>
                  )}
                </div>

                {/* Protocol */}
                <div>
                  <label htmlFor="protocol" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Protocol
                  </label>
                  <select
                    id="protocol"
                    value={formData.protocol}
                    onChange={(e) => handleInputChange('protocol', e.target.value as 'http' | 'https')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="http">HTTP</option>
                    <option value="https">HTTPS (Recommended)</option>
                  </select>
                </div>
              </div>
            )}

            {/* Advanced Options Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b pb-2">
                Advanced Options
              </h3>

              {/* CORS Origins */}
              <div>
                <label htmlFor="corsOrigins" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  CORS Origins (Optional)
                </label>
                <input
                  type="text"
                  id="corsOrigins"
                  value={formData.corsOriginsList}
                  onChange={(e) => handleInputChange('corsOriginsList', e.target.value)}
                  placeholder="https://app.example.com, https://admin.example.com"
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white ${
                    errors.corsOriginsList ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                />
                {errors.corsOriginsList && (
                  <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.corsOriginsList}
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Comma-separated list of allowed origins. Leave empty to allow all origins.
                </p>
              </div>
            </div>

            {/* Security Notice */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
              <div className="flex gap-2">
                <Check className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800 dark:text-blue-300">
                  <p className="font-semibold mb-1">Auto-Generated Credentials</p>
                  <p className="text-blue-700 dark:text-blue-400">
                    All credentials (JWT secret, database password, API keys, etc.) will be automatically
                    generated using cryptographically secure methods. You can view them on the instance
                    detail page after creation.
                  </p>
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={createInstance.isPending}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createInstance.isPending}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {createInstance.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Create Instance
                  </>
                )}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
