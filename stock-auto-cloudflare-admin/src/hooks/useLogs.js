import { useCallback } from 'react';
import { api, hasToken } from '../utils/api';
import { useSafeAsync } from './useSafeAsync';
export function useLogs() {
    const fetcher = useCallback(async (signal) => {
        if (!hasToken())
            return [];
        const list = await api.get('/api/logs?limit=50', { signal });
        return Array.isArray(list) ? list : [];
    }, []);
    const { data, loading, refetch } = useSafeAsync(fetcher);
    const deleteLog = useCallback(async (id) => {
        await api.delete(`/api/logs/${id}`);
        refetch();
    }, [refetch]);
    return { logs: data ?? [], loading, refetch, deleteLog };
}
