import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import { TenderFilter, TenderListResponse, Tender } from '@licitapp/shared';

export function useTenders(filters: Partial<TenderFilter>) {
  return useQuery<TenderListResponse>({
    queryKey: ['tenders', filters],
    queryFn: async () => {
      const params = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== undefined && v !== null && v !== '')
      );
      const response = await apiClient.get('/tenders', { params });
      return response.data;
    },
    placeholderData: (prev) => prev,
  });
}

export function useTender(id: string) {
  return useQuery<Tender>({
    queryKey: ['tenders', id],
    queryFn: async () => {
      const response = await apiClient.get(`/tenders/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useTenderStats() {
  return useQuery({
    queryKey: ['tenders', 'stats'],
    queryFn: async () => {
      const response = await apiClient.get('/tenders/stats/summary');
      return response.data;
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useSaveTender() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tenderId: string) => {
      const response = await apiClient.post(`/tenders/${tenderId}/save`);
      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-tenders'] }),
  });
}
