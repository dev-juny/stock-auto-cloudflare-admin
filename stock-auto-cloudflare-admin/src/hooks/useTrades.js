import { useCallback } from 'react';
import { api, hasToken } from '../utils/api';
import { useSafeAsync } from './useSafeAsync';
export function useTrades() {
    const fetcher = useCallback(async (signal) => {
        if (!hasToken())
            return [];
        const list = await api.get('/api/backtest/trades?limit=50', { signal });
        return Array.isArray(list) ? list : [];
    }, []);
    const { data, loading, refetch } = useSafeAsync(fetcher);
    return { trades: data ?? [], loading, refetch };
}
