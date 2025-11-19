// WebSocket hook for real-time updates

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { instanceKeys } from './useInstances';

export const useWebSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const queryClient = useQueryClient();
  const initializedRef = useRef(false);

  useEffect(() => {
    // Prevent double-initialization in React Strict Mode
    if (initializedRef.current) {
      return;
    }
    initializedRef.current = true;

    // Connect to Socket.io
    const socket = io({
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      console.log('✅ WebSocket connected');
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', reason);
    });

    // Error events
    socket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error);
    });

    socket.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
    });

    // Backend error events
    socket.on('instances:error', (data) => {
      console.error('❌ Instances error from backend:', data);
    });

    // Instance list updates
    socket.on('instances:list', () => {
      queryClient.invalidateQueries({ queryKey: instanceKeys.lists() });
    });

    // Health updates
    socket.on('health:update', (event: { instanceName: string }) => {
      if (event.instanceName) {
        queryClient.invalidateQueries({
          queryKey: instanceKeys.detail(event.instanceName)
        });
        queryClient.invalidateQueries({
          queryKey: instanceKeys.health(event.instanceName)
        });
      }
      queryClient.invalidateQueries({ queryKey: instanceKeys.lists() });
    });

    // Metrics updates
    socket.on('metrics:update', (metrics: { instanceName: string }) => {
      if (metrics.instanceName) {
        queryClient.invalidateQueries({
          queryKey: instanceKeys.metrics(metrics.instanceName)
        });
      }
    });

    // Alert triggered
    socket.on('alert:triggered', (alert: any) => {
      console.log('Alert triggered:', alert);
      // Could show a notification here
    });

    // Cleanup: Don't disconnect the socket
    // The socket connection should persist across component re-renders and React Strict Mode cycles
    // It will only disconnect when the browser tab is closed or page is truly unloaded
    return () => {
      // No cleanup needed - socket persists
    };
  }, [queryClient]);

  const subscribeLogs = (instanceName: string, serviceName?: string) => {
    if (socketRef.current) {
      socketRef.current.emit('logs:subscribe', { instanceName, serviceName });
    }
  };

  const unsubscribeLogs = () => {
    if (socketRef.current) {
      socketRef.current.emit('logs:unsubscribe');
    }
  };

  const onLogs = (callback: (data: any) => void) => {
    if (socketRef.current) {
      socketRef.current.on('logs:data', callback);
    }
  };

  const offLogs = (callback: (data: any) => void) => {
    if (socketRef.current) {
      socketRef.current.off('logs:data', callback);
    }
  };

  return {
    subscribeLogs,
    unsubscribeLogs,
    onLogs,
    offLogs,
  };
};
