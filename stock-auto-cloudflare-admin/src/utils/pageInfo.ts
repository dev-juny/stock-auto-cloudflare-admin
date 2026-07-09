export interface PageInfo {
  title: string
  description: string
  helpKey: string
}

export const PAGE_INFO: Record<string, PageInfo> = {
  dashboard: {
    title: '대시보드(Dashboard)',
    description: '전체 시스템의 상태와 성과를 한눈에 모니터링하는 메인 화면입니다.',
    helpKey: 'dashboard',
  },
  portfolio: {
    title: '포트폴리오(Portfolio)',
    description: '전략 포트폴리오를 관리하고 백테스트를 실행하는 화면입니다.',
    helpKey: 'portfolio',
  },
  evolution: {
    title: '진화(Evolution)',
    description: '유전 알고리즘을 통해 우수한 트레이딩 전략을 자동으로 생성하고 최적화합니다.',
    helpKey: 'evolution',
  },
  strategy: {
    title: '전략(Strategy)',
    description: '진화를 통해 생성된 전략들을 조회하고 포트폴리오에 추가하는 화면입니다.',
    helpKey: 'strategy',
  },
  'paper-trading': {
    title: '모의투자(Paper Trading)',
    description: '실제 자금 없이 가상으로 매매를 수행하며 전략의 성능을 테스트합니다.',
    helpKey: 'paper-trading',
  },
  validation: {
    title: '검증(Validation)',
    description: '전략의 성능과 품질을 검증하는 화면입니다. 백테스트 결과를 분석하고 리스크를 평가합니다.',
    helpKey: 'validation',
  },
  risk: {
    title: '리스크 관리(Risk)',
    description: '포트폴리오 리스크를 모니터링하고 리스크 관리 설정을 구성합니다.',
    helpKey: 'risk',
  },
  scheduler: {
    title: '스케줄러(Scheduler)',
    description: '시스템의 자동화된 작업(진화, 데이터 수집 등)을 관리하고 모니터링합니다.',
    helpKey: 'scheduler',
  },
  logs: {
    title: '로그(Logs)',
    description: '시스템 로그를 실시간으로 조회하고 모니터링합니다.',
    helpKey: 'logs',
  },
  settings: {
    title: '설정(Settings)',
    description: '백테스트, 진화, 피트니스 가중치 등 시스템 설정을 관리합니다.',
    helpKey: 'settings',
  },
}
