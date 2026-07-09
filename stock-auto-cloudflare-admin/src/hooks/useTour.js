import { useState, useCallback } from 'react';
const TOUR_KEY = 'tour_completed';
const STEPS = [
    {
        target: 'nav',
        title: '메뉴 탐색',
        description: '하단 메뉴바에서 각 화면으로 이동할 수 있습니다. 대시보드, 포트폴리오, 진화, 전략 등 모든 기능을 한눈에 확인하세요.',
        position: 'top',
    },
    {
        target: '대시보드',
        title: '대시보드',
        description: '시스템의 전체 현황을 한눈에 볼 수 있습니다. KPI, 리스크 상태, 포트폴리오 성과 등을 모니터링하세요.',
        position: 'bottom',
    },
    {
        target: '전략',
        title: '전략(Strategy)',
        description: 'AI가 생성한 트레이딩 전략을 확인하고 포트폴리오에 추가할 수 있습니다. Fitness, Return, MDD 등으로 전략을 평가하세요.',
        position: 'top',
    },
    {
        target: '진화',
        title: '진화(Evolution)',
        description: '유전 알고리즘으로 전략을 자동 생성하고 최적화합니다. 세대를 거듭할수록 더 나은 전략이 탄생합니다.',
        position: 'top',
    },
    {
        target: '모의투자',
        title: '모의투자(Paper Trading)',
        description: '실제 자금 없이 가상으로 매매를 테스트해볼 수 있습니다. 전략의 실전 성능을 미리 확인하세요.',
        position: 'top',
    },
];
export function useTour() {
    const [active, setActive] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [dismissed, setDismissed] = useState(() => {
        try {
            return sessionStorage.getItem(TOUR_KEY) === 'true';
        }
        catch {
            return false;
        }
    });
    const start = useCallback(() => {
        setActive(true);
        setCurrentStep(0);
    }, []);
    const next = useCallback(() => {
        if (currentStep < STEPS.length - 1) {
            setCurrentStep(s => s + 1);
        }
        else {
            finish();
        }
    }, [currentStep]);
    const prev = useCallback(() => {
        if (currentStep > 0) {
            setCurrentStep(s => s - 1);
        }
    }, [currentStep]);
    const finish = useCallback(() => {
        setActive(false);
        setDismissed(true);
        try {
            sessionStorage.setItem(TOUR_KEY, 'true');
        }
        catch { }
    }, []);
    return {
        active,
        currentStep,
        step: STEPS[currentStep],
        totalSteps: STEPS.length,
        start,
        next,
        prev,
        finish,
        dismissed,
    };
}
