import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';

export function useConnectors() {
  return useQuery({
    queryKey: ['connectors'],
    queryFn: async () => {
      const response = await apiClient.get('/connectors');
      return response.data;
    },
    refetchInterval: 30 * 1000,
    staleTime: 15 * 1000,
  });
}

export function useSyncJobs(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['sync-jobs', params],
    queryFn: async () => {
      const response = await apiClient.get('/connectors/jobs', { params });
      return response.data;
    },
    refetchInterval: 10 * 1000,
  });
}
