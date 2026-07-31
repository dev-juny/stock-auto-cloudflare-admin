export interface HelpContent {
  title: string
  purpose: string
  features: string[]
  howToUse: string[]
  indicators: { name: string; desc: string }[]
  faq: { q: string; a: string }[]
}

export const HELP_CONTENT: Record<string, HelpContent> = {
  dashboard: {
    title: '대시보드',
    purpose: '전체 시스템의 상태와 성과를 한눈에 확인할 수 있는 메인 화면입니다.',
    features: [
      '핵심 성과 지표(KPI) 모니터링',
      '시스템 상태 및 리스크 확인',
      '포트폴리오 익스포저 및 현금 비율',
      '백테스트 및 검증 진행 상황',
    ],
    howToUse: [
      '상단 KPI 카드에서 주요 성과 지표를 확인하세요.',
      '시스템 상태 카드에서 서비스 상태를 점검하세요.',
      '포트폴리오 게이지로 투자 비중을 확인하세요.',
    ],
    indicators: [
      { name: 'Total Return', desc: '전체 포트폴리오의 누적 수익률입니다.' },
      { name: 'PF Grade', desc: '포트폴리오의 종합 등급입니다.' },
      { name: 'CAGR', desc: '연평균 복리 성장률입니다.' },
      { name: 'MDD', desc: '최대 손실 구간입니다.' },
      { name: 'Sharpe', desc: '위험 대비 수익률 지표입니다.' },
      { name: 'Win Rate', desc: '전체 거래 중 승리한 거래의 비율입니다.' },
    ],
    faq: [
      { q: '데이터가 갱신되지 않아요', a: '페이지 상단의 새로고침 버튼을 클릭하거나, 자동 갱신을 기다려주세요.' },
      { q: 'KPI 색상이 의미하는 것은?', a: '초록색은 양호, 노란색은 주의, 빨간색은 위험을 의미합니다.' },
    ],
  },
  portfolio: {
    title: '포트폴리오',
    purpose: '전략 포트폴리오를 관리하고 백테스트를 실행하는 화면입니다.',
    features: [
      '전략 포트폴리오 목록 조회 및 관리',
      '전략 승인/비활성화/할당량 조정',
      '포트폴리오 백테스트 실행',
      '백테스트 내역 확인',
    ],
    howToUse: [
      'Strategy 탭에서 전략을 포트폴리오에 추가하세요.',
      '승인 대기 중인 전략은 Approve 버튼으로 승인할 수 있습니다.',
      '슬라이더로 각 전략의 할당 비율을 조정하세요.',
      '하단 백테스트 섹션에서 포트폴리오 성과를 테스트해보세요.',
    ],
    indicators: [
      { name: 'Allocation', desc: '해당 전략에 할당된 포트폴리오 비중입니다.' },
    ],
    faq: [
      { q: '포트폴리오에 전략을 어떻게 추가하나요?', a: 'Strategy 탭에서 원하는 전략의 "+ Portfolio" 버튼을 클릭하세요.' },
      { q: '백테스트는 어떻게 실행하나요?', a: '백테스트 섹션에서 기간, 종목, 초기 자본을 설정하고 Run Backtest를 클릭하세요.' },
    ],
  },
  evolution: {
    title: '진화(Evolution)',
    purpose: '유전 알고리즘을 통해 우수한 트레이딩 전략을 자동으로 생성하고 최적화하는 화면입니다.',
    features: [
      '전략 진화 상태 모니터링',
      '전략 풀에서 개별 전략 확인',
      '진화 타임라인 보기',
      '세대 간 성능 비교',
    ],
    howToUse: [
      'Strategy Pool 탭에서 현재 전략 후보들을 확인하세요.',
      '전략을 클릭하면 상세 정보를 볼 수 있습니다.',
      'Evolution Timeline 탭에서 세대별 성능 추이를 확인하세요.',
      '두 세대를 선택하여 Compare 버튼으로 성능을 비교할 수 있습니다.',
    ],
    indicators: [
      { name: 'Fitness', desc: '전략의 종합 성능 점수입니다.' },
      { name: 'Generation', desc: '현재 진화가 진행된 세대 번호입니다.' },
      { name: 'Total Return', desc: '전략의 총 수익률입니다.' },
      { name: 'Win Rate', desc: '전략의 승률입니다.' },
      { name: 'Max DD', desc: '전략의 최대 손실 구간입니다.' },
      { name: 'Population', desc: '각 세대의 전략 개체 수입니다.' },
    ],
    faq: [
      { q: '진화는 어떻게 동작하나요?', a: '우수한 전략을 선택(Selection)하여 교배(Crossover)와 변이(Mutation)를 통해 새로운 세대의 전략을 생성합니다.' },
      { q: 'ELITE 전략은 무엇인가요?', a: '특정 기준을 통과한 우수 전략으로, 다음 세대에도 생존하여 유전자를 전달합니다.' },
      { q: '진화는 얼마나 자주 실행되나요?', a: '설정된 스케줄에 따라 자동 실행되며, 수동으로도 실행할 수 있습니다.' },
    ],
  },
  strategy: {
    title: '전략(Strategy)',
    purpose: '진화를 통해 생성된 전략들을 조회하고 관리하는 화면입니다.',
    features: [
      '전략 목록 조회 및 정렬',
      '개별 전략 상세 정보 확인',
      '리스크, 프로모션, 검증, 실거래 준비 상태 확인',
      '전략을 포트폴리오에 추가',
    ],
    howToUse: [
      '각 컬럼 헤더를 클릭하여 전략을 정렬할 수 있습니다.',
      '전략 행을 클릭하면 상세 정보 모달이 열립니다.',
      '상세 모달에서 Metrics, Risk, Promotion, Validation, Readiness 탭을 확인하세요.',
      '+ Portfolio 버튼으로 전략을 포트폴리오에 추가할 수 있습니다.',
    ],
    indicators: [
      { name: 'Fitness', desc: '전략의 종합 성능 점수입니다.' },
      { name: 'Return', desc: '전략의 수익률입니다.' },
      { name: 'Win Rate', desc: '전략의 승률입니다.' },
      { name: 'MDD', desc: '전략의 최대 손실 구간입니다.' },
      { name: 'Profit Factor', desc: '수익/손실 비율입니다.' },
    ],
    faq: [
      { q: '전략을 클릭해도 반응이 없어요', a: '데이터 로딩 중일 수 있습니다. 잠시 후 다시 시도해주세요.' },
      { q: '좋은 전략의 기준은 무엇인가요?', a: '일반적으로 Fitness 70 이상, Win Rate 55% 이상, MDD 15% 이하를 좋은 전략으로 봅니다.' },
    ],
  },
  'paper-trading': {
    title: '모의투자(Paper Trading)',
    purpose: '실제 자금을 사용하지 않고 가상으로 매매를 수행하는 모의 거래 화면입니다.',
    features: [
      '모의 거래 계좌 현황 조회',
      '매매 신호 생성 및 실행',
      '보유 포지션 확인',
      '거래 내역 조회',
    ],
    howToUse: [
      'Generate & Execute 버튼으로 매매 신호를 생성하고 실행하세요.',
      'Full Cycle 버튼으로 전체 사이클을 실행할 수 있습니다.',
      'Open Positions에서 현재 보유 포지션을 확인하세요.',
      'Recent Trades에서 최근 거래 내역을 확인하세요.',
    ],
    indicators: [
      { name: 'Total Value', desc: '모의 계좌의 총 자산 가치입니다.' },
      { name: 'Cash', desc: '모의 계좌의 현금 잔고입니다.' },
      { name: 'Positions', desc: '현재 보유 중인 포지션 수입니다.' },
      { name: 'Total P&L', desc: '모의 거래의 총 손익입니다.' },
    ],
    faq: [
      { q: '모의투자와 실거래의 차이는?', a: '모의투자는 가상 자금으로 거래하여 리스크 없이 전략을 테스트합니다.' },
      { q: '매매 신호는 어떻게 생성되나요?', a: 'Strategy 탭에서 관리되는 전략들이 생성한 매매 신호를 기반으로 실행됩니다.' },
    ],
  },
  validation: {
    title: '검증(Validation)',
    purpose: '전략의 성능을 검증하고 품질을 평가하는 화면입니다.',
    features: [
      '검증 상태 확인',
      '성과 지표 분석',
      '에쿼티 커브 확인',
      '히트맵 및 월별 수익률 확인',
    ],
    howToUse: [
      'Validation을 시작/중지하여 검증을 제어하세요.',
      '검증 진행 상황과 성과 지표를 확인하세요.',
      '에쿼티 커브와 MDD 차트로 성과를 시각화합니다.',
    ],
    indicators: [
      { name: 'Total Return', desc: '검증 기간 동안의 총 수익률입니다.' },
      { name: 'Sharpe', desc: '검증 기간의 샤프 비율입니다.' },
      { name: 'Win Rate', desc: '검증 기간의 승률입니다.' },
    ],
    faq: [
      { q: '검증 기간은 얼마인가요?', a: '일반적으로 30일 동안 진행되며, 설정에 따라 변경 가능합니다.' },
      { q: '검증 결과는 어떻게 활용하나요?', a: '검증을 통과한 전략은 실거래에 사용할 준비가 되었다고 판단합니다.' },
    ],
  },
  risk: {
    title: '리스크 관리',
    purpose: '포트폴리오의 리스크를 모니터링하고 관리 설정을 구성하는 화면입니다.',
    features: [
      '리스크 상태 실시간 확인',
      '리스크 설정 관리',
      '포트폴리오 자본 배분 설정',
    ],
    howToUse: [
      '상단에서 현재 리스크 상태를 확인하세요.',
      'Edit Settings 버튼으로 리스크 설정을 변경할 수 있습니다.',
      'Deploy Capital 섹션에서 자본 배분 비율을 설정하세요.',
    ],
    indicators: [
      { name: 'Portfolio MDD', desc: '포트폴리오의 최대 손실 구간입니다.' },
      { name: 'Avg Unrealized P&L', desc: '미실현 손익의 평균값입니다.' },
      { name: 'Daily P&L', desc: '일일 손익입니다.' },
      { name: 'Open Positions', desc: '현재 열린 포지션 수입니다.' },
      { name: 'Cash Ratio', desc: '현금 비율입니다.' },
    ],
    faq: [
      { q: '리스크 차단(BLOCKED)은 무엇인가요?', a: '리스크 한도를 초과하여 새로운 거래가 차단된 상태입니다.' },
      { q: '리스크 설정은 어떻게 변경하나요?', a: 'Edit Settings 버튼을 클릭하여 각 항목을 수정하고 저장하세요.' },
    ],
  },
  scheduler: {
    title: '스케줄러',
    purpose: '시스템의 자동화된 작업들을 관리하고 모니터링하는 화면입니다.',
    features: [
      '예약 작업 목록 및 상태 확인',
      '작업 수동 실행/일시 중지/재개',
      '진화 스케줄러 설정 확인',
      '작업 실행 이력 조회',
    ],
    howToUse: [
      '각 작업 카드의 Play/Pause 버튼으로 작업을 제어하세요.',
      '작업의 View History 버튼으로 실행 이력을 확인할 수 있습니다.',
      'Evolution Scheduler 섹션에서 진화 스케줄 상태를 확인하세요.',
    ],
    indicators: [
      { name: 'Status', desc: '작업의 현재 상태(실행 중, 대기, 일시 중지 등)입니다.' },
      { name: 'Cron', desc: '작업이 실행되는 스케줄(Cron 표현식)입니다.' },
    ],
    faq: [
      { q: '작업이 실행되지 않아요', a: '작업 상태가 PAUSED인지 확인하고, Resume 버튼으로 재개하세요.' },
      { q: '스케줄은 어떻게 변경하나요?', a: '현재 버전에서는 설정(Settings) 화면에서 변경 가능합니다.' },
    ],
  },
  logs: {
    title: '로그',
    purpose: '시스템의 로그를 조회하고 모니터링하는 화면입니다.',
    features: [
      '시스템 로그 실시간 조회',
      '로그 레벨별 필터링',
      '자동 새로고침',
    ],
    howToUse: [
      '로그 목록에서 시스템 상태를 확인하세요.',
      '자동 새로고침 기능으로 실시간 모니터링이 가능합니다.',
    ],
    indicators: [],
    faq: [
      { q: '로그는 얼마나 보관되나요?', a: '최근 로그부터 순차적으로 표시되며, 설정에 따라 보관 기간이 결정됩니다.' },
    ],
  },
  settings: {
    title: '설정',
    purpose: '시스템 설정을 관리하고 구성하는 화면입니다.',
    features: [
      '백테스트 설정 변경',
      '진화 설정 구성',
      '피트니스 가중치 조정',
    ],
    howToUse: [
      '각 설정 항목의 값을 수정하고 Save 버튼으로 저장하세요.',
      '진화 설정에서 진화 알고리즘의 파라미터를 조정할 수 있습니다.',
    ],
    indicators: [],
    faq: [
      { q: '설정을 변경해도 적용되지 않아요', a: '변경 후 반드시 Save 버튼을 클릭해야 적용됩니다.' },
    ],
  },
  pipeline: {
    title: '파이프라인',
    purpose: '전략의 자동 생명주기를 관리하는 파이프라인입니다. 진화에서 프로덕션까지 자동으로 승격됩니다.',
    features: [
      '8단계 자동 파이프라인 모니터링',
      '단계별 수동 실행 및 설정 관리',
      '전략 Lifecycle 분포 시각화',
      '포트폴리오 건강도 대시보드',
      '실행 이력 조회',
    ],
    howToUse: [
      '파이프라인 상태 배너에서 스케줄러와 최근 실행 상태를 확인하세요.',
      '전체 파이프라인 또는 특정 단계를 수동으로 실행할 수 있습니다.',
      '설정 탭에서 파이프라인 기준(fitness, 승률 등)을 조정할 수 있습니다.',
      '전략 Lifecycle 분포에서 각 단계별 전략 수를 확인하세요.',
    ],
    indicators: [
      { name: '생성됨(Created)', desc: '진화에서 새로 생성된 전략입니다.' },
      { name: '백테스트(Backtesting)', desc: '백테스트를 수행 중인 전략입니다.' },
      { name: '모의투자(Paper Trading)', desc: '실제 자금 없이 가상 매매 중인 전략입니다.' },
      { name: '서바이버(Survivor)', desc: '모의투자를 통과한 우수 전략입니다.' },
      { name: '프로덕션(Production)', desc: '실제 자금으로 운용 중인 최종 전략입니다.' },
    ],
    faq: [
      { q: '파이프라인이 작동하지 않아요', a: '스케줄러가 활성화되어 있는지 확인하세요. 수동으로도 실행할 수 있습니다.' },
      { q: '전략이 승격되지 않아요', a: '설정에서 min_fitness 등 기준을 확인하세요. 기준이 너무 높으면 승격이 안될 수 있습니다.' },
    ],
  },
}
