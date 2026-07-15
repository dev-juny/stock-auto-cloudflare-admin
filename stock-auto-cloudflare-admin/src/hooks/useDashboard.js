import { useCallback, useEffect, useRef } from 'react';
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
    const refetchRef = useRef(refetch);
    refetchRef.current = refetch;
    useEffect(() => {
        let mounted = true;
        let iv;
        function schedule() {
            clearInterval(iv);
            iv = setInterval(() => {
                if (!mounted)
                    return;
                if (document.visibilityState === 'visible') {
                    refetchRef.current();
                }
            }, 60000);
        }
        schedule();
        document.addEventListener('visibilitychange', schedule);
        return () => {
            mounted = false;
            clearInterval(iv);
            document.removeEventListener('visibilitychange', schedule);
        };
    }, []);
    return { data, loading, error, refetch };
}
