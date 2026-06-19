import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../utils/api';
import { hasToken } from '../utils/api';
export function useLogs() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const mounted = useRef(true);
    const fetch = useCallback(() => {
        if (!hasToken()) {
            if (mounted.current)
                setLoading(false);
            return;
        }
        api.get('/api/logs?limit=50')
            .then((list) => { if (mounted.current)
            setLogs(Array.isArray(list) ? list : []); })
            .catch(() => { })
            .finally(() => { if (mounted.current)
            setLoading(false); });
    }, []);
    useEffect(() => {
        mounted.current = true;
        fetch();
        const iv = setInterval(fetch, 30000);
        return () => { mounted.current = false; clearInterval(iv); };
    }, [fetch]);
    const deleteLog = useCallback(async (id) => {
        await api.delete(`/api/logs/${id}`);
        setLogs((prev) => prev.filter((l) => l.LOG_ID !== id));
    }, []);
    return { logs, loading, refetch: fetch, deleteLog };
}
