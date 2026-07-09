import { useState, useEffect, useRef, useCallback } from 'react';
export function useSafeAsync(fetcher, deps = []) {
    const [state, setState] = useState({
        data: null,
        loading: true,
        error: null,
    });
    const mountedRef = useRef(true);
    const generationRef = useRef(0);
    const abortRef = useRef(null);
    const execute = useCallback(() => {
        const generation = ++generationRef.current;
        mountedRef.current = true;
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        setState(prev => ({ ...prev, loading: true, error: null }));
        fetcher(controller.signal)
            .then(result => {
            if (mountedRef.current && generation === generationRef.current && !controller.signal.aborted) {
                setState({ data: result, loading: false, error: null });
            }
        })
            .catch(e => {
            if (e?.message === 'Request cancelled')
                return;
            if (e?.name === 'AbortError')
                return;
            if (mountedRef.current && generation === generationRef.current) {
                setState(prev => ({
                    ...prev,
                    loading: false,
                    error: e instanceof Error ? e.message : 'Unknown error',
                }));
            }
        });
    }, deps); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        execute();
        return () => {
            mountedRef.current = false;
            abortRef.current?.abort();
        };
    }, [execute]);
    return {
        data: state.data,
        loading: state.loading,
        error: state.error,
        refetch: execute,
    };
}
