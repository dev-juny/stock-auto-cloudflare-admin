export interface GlossaryEntry {
  term: string
  description: string
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  fitness: {
    term: 'Fitness',
    description: '전략의 종합 성능 점수입니다. 수익률, 승률, 최대손실(MDD) 등을 종합하여 계산합니다.',
  },
  return: {
    term: 'Return',
    description: '전략의 총 수익률입니다. 양수면 이익, 음수면 손실을 의미합니다.',
  },
  mdd: {
    term: 'MDD (Maximum Drawdown)',
    description: '최대 손실 구간입니다. 고점 대비 저점까지의 최대 하락폭을 백분율로 나타냅니다.',
  },
  winRate: {
    term: 'Win Rate',
    description: '승률입니다. 전체 거래 중 이익이 난 거래의 비율을 백분율로 나타냅니다.',
  },
  sharpe: {
    term: 'Sharpe Ratio',
    description: '위험 대비 수익률을 측정하는 지표입니다. 높을수록 위험 대비 수익률이 우수합니다.',
  },
  sortino: {
    term: 'Sortino Ratio',
    description: 'Sharpe Ratio와 유사하나, 하방 변동성(손실 위험)만을 고려하여 위험을 측정합니다.',
  },
  calmar: {
    term: 'Calmar Ratio',
    description: '연평균 수익률(CAGR)을 최대손실(MDD)로 나눈 값입니다. 위험 대비 수익 효율을 나타냅니다.',
  },
  cagr: {
    term: 'CAGR (Compound Annual Growth Rate)',
    description: '연평균 복리 성장률입니다. 투자 기간 동안의 연평균 수익률을 의미합니다.',
  },
  volatility: {
    term: 'Volatility',
    description: '변동성입니다. 자산 가격의 변동 폭을 통계적으로 측정한 값입니다.',
  },
  maxPositions: {
    term: 'Max Positions',
    description: '최대 보유 포지션 수입니다. 동시에 보유할 수 있는 최대 포지션 개수를 의미합니다.',
  },
  breadth: {
    term: 'Breadth',
    description: '시장 참여도입니다. 전체 종목 중 상승 종목의 비율을 나타냅니다.',
  },
  trailingStop: {
    term: 'Trailing Stop',
    description: '트레일링 스탑입니다. 가격이 상승함에 따라 손절가를 함께 올려 이익을 보호하는 기법입니다.',
  },
  takeProfit: {
    term: 'Take Profit',
    description: '익절 조건입니다. 설정한 수익률에 도달하면 자동으로 포지션을 청산합니다.',
  },
  stopLoss: {
    term: 'Stop Loss',
    description: '손절 조건입니다. 설정한 손실률에 도달하면 자동으로 포지션을 청산하여 손실을 제한합니다.',
  },
  evolutionScore: {
    term: 'Evolution Score',
    description: '진화 점수입니다. 유전 알고리즘을 통해 생성된 전략의 우수성을 평가한 점수입니다.',
  },
  generation: {
    term: 'Generation',
    description: '세대 번호입니다. 유전 알고리즘에서 진화가 진행된 세대를 의미합니다.',
  },
  strategyScore: {
    term: 'Strategy Score',
    description: '전략 종합 점수입니다. 해당 전략의 전반적인 성능을 종합 평가한 점수입니다.',
  },
  profitFactor: {
    term: 'Profit Factor',
    description: '수익/손실 비율입니다. 총 수익을 총 손실로 나눈 값으로, 1 이상이면 수익이 손실보다 큽니다.',
  },
  totalTrades: {
    term: 'Total Trades',
    description: '총 거래 횟수입니다. 해당 전략이 수행한 전체 매매 횟수를 의미합니다.',
  },
  entryType: {
    term: 'Entry Type',
    description: '진입 유형입니다. 전략이 매수 신호를 생성하는 방식을 정의합니다. (예: Breakout, Pullback 등)',
  },
  exposure: {
    term: 'Exposure',
    description: '익스포저(투자 비중)입니다. 전체 자본 중 실제로 투자된 비율을 의미합니다.',
  },
  cashRatio: {
    term: 'Cash Ratio',
    description: '현금 비율입니다. 전체 자본 중 현금으로 보유하고 있는 비율을 의미합니다.',
  },
}

export function getGlossary(key: string): GlossaryEntry | undefined {
  return GLOSSARY[key]
}

export const findGlossary = getGlossary
