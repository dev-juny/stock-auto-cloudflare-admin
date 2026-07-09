import { useState, useCallback, useRef } from 'react';
import { useToast } from '../components/common/Toast';
export function useAction() {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const { toast } = useToast();
    const executingRef = useRef(false);
    const execute = useCallback(async (fn, successMsg) => {
        if (executingRef.current)
            return null;
        executingRef.current = true;
        setLoading(true);
        setResult(null);
        try {
            const res = await fn();
            const msg = successMsg || 'Completed';
            setResult(msg);
            toast('success', msg);
            return res;
        }
        catch (e) {
            const msg = `Error: ${e.message || 'Unknown'}`;
            setResult(msg);
            toast('error', msg);
            return null;
        }
        finally {
            setLoading(false);
            executingRef.current = false;
        }
    }, [toast]);
    return { loading, result, setResult, execute };
}
