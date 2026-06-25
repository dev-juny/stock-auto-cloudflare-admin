"""Supplementary verification - targeted checks."""
import os, json, subprocess, sys
from datetime import datetime, timedelta, timezone

KST = timezone(timedelta(hours=9))
BASE = "http://localhost:5000/api"

def api(path):
    try:
        r = subprocess.run(["curl", "-s", f"{BASE}{path}"], capture_output=True, text=True, timeout=15)
        return json.loads(r.stdout) if r.stdout else {}
    except Exception as e:
        return {"_error": str(e)}

# Direct DB query helper
def db(sql):
    import oracledb
    env = {}
    with open("/home/ubuntu/stock-auto-backend-python/.env") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"): continue
            k, _, v = line.partition("=")
            env[k.strip()] = v.strip()
    oracledb.init_oracle_client(
        lib_dir="/home/ubuntu/instantclient_19_19",
        config_dir=env.get("ORACLE_WALLET_PATH", "/home/ubuntu/wallet"),
    )
    conn = oracledb.connect(user=env["DB_USER"], password=env["DB_PASSWORD"], dsn=env["ORACLE_DSN"])
    cur = conn.cursor()
    cur.execute(sql)
    rows = cur.fetchall()
    conn.close()
    return rows

# ============================================================
# Check system_logs sources and paper trading logs
# ============================================================
print("="*70)
print("SYSTEM LOGS - Available Sources (Last 7 days)")
print("="*70)
rows = db("""
    SELECT source, COUNT(*) as cnt, MAX(created_at) as last_seen
    FROM system_logs
    WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '7' DAY
    GROUP BY source
    ORDER BY cnt DESC
""")
print(f"{'Source':<35} {'Count':<8} {'Last Seen (KST)'}")
print("-"*60)
for r in rows:
    kst = (r[2] + timedelta(hours=9)).strftime("%m-%d %H:%M") if r[2] else ""
    print(f"{r[0]:<35} {r[1]:<8} {kst}")

# ============================================================
# Paper Trading cycle logs specifically
# ============================================================
print("\n" + "="*70)
print("PAPER TRADING CYCLE LOGS (Last 20)")
print("="*70)
rows = db("""
    SELECT created_at, message FROM system_logs
    WHERE source = 'PAPER-SCHEDULER' OR source = 'paper_trading_scheduler'
    ORDER BY created_at DESC FETCH FIRST 20 ROWS ONLY
""")
if rows:
    for r in rows:
        kst = (r[0] + timedelta(hours=9)).strftime("%m-%d %H:%M") if r[0] else ""
        print(f"  {kst} {r[1][:150]}")
else:
    print("  No paper trading logs found with these source names")
    # Check what sources exist
    rows = db("""
        SELECT DISTINCT source FROM system_logs
        WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '7' DAY
        ORDER BY source
    """)
    print(f"  Available sources: {[r[0] for r in rows]}")

# ============================================================
# Promotion Logs
# ============================================================
print("\n" + "="*70)
print("PROMOTION LOGS")
print("="*70)
rows = db("""
    SELECT created_at, source, message FROM system_logs
    WHERE (source LIKE '%PROMOTION%' OR source LIKE '%promotion%' OR message LIKE '%promot%')
    ORDER BY created_at DESC FETCH FIRST 10 ROWS ONLY
""")
if rows:
    for r in rows:
        kst = (r[0] + timedelta(hours=9)).strftime("%m-%d %H:%M") if r[0] else ""
        print(f"  {kst} [{r[1]}] {r[2][:120]}")
else:
    print("  No promotion logs found")

# ============================================================
# Strategy Performance with correct column names
# ============================================================
print("\n" + "="*70)
print("TOP 20 STRATEGIES BY PF (Approved + Candidate)")
print("="*70)
try:
    rows = db("""
        SELECT ps.id, ps.generation,
               pf.fitness_score, pf.total_return, pf.win_rate,
               pf.max_drawdown, pf.profit_factor, pf.total_trades, pf.sharpe
        FROM portfolio_strategy ps
        JOIN strategy_performance pf ON pf.strategy_id = ps.id
          AND pf.generation = (SELECT MAX(pf2.generation) FROM strategy_performance pf2 WHERE pf2.strategy_id = ps.id)
        WHERE ps.status IN ('approved','candidate')
        ORDER BY pf.profit_factor DESC NULLS LAST
        FETCH FIRST 20 ROWS ONLY
    """)
    if rows:
        print(f"{'ID':<8} {'Gen':<6} {'Fitness':<10} {'Return':<10} {'WinRate':<10} {'MDD':<10} {'PF':<10} {'Trades':<8} {'Sharpe'}")
        print("-"*90)
        for r in rows:
            print(f"{r[0]:<8} {r[1]:<6} {str(r[2] or 0):<10} {str(r[3] or 0):<10} {str(r[4] or 0):<10} {str(r[5] or 0):<10} {str(r[6] or 0):<10} {r[7] or 0:<8} {r[8] or 0}")
    else:
        print("  No strategies with performance data.")
except Exception as e:
    print(f"  Query error: {e}")

# ============================================================
# Portfolio Strategy Status Summary
# ============================================================
print("\n" + "="*70)
print("PORTFOLIO STRATEGY STATUS")
print("="*70)
rows = db("""
    SELECT status, COUNT(*) as cnt
    FROM portfolio_strategy
    GROUP BY status
    ORDER BY cnt DESC
""")
for r in rows:
    print(f"  {r[0]}: {r[1]}")

# ============================================================
# Evolution Schedule Check
# ============================================================
print("\n" + "="*70)
print("EVOLUTION SCHEDULE")
print("="*70)
rows = db("""
    SELECT created_at, source, message FROM system_logs
    WHERE source = 'evolution_scheduler'
    ORDER BY created_at DESC FETCH FIRST 5 ROWS ONLY
""")
for r in rows:
    kst = (r[0] + timedelta(hours=9)).strftime("%m-%d %H:%M") if r[0] else ""
    print(f"  {kst} [{r[1]}] {r[2][:150]}")

# Check if index fixed the timeout issue
print("\n  Checking if index helped...")
rows = db("""
    SELECT COUNT(*) FROM system_logs
    WHERE source = 'evolution_scheduler'
      AND created_at >= CURRENT_TIMESTAMP - INTERVAL '1' HOUR
""")
print(f"  Evolution errors in last hour: {rows[0][0]}")
rows = db("""
    SELECT COUNT(*) FROM system_logs
    WHERE source = 'evolution_scheduler'
      AND created_at >= CURRENT_TIMESTAMP - INTERVAL '12' HOUR
""")
print(f"  Evolution errors in last 12 hours: {rows[0][0]}")

# ============================================================
# Paper Trading Actual Trades
# ============================================================
print("\n" + "="*70)
print("PAPER TRADES SUMMARY")
print("="*70)
rows = db("""
    SELECT action, COUNT(*), COALESCE(SUM(pnl_amt),0), COALESCE(SUM(pnl_pct),0)
    FROM paper_trades
    GROUP BY action
""")
for r in rows:
    print(f"  {r[0]}: {r[1]} trades, PnL: {r[2]:,.2f}, Return: {r[3]:.2f}%")

print(f"\n  Positions:")
rows = db("""
    SELECT status, COUNT(*), COALESCE(SUM(quantity*current_price),0)
    FROM paper_positions
    GROUP BY status
""")
for r in rows:
    print(f"  {r[0]}: {r[1]} positions, exposure: {r[2]:,.0f}")

# ============================================================
# Readiness detailed check
# ============================================================
print("\n" + "="*70)
print("LIVE TRADING READINESS - DETAILED CHECK")
print("="*70)
try:
    # Check system_logs for validation in past 30 days
    rows = db("""
        SELECT COUNT(*) FROM system_logs
        WHERE source = 'VALIDATION' AND created_at >= CURRENT_TIMESTAMP - INTERVAL '30' DAY
    """)
    print(f"  Validation activities (30d): {rows[0][0]}")
    
    # Check trades in 30 days
    rows = db("""
        SELECT COUNT(*) FROM paper_trades
        WHERE action = 'sell' AND trade_date >= CURRENT_TIMESTAMP - INTERVAL '30' DAY
    """)
    print(f"  Sell trades (30d): {rows[0][0]}")
    
    # Check overall performance
    perf = api("/paper-trading/performance?period=ALL")
    print(f"\n  Overall Performance:")
    print(f"    Total Return: {perf.get('total_return', 0):.2f}%")
    print(f"    Win Rate: {perf.get('win_rate', 0):.2f}%")
    print(f"    Profit Factor: {perf.get('profit_factor', 0):.4f}")
    print(f"    Sharpe: {perf.get('sharpe', 0):.4f}")
    print(f"    MDD: {perf.get('max_drawdown', 0):.2f}%")
    print(f"    Total Trades: {perf.get('total_trades', 0)}")
except Exception as e:
    print(f"  Error: {e}")

# ============================================================
# Market Data Sync
# ============================================================
print("\n" + "="*70)
print("MARKET DATA SYNC STATUS")
print("="*70)
try:
    rows = db("""
        SELECT source, message, created_at FROM system_logs
        WHERE source = 'market_data_sync' OR source = 'MARKET'
        ORDER BY created_at DESC FETCH FIRST 5 ROWS ONLY
    """)
    if rows:
        for r in rows:
            kst = (r[2] + timedelta(hours=9)).strftime("%m-%d %H:%M") if r[2] else ""
            print(f"  {kst} [{r[0]}] {r[1][:120]}")
    else:
        print("  No market data sync logs found")
except Exception as e:
    print(f"  Error: {e}")
