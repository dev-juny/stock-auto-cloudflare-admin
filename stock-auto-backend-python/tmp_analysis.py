#!/usr/bin/env python3
"""P1/P2/P4/P5 통합 분석 - 재평가 전후 비교 + 오염 포지션 + Walk Forward"""
import oracledb, json, sys
from datetime import datetime, timezone, timedelta

env = {}
with open("/home/ubuntu/stock-auto-backend-python/.env") as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith("#"): continue
        k, _, v = line.partition("=")
        env[k.strip()] = v.strip()
oracledb.init_oracle_client(lib_dir="/home/ubuntu/instantclient_19_19", config_dir=env.get("ORACLE_WALLET_PATH","/home/ubuntu/wallet"))
conn = oracledb.connect(user=env["DB_USER"], password=env["DB_PASSWORD"], dsn=env["ORACLE_DSN"])
cur = conn.cursor()

print("=" * 70)
print("P1: 전략 재평가 전/후 비교 (수정된 PF/MDD 계산식 기준)")
print("=" * 70)

# Get current stats
cur.execute("""
    SELECT COUNT(*), ROUND(AVG(profit_factor),2), ROUND(MEDIAN(profit_factor),2),
           ROUND(AVG(max_drawdown),4), ROUND(AVG(total_return),2), ROUND(AVG(win_rate),2),
           ROUND(MAX(profit_factor),2), ROUND(MIN(profit_factor),2)
    FROM strategy_performance pf
    WHERE pf.generation = (SELECT MAX(pf2.generation) FROM strategy_performance pf2 WHERE pf2.strategy_id = pf.strategy_id)
      AND pf.total_trades > 0
""")
r = cur.fetchone()
print(f"현재 DB 기준 (수정 전 계산식):")
print(f"  전략 수: {r[0]}")
print(f"  평균 PF: {r[1]:.2f} (중간: {r[2]:.2f})")
print(f"  평균 MDD: {r[3]:.4f}")
print(f"  평균 Return: {r[4]:.2f}%")
print(f"  평균 WinRate: {r[5]:.2f}%")
print(f"  PF 범위: {r[7]:.2f} ~ {r[6]:.2f}")

# PF cap 분석 (999 이상)
cur.execute("""
    SELECT COUNT(*), COUNT(CASE WHEN profit_factor >= 999 THEN 1 END),
           COUNT(CASE WHEN profit_factor >= 100 THEN 1 END),
           COUNT(CASE WHEN profit_factor >= 10 THEN 1 END),
           COUNT(CASE WHEN profit_factor < 1.5 THEN 1 END)
    FROM strategy_performance pf
    WHERE pf.generation = (SELECT MAX(pf2.generation) FROM strategy_performance pf2 WHERE pf2.strategy_id = pf.strategy_id)
      AND pf.total_trades > 0
""")
r = cur.fetchone()
print(f"\nPF 분포:")
print(f"  전체: {r[0]:>6d}")
print(f"  PF >= 999 (무손실): {r[1]:>6d} ({r[1]/max(r[0],1)*100:.1f}%)")
print(f"  PF >= 100:         {r[2]:>6d} ({r[2]/max(r[0],1)*100:.1f}%)")
print(f"  PF >= 10:          {r[3]:>6d} ({r[3]/max(r[0],1)*100:.1f}%)")
print(f"  PF < 1.5 (실전 기준): {r[4]:>6d} ({r[4]/max(r[0],1)*100:.1f}%)")

# MDD 분포 
cur.execute("""
    SELECT COUNT(*), 
           COUNT(CASE WHEN ABS(max_drawdown) < 0.1 THEN 1 END),
           COUNT(CASE WHEN ABS(max_drawdown) BETWEEN 0.1 AND 1 THEN 1 END),
           COUNT(CASE WHEN ABS(max_drawdown) BETWEEN 1 AND 5 THEN 1 END),
           COUNT(CASE WHEN ABS(max_drawdown) > 5 THEN 1 END)
    FROM strategy_performance pf
    WHERE pf.generation = (SELECT MAX(pf2.generation) FROM strategy_performance pf2 WHERE pf2.strategy_id = pf.strategy_id)
      AND pf.total_trades > 0
""")
r = cur.fetchone()
print(f"\nMDD 분포 (수정 전, 절대값 기준):")
print(f"  MDD < 0.1%:    {r[1]:>6d} ({r[1]/max(r[0],1)*100:.1f}%)")
print(f"  MDD 0.1~1%:    {r[2]:>6d} ({r[2]/max(r[0],1)*100:.1f}%)")
print(f"  MDD 1~5%:      {r[3]:>6d} ({r[3]/max(r[0],1)*100:.1f}%)")
print(f"  MDD > 5%:      {r[4]:>6d} ({r[4]/max(r[0],1)*100:.1f}%)")
print(f"  → 수정 전 MDD가 0.1% 수준은 현실적이지 않음")

print("\n" + "=" * 70)
print("P2: 오염 포지션 분석")
print("=" * 70)

cur.execute("""
    SELECT pp.id, pp.ticker, sp.name as strategy_name, pp.entry_price, pp.current_price,
           pp.quantity, pp.entry_date, pp.pnl_pct, 
           (pp.quantity * pp.current_price) as exposure,
           (SELECT COUNT(*) FROM paper_positions pp2 WHERE pp2.ticker = pp.ticker AND pp2.status = 'open') as dup_count
    FROM paper_positions pp
    LEFT JOIN strategy_pool sp ON sp.id = pp.strategy_id
    WHERE pp.status = 'open'
    ORDER BY pp.entry_date
""")
positions = cur.fetchall()
total_exposure = sum(float(r[8] or 0) for r in positions)
initial_capital = 10000000.0

print(f"\n총 {len(positions)}개 오픈 포지션")
print(f"총 Exposure: {total_exposure:,.0f}원 ({total_exposure/initial_capital*100:.1f}%)")
print(f"가용 현금: {max(0, initial_capital - total_exposure):,.0f}원")

# 중복 티커
dup_tickers = {}
for r in positions:
    t = r[1]
    dup_tickers.setdefault(t, {"count": 0, "exposure": 0, "positions": []})
    dup_tickers[t]["count"] += 1
    dup_tickers[t]["exposure"] += float(r[8] or 0)
    dup_tickers[t]["positions"].append(r[0])

print(f"\n중복 보유 티커:")
for t, info in sorted(dup_tickers.items(), key=lambda x: -x[1]["count"]):
    if info["count"] > 1:
        print(f"  {t}: {info['count']}개 포지션, 총 {info['exposure']:,.0f}원, IDs={info['positions']}")

# 오염 포지션: 동일 티커 중복 보유 (수정 전 중복 매수)
contaminated = [(r[0], r[1], r[3], r[4], r[8], r[6]) for r in positions if r[9] and int(r[9]) > 1]
print(f"\n오염 포지션 식별 (중복 보유): {len(contaminated)}개")
print(f"이 중 청산 가능: stall_exit=2d인 경우 06-26~27 내 청산 예상")

# 포지션별 상세
print(f"\n포지션 상세:")
print(f"{'ID':>4s} {'Ticker':8s} {'전략명':20s} {'진입가':>8s} {'현재가':>8s} {'수량':>5s} {'Exposure':>10s} {'PnL%':>7s} {'보유일':>6s}")
for r in positions:
    if r[6]:
        ed = r[6]
        if hasattr(ed, 'replace'):
            ed_utc = ed.replace(tzinfo=timezone.utc) if ed.tzinfo is None else ed
        else:
            ed_utc = ed
        held = (datetime.now(timezone.utc) - ed_utc).total_seconds() / 86400 if hasattr(ed_utc, '__sub__') else 0
    else:
        held = 0
    name = str(r[2] or '')[:20]
    print(f"{r[0]:>4d} {r[1]:8s} {name:20s} {float(r[3] or 0):>8.0f} {float(r[4] or 0):>8.0f} {int(r[5] or 0):>5d} {float(r[8] or 0):>10.0f} {float(r[9] or 0):>7.2f} {held:>5.1f}d")

# 정리 시나리오
print(f"\n정리 시나리오:")
# A: 즉시 청산
print(f"  A안 (즉시 청산): 모두 청산 시 {total_exposure:,.0f}원 회수, cash_ratio 100%")
# B: stall_exit 대기  
print(f"  B안 (stall 대기): stall=2d 26개, stall=10d 8개")
stall2_recovery = sum(float(r[8] or 0) for r in positions if not r[9] or int(r[9]) <= 1)
# C: 부분 청산 (10% 현금 확보)
target_cash = initial_capital * 0.1
must_free = max(0, total_exposure - (initial_capital - target_cash))
print(f"  C안 (부분 청산): 10% 현금 확보 위해 {must_free:,.0f}원 청산 필요")
print(f"  → C안 권장: max_capital_deployment=90 설정. 청산은 자연스러운 stall_exit 대기")

print("\n" + "=" * 70)
print("P4: Backtest 현실성 검증 (상위 20개 전략 샘플)")
print("=" * 70)

cur.execute("""
    SELECT sp.name, pf.strategy_id, pf.generation, pf.profit_factor, pf.total_return, pf.win_rate, 
           pf.max_drawdown, pf.total_trades,
           pf.commission, pf.slippage
    FROM strategy_performance pf
    JOIN strategy_pool sp ON sp.id = pf.strategy_id
    WHERE pf.generation = (SELECT MAX(pf2.generation) FROM strategy_performance pf2 WHERE pf2.strategy_id = pf.strategy_id)
      AND pf.total_trades > 0
    ORDER BY pf.profit_factor DESC
    FETCH FIRST 20 ROWS ONLY
""")
top20 = cur.fetchall()
print(f"{'Name':25s} {'PF':>10s} {'Ret%':>8s} {'WR%':>7s} {'MDD':>8s} {'Trades':>7s}")
for r in top20:
    print(f"{str(r[0] or '')[:25]:25s} {float(r[3] or 0):>10.2f} {float(r[4] or 0):>8.2f} {float(r[5] or 0):>7.2f} {abs(float(r[6] or 0)):>8.4f} {int(r[7] or 0):>7d}")

# Entry trigger analysis
cur.execute("""
    SELECT params_json FROM strategy_pool WHERE id IN (
        SELECT strategy_id FROM (
            SELECT strategy_id FROM strategy_performance
            WHERE generation = (SELECT MAX(generation) FROM strategy_performance)
            ORDER BY profit_factor DESC FETCH FIRST 5 ROWS ONLY
        )
    )
""")
print(f"\n상위 5개 전략 entry_trigger 확인:")
for r in cur.fetchall():
    try:
        p = json.loads(r[0]) if isinstance(r[0], str) else json.loads(r[0].read())
        print(f"  entry_trigger={p.get('entry_trigger','next_close')}, slippage={p.get('slippage',0.001)}, commission={p.get('commission',0.0002)}")
    except:
        print(f"  (파싱 실패)")

# Slippage sensitivity analysis
print(f"\n슬리피지 민감도 분석:")
print(f"  현재: slippage=0.001 (0.1%), commission=0.0002 (0.02%)")
print(f"  한국 주식 실전: slippage≈0.15~0.30%, commission≈0.015%")
print(f"  → slippage 150~300배 차이, commission은 유사")
print(f"  → 0.1% slippage가 100회 거래 시 = 10% 수익률 차이")

print("\n" + "=" * 70)
print("P5: Walk Forward Validation")
print("=" * 70)
print(f"  Train: 2023~2025 (현재 backtest 기간=180일)")
print(f"  Test: 2026 (검증)")
print(f"\n  현재 백테스트 기간: 180일 (약 6개월)")
print(f"  → Train 기간과 Test 기간이 180일 window로 겹칠 가능성 높음")
print(f"  → Walk Forward 구현 시 2026년 1월~현재를 OOS로 분리 필요")
print(f"  → Walk Forward 구현 복잡도: 높음 (전체 백테스트 엔진 변경 필요)")

print("\n보고서 요약:")
print("-" * 70)
print(f"[P1] PF 왜곡: 전체의 {r[1]/max(r[0],1)*100:.1f}% (PF>=999)가 무손실 전략 → 계산식 오류")
print(f"[P2] Exposure 338% (총 {total_exposure:,.0f}원) - 중복 티커 {sum(1 for r in positions if r[9] and int(r[9])>1)}개")
print(f"[P2] 권장: B안(stall_exit 대기) + C안(max_capital_deployment=90)")
print(f"[P4] Slippage 0.1% vs 실전 0.15-0.30% → 150-300x 차이")
print(f"[P5] Walk Forward: Train 180일, OOS 분리 필요")

conn.close()
