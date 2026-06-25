#!/usr/bin/env python3
"""종합 검증 스크립트 - 실제 API/DB/Scheduler 상태 확인"""
import urllib.request, json, sys, time
from datetime import datetime, timedelta

API = "http://localhost:5000/api"
KST = timedelta(hours=9)

def now_kst():
    return (datetime.utcnow() + KST).strftime("%m-%d %H:%M")

def api_get(path):
    try:
        resp = urllib.request.urlopen(f"{API}{path}", timeout=15)
        return json.loads(resp.read().decode())
    except Exception as e:
        return {"ERROR": str(e)}

def q(conn, sql, bind=None):
    cur = conn.cursor()
    if bind:
        cur.execute(sql, bind)
    else:
        cur.execute(sql)
    try:
        return cur.fetchall()
    except:
        return []

print(f"====== 검증 시작: {now_kst()} KST ======\n")

# ===== DB 연결 =====
import oracledb
env = {}
with open("/home/ubuntu/stock-auto-backend-python/.env") as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith("#"): continue
        k, _, v = line.partition("=")
        env[k.strip()] = v.strip()
oracledb.init_oracle_client(lib_dir="/home/ubuntu/instantclient_19_19", config_dir=env.get("ORACLE_WALLET_PATH","/home/ubuntu/wallet"))
conn = oracledb.connect(user=env["DB_USER"], password=env["DB_PASSWORD"], dsn=env["ORACLE_DSN"])

# ====================================================================
# 1. Risk Management
# ====================================================================
print("=" * 60)
print("[1] Risk Management")
print("=" * 60)

# Check system_logs for risk entries
rows = q(conn, "SELECT source, COUNT(*) cnt FROM system_logs WHERE source LIKE '%risk%' OR source LIKE '%risk%' GROUP BY source ORDER BY cnt DESC")
print(f"  Risk 로그 source: {[(r[0], r[1]) for r in rows]}")

# Check paper_positions for risk fields
rows = q(conn, "SELECT column_name FROM all_tab_cols WHERE table_name='PAPER_POSITIONS' AND column_name LIKE '%RISK%' OR column_name LIKE '%BREACH%' OR column_name LIKE '%LIMIT%'")
print(f"  PaperPositions 리스크 컬럼: {[r[0] for r in rows]}")

# Check paper_trades for risk fields  
rows = q(conn, "SELECT column_name FROM all_tab_cols WHERE table_name='PAPER_TRADES' AND (column_name LIKE '%RISK%' OR column_name LIKE '%BREACH%' OR column_name LIKE '%LIMIT%')")
print(f"  PaperTrades 리스크 컬럼: {[r[0] for r in rows]}")

# Check if risk_breach_log table exists
rows = q(conn, "SELECT table_name FROM user_tables WHERE table_name LIKE '%RISK%' OR table_name LIKE '%BREACH%' OR table_name LIKE '%LIMIT%'")
print(f"  리스크 관련 테이블: {[r[0] for r in rows]}")

# Check any positions near loss limits
rows = q(conn, "SELECT COUNT(*) FROM paper_positions WHERE position_type='LONG'")
print(f"  총 LONG 포지션 수: {rows[0][0] if rows else 0}")

# ====================================================================
# 2. Auto Promotion  
# ====================================================================
print("\n" + "=" * 60)
print("[2] Auto Promotion")
print("=" * 60)

# Check promotion_history table
rows = q(conn, "SELECT table_name FROM user_tables WHERE table_name LIKE '%PROMOTION%'")
print(f"  promotion_history 테이블 존재: {'YES' if rows else 'NO'} [{', '.join(r[0] for r in rows)}]")

if rows:
    rows2 = q(conn, "SELECT COUNT(*) FROM promotion_history")
    print(f"  promotion_history 레코드 수: {rows2[0][0]}")
    if rows2 and rows2[0][0] > 0:
        rows3 = q(conn, "SELECT * FROM promotion_history ORDER BY created_at DESC FETCH FIRST 5 ROWS ONLY")
        for r in rows3:
            print(f"    {r}")

# Check if auto_promote API exists
dash = api_get("/evolution/dashboard")
print(f"  Evolution Dashboard 응답: {'OK' if 'current_generation' in dash else 'FAIL'}")

# ====================================================================
# 3. Validation Mode
# ====================================================================
print("\n" + "=" * 60)
print("[3] Validation Mode")
print("=" * 60)

rows = q(conn, "SELECT table_name FROM user_tables WHERE table_name LIKE '%VALIDATION%'")
print(f"  Validation 관련 테이블: {[r[0] for r in rows]}")

for tbl in [r[0] for r in rows]:
    rows2 = q(conn, f"SELECT COUNT(*) FROM {tbl}")
    print(f"  {tbl} 레코드 수: {rows2[0][0] if rows2 else 0}")
    if rows2 and rows2[0][0] > 0:
        rows3 = q(conn, f"SELECT * FROM {tbl} ORDER BY created_at DESC FETCH FIRST 3 ROWS ONLY")
        for r in rows3:
            print(f"    {r}")

# Check validation API
val = api_get("/validation/status")
print(f"  /api/validation/status: {'OK' if 'ERROR' not in val else val.get('ERROR','FAIL')[:100]}")
if 'ERROR' not in val:
    print(f"    응답: {json.dumps(val, indent=4)[:300]}")

# ====================================================================
# 4. Portfolio Rebalance
# ====================================================================
print("\n" + "=" * 60)
print("[4] Portfolio Rebalance")
print("=" * 60)

rows = q(conn, "SELECT table_name FROM user_tables WHERE table_name LIKE '%REBALANCE%' OR table_name LIKE '%REBAL%'")
print(f"  Rebalance 관련 테이블: {[r[0] for r in rows]}")

for tbl in [r[0] for r in rows]:
    rows2 = q(conn, f"SELECT COUNT(*) FROM {tbl}")
    print(f"  {tbl} 레코드 수: {rows2[0][0] if rows2 else 0}")
    if rows2 and rows2[0][0] > 0:
        rows3 = q(conn, f"SELECT * FROM {tbl} ORDER BY created_at DESC FETCH FIRST 3 ROWS ONLY")
        for r in rows3:
            print(f"    {r}")

# ====================================================================
# 5. Paper Trading
# ====================================================================
print("\n" + "=" * 60)
print("[5] Paper Trading")
print("=" * 60)

# Paper positions
rows = q(conn, "SELECT COUNT(*) FROM paper_positions")
print(f"  paper_positions 총 레코드: {rows[0][0] if rows else 0}")
if rows and rows[0][0] > 0:
    rows2 = q(conn, "SELECT ticker, position_type, entry_price, current_price, quantity, pnl_percent, open_date FROM paper_positions ORDER BY open_date DESC FETCH FIRST 10 ROWS ONLY")
    print(f"  최근 포지션 (최대 10):")
    for r in rows2:
        print(f"    {r[0]} {r[1]} 진입가:{r[2]:.0f} 현재가:{r[3]:.0f} 수량:{r[4]} 수익률:{r[5]:.2f}% 개설:{r[6]}")

# Paper trades
rows = q(conn, "SELECT COUNT(*) FROM paper_trades")
print(f"  paper_trades 총 레코드: {rows[0][0] if rows else 0}")
if rows and rows[0][0] > 0:
    rows2 = q(conn, "SELECT trade_type, ticker, entry_price, quantity, pnl, trade_date FROM paper_trades ORDER BY trade_date DESC FETCH FIRST 10 ROWS ONLY")
    print(f"  최근 체결 (최대 10):")
    for r in rows2:
        print(f"    {r[0]} {r[1]} 가격:{r[2]:.0f} 수량:{r[3]} PnL:{r[4]:.2f} 일자:{r[5]}")

# Recent 7 days trades
rows = q(conn, "SELECT COUNT(*) FROM paper_trades WHERE trade_date >= SYSDATE - 7")
print(f"  최근 7일 체결 건수: {rows[0][0] if rows else 0}")

# Position types
rows = q(conn, "SELECT position_type, COUNT(*) FROM paper_positions GROUP BY position_type")
for r in rows:
    print(f"  포지션 타입 {r[0]}: {r[1]}개")

# ====================================================================
# 6. Readiness 평가
# ====================================================================
print("\n" + "=" * 60)
print("[6] Readiness 평가")
print("=" * 60)

ready = api_get("/readiness")
print(f"  /api/readiness: {'OK' if 'ERROR' not in ready else ready.get('ERROR','FAIL')[:100]}")
if 'ERROR' not in ready:
    print(f"    응답: {json.dumps(ready, indent=4)[:500]}")

# ====================================================================
# 7. Profit Factor
# ====================================================================
print("\n" + "=" * 60)
print("[7] Profit Factor")
print("=" * 60)

# Average PF of recent strategies
rows = q(conn, """
    SELECT 
        COUNT(*) total_tested,
        ROUND(AVG(profit_factor), 4) avg_pf,
        ROUND(MEDIAN(profit_factor), 4) median_pf,
        SUM(CASE WHEN profit_factor < 1 THEN 1 ELSE 0 END) loss_count,
        SUM(CASE WHEN profit_factor BETWEEN 1 AND 1.2 THEN 1 ELSE 0 END) weak_count,
        SUM(CASE WHEN profit_factor BETWEEN 1.2 AND 1.5 THEN 1 ELSE 0 END) good_count,
        SUM(CASE WHEN profit_factor BETWEEN 1.5 AND 2 THEN 1 ELSE 0 END) strong_count,
        SUM(CASE WHEN profit_factor >= 2 THEN 1 ELSE 0 END) excellent_count
    FROM strategy_performance pf
    WHERE generation = (SELECT MAX(generation) FROM strategy_performance pf2 WHERE pf2.strategy_id = pf.strategy_id)
      AND total_trades > 0
""")
if rows:
    r = rows[0]
    print(f"  테스트된 전략: {r[0]}")
    print(f"  평균 PF: {r[1]:.4f}")
    print(f"  중간 PF: {r[2]:.4f}")
    print(f"  PF < 1 (LOSS): {r[3]}")
    print(f"  PF 1-1.2 (WEAK): {r[4]}")
    print(f"  PF 1.2-1.5 (GOOD): {r[5]}")
    print(f"  PF 1.5-2.0 (STRONG): {r[6]}")
    print(f"  PF >= 2.0 (EXCELLENT): {r[7]}")

# ====================================================================
# 8. Dashboard API
# ====================================================================
print("\n" + "=" * 60)
print("[8] Dashboard API")
print("=" * 60)

dash = api_get("/evolution/dashboard")
print(f"  Evolution Dashboard: {'OK' if 'ERROR' not in dash else 'FAIL'}")
if 'ERROR' not in dash:
    print(f"    gen:{dash.get('current_generation')} running:{dash.get('is_running')} status:{dash.get('status','')[:30]} last:{dash.get('last_run_at','')[:19]}")

health = api_get("/portfolio/health")
print(f"  Portfolio Health: {'OK' if 'ERROR' not in health else 'FAIL'}")
if 'ERROR' not in health:
    h_keys = list(health.keys())[:10]
    print(f"    키: {h_keys}")
    if 'position_count' in health:
        print(f"    포지션:{health.get('position_count')} 수익률:{health.get('total_pnl_percent',0):.2f}%")

perf = api_get("/paper/performance")
print(f"  Paper Performance: {'OK' if 'ERROR' not in perf else 'FAIL'}")
if 'ERROR' not in perf:
    pf_keys = list(perf.keys())[:10]
    print(f"    키: {pf_keys}")
    if isinstance(perf, dict):
        print(f"    응답 미리보기: {json.dumps(perf, indent=4)[:200]}")

sched = api_get("/scheduler/status")
print(f"  Scheduler Status: {'OK' if 'ERROR' not in sched else 'FAIL'}")
if 'ERROR' not in sched:
    print(f"    응답: {json.dumps(sched, indent=4)[:500]}")

# ====================================================================
# 9. Scheduler
# ====================================================================
print("\n" + "=" * 60)
print("[9] Scheduler")
print("=" * 60)

jobs = api_get("/scheduler/jobs")
print(f"  /api/scheduler/jobs: {'OK' if 'ERROR' not in jobs else 'FAIL'}")
if 'ERROR' not in jobs:
    print(f"    응답: {json.dumps(jobs, indent=4)[:1000]}")
    if isinstance(jobs, list):
        for j in jobs:
            print(f"    - {j.get('id','?')}: 다음={j.get('next_run_time','?')[:19]} 마지막={j.get('last_run','?')[:19]}")

# Check scheduler_history
rows = q(conn, "SELECT table_name FROM user_tables WHERE table_name = 'SCHEDULER_HISTORY'")
if rows:
    rows2 = q(conn, "SELECT job_id, status, execution_time_ms, executed_at, message FROM scheduler_history ORDER BY executed_at DESC FETCH FIRST 15 ROWS ONLY")
    print(f"  Scheduler History (최근 15):")
    fail_count = 0
    for r in rows2:
        t = r[3].strftime("%m-%d %H:%M") if r[3] else ""
        flag = " ** FAIL **" if r[1] != "SUCCESS" else ""
        if r[1] != "SUCCESS": fail_count += 1
        print(f"    {t} [{r[0]}] {r[1]} {r[2]}ms - {(r[4] or '')[:80]}{flag}")
    print(f"  총 실패 횟수 (표본 내): {fail_count}")

# ====================================================================
# 10. Dead Code Analysis
# ====================================================================
print("\n" + "=" * 60)
print("[10] Dead Code Analysis")
print("=" * 60)

# List all API routes
routes = api_get("/routes") if "ERROR" not in api_get("/routes") else {}
if 'ERROR' in routes:
    # Try openapi schema
    try:
        resp = urllib.request.urlopen(f"{API}/openapi.json", timeout=10)
        schema = json.loads(resp.read().decode())
        paths = list(schema.get("paths", {}).keys())
        print(f"  등록된 API 경로 ({len(paths)}개):")
        for p in sorted(paths):
            print(f"    {p}")
    except Exception as e:
        print(f"  OpenAPI 조회 실패: {e}")
else:
    print(f"  Routes: {json.dumps(routes, indent=4)[:500]}")

# Check if certain endpoints return data or are empty
tests = [
    ("/evolution/dashboard", "Evolution Dashboard"),
    ("/portfolio/health", "Portfolio Health"),
    ("/portfolio/holdings", "Portfolio Holdings"),
    ("/paper/performance", "Paper Performance"),
    ("/paper/positions", "Paper Positions"),
    ("/paper/trades", "Paper Trades"),
    ("/scheduler/status", "Scheduler Status"),
    ("/scheduler/jobs", "Scheduler Jobs"),
    ("/readiness", "Readiness"),
    ("/validation/status", "Validation Status"),
    ("/risk/status", "Risk Status"),
    ("/promotion/status", "Promotion Status"),
    ("/rebalance/status", "Rebalance Status"),
    ("/logs", "System Logs"),
]
for path, name in tests:
    data = api_get(path)
    status = "OK" if 'ERROR' not in data else "FAIL"
    if isinstance(data, list):
        status += f" ({len(data)} items)"
    elif isinstance(data, dict):
        status += f" ({len(data)} keys)"
    print(f"  {name} ({path}): {status}")

conn.close()
print("\n====== 검증 완료 ======")
