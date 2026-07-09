import { useCallback, useEffect } from 'react';
import { api } from '../utils/api';
import { hasToken } from '../utils/api';
import { useSafeAsync } from './useSafeAsync';
export function useDashboard() {
    const fetcher = useCallback(async (signal) => {
        if (!hasToken())
            return null;
        return api.get('/api/dashboard', { signal });
    }, []);
    const { data, loading, error, refetch } = useSafeAsync(fetcher);
    useEffect(() => {
        let mounted = true;
        const iv = setInterval(() => {
            if (mounted)
                refetch();
        }, 30000);
        return () => {
            mounted = false;
            clearInterval(iv);
        };
    }, [refetch]);
    return { data, loading, error, refetch };
}
