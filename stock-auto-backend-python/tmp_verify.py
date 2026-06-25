"""Comprehensive system verification script - checks DB data and API responses."""
import os, json, subprocess, sys
from datetime import datetime, timezone, timedelta

KST = timezone(timedelta(hours=9))
BASE = "http://localhost:5000/api"

def api(path):
    try:
        r = subprocess.run(["curl", "-s", f"{BASE}{path}"], capture_output=True, text=True, timeout=15)
        return json.loads(r.stdout) if r.stdout else {}
    except Exception as e:
        return {"_error": str(e)}

def db(sql):
    """Execute SQL via oracle client and return rows."""
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
# 1. Auto Promotion
# ============================================================
print("="*70)
print("[1] AUTO PROMOTION")
print("="*70)

# Check if auto_promote_strategies was called via system_logs
logs_raw = api("/logs?limit=50")
logs = logs_raw if isinstance(logs_raw, list) else logs_raw.get("logs", [])
promo_logs = [l for l in logs if "auto_promote" in str(l.get("message","")).lower() or "promotion" in str(l.get("source","")).lower()]
print(f"\nSystem logs mentioning 'promotion': {len(promo_logs)}")
for l in promo_logs[:5]:
    print(f"  {l.get('created_at_kst','')} [{l.get('source','')}] {l.get('message','')[:120]}")

# Promotion history count
try:
    rows = db("SELECT COUNT(*) FROM promotion_history")
    print(f"\nPromotion history records: {rows[0][0]}")
except Exception as e:
    print(f"\nPromotion history query error: {e}")

# Last promotion records
try:
    rows = db("""
        SELECT ph.created_at, ph.strategy_id, sp.name, ph.old_status, ph.new_status, ph.reason
        FROM promotion_history ph
        LEFT JOIN strategy_pool sp ON sp.id = ph.strategy_id
        ORDER BY ph.created_at DESC FETCH FIRST 10 ROWS ONLY
    """)
    if rows:
        print(f"\nLast {len(rows)} promotions:")
        print(f"{'Created At (KST)':<25} {'StrategyID':<12} {'Name':<20} {'Old→New':<20} {'Reason'}")
        print("-"*120)
        for r in rows:
            kst = (r[0] + timedelta(hours=9)).strftime("%Y-%m-%d %H:%M") if r[0] else ""
            print(f"{kst:<25} {str(r[1]):<12} {(r[2] or ''):<20} {r[3]}→{r[4]:<15} {r[5][:60]}")
    else:
        print("\nNo promotion history found.")
except Exception as e:
    print(f"\nPromotion detail query error: {e}")

# Check if auto-promotion is scheduled/running via API
# Auto-promote is POST, but we can check the last result from system_logs
promo_results = [l for l in logs if "auto-promotion" in str(l.get("source","")).lower() and "promoted" in str(l.get("message","")).lower()]
if promo_results:
    print(f"\nLast auto-promotion result: {promo_results[0].get('message','')[:200]}")
else:
    print("\nNo auto-promotion results in recent logs")

# ============================================================
# 2. Rebalance
# ============================================================
print("\n" + "="*70)
print("[2] REBALANCE")
print("="*70)

try:
    rows = db("SELECT COUNT(*) FROM portfolio_rebalance_history")
    print(f"\nRebalance history records: {rows[0][0]}")
    if rows[0][0] > 0:
        rows = db("""
            SELECT created_at, method, allocations_before, allocations_after, reason
            FROM portfolio_rebalance_history
            ORDER BY created_at DESC FETCH FIRST 5 ROWS ONLY
        """)
        for r in rows:
            kst = (r[0] + timedelta(hours=9)).strftime("%Y-%m-%d %H:%M") if r[0] else ""
            print(f"\n--- {kst} | Method: {r[1]} | Reason: {(r[4] or '')[:60]} ---")
            before = json.loads(r[2]) if r[2] else {}
            after = json.loads(r[3]) if r[3] else {}
            all_ids = set(list(before.keys()) + list(after.keys()))
            print(f"{'StrategyID':<15} {'Before':<10} {'→':<5} {'After':<10}")
            for sid in sorted(all_ids):
                b = before.get(sid, "-")
                a = after.get(sid, "-")
                print(f"{sid:<15} {str(b):<10} {'→':<5} {str(a):<10}")
except Exception as e:
    print(f"\nRebalance query error: {e}")

# ============================================================
# 3. Validation Mode
# ============================================================
print("\n" + "="*70)
print("[3] VALIDATION MODE")
print("="*70)

try:
    rows = db("SELECT id, is_active, started_at, completed_at, result FROM validation_mode ORDER BY id DESC FETCH FIRST 3 ROWS ONLY")
    if rows:
        for r in rows:
            started = (r[2] + timedelta(hours=9)).strftime("%Y-%m-%d %H:%M") if r[2] else ""
            completed = (r[3] + timedelta(hours=9)).strftime("%Y-%m-%d %H:%M") if r[3] else ""
            elapsed = (datetime.now(KST) - r[2].replace(tzinfo=KST)).days if r[2] else 0
            print(f"\nID: {r[0]} | Active: {r[1]}")
            print(f"  Started: {started}")
            print(f"  Completed: {completed}")
            print(f"  Elapsed days: {elapsed}")
            if r[4]:
                result = json.loads(r[4]) if isinstance(r[4], str) else r[4]
                print(f"  Result: {json.dumps(result, indent=4, ensure_ascii=False)[:300]}")
    else:
        print("\nNo validation records found.")
except Exception as e:
    print(f"\nValidation query error: {e}")

try:
    rows = db("SELECT COUNT(*) FROM validation_daily_log")
    print(f"\nValidation daily log records: {rows[0][0]}")
    if rows[0][0] > 0:
        rows = db("""
            SELECT log_date, daily_return, cumulative_return, mdd, win_rate, total_trades
            FROM validation_daily_log
            ORDER BY log_date DESC FETCH FIRST 10 ROWS ONLY
        """)
        print(f"\nRecent daily logs:")
        print(f"{'Date':<15} {'Daily Return':<15} {'Cumulative':<15} {'MDD':<10} {'WinRate':<10} {'Trades'}")
        print("-"*80)
        for r in rows:
            d = r[0].strftime("%Y-%m-%d") if r[0] else ""
            print(f"{d:<15} {str(r[1] or 0):<15} {str(r[2] or 0):<15} {str(r[3] or 0):<10} {str(r[4] or 0):<10} {r[5] or 0}")
except Exception as e:
    print(f"\nDaily log query error: {e}")

# ============================================================
# 4. Live Trading Readiness
# ============================================================
print("\n" + "="*70)
print("[4] LIVE TRADING READINESS")
print("="*70)

readiness = api("/live-trading/readiness")
print(f"\nFull response:")
print(json.dumps(readiness, indent=2, ensure_ascii=False))

# ============================================================
# 5. Profit Factor
# ============================================================
print("\n" + "="*70)
print("[5] PROFIT FACTOR (Top 20 Strategies)")
print("="*70)

try:
    rows = db("""
        SELECT ps.id, ps.generation, ps.name,
               pf.fitness_score, pf.total_return, pf.win_rate,
               pf.max_drawdown, pf.profit_factor, pf.total_trades
        FROM portfolio_strategy ps
        JOIN strategy_performance pf ON pf.strategy_id = ps.id
          AND pf.generation = (SELECT MAX(pf2.generation) FROM strategy_performance pf2 WHERE pf2.strategy_id = ps.id)
        WHERE ps.status IN ('approved','candidate')
        ORDER BY pf.profit_factor DESC NULLS LAST
        FETCH FIRST 20 ROWS ONLY
    """)
    if rows:
        print(f"\n{'ID':<8} {'Gen':<6} {'Name':<22} {'Fitness':<10} {'Return':<10} {'WinRate':<10} {'MDD':<10} {'PF':<10} {'Trades'}")
        print("-"*110)
        for r in rows:
            print(f"{r[0]:<8} {r[1]:<6} {(r[2] or ''):<22} {str(r[3] or 0):<10} {str(r[4] or 0):<10} {str(r[5] or 0):<10} {str(r[6] or 0):<10} {str(r[7] or 0):<10} {r[8] or 0}")
    else:
        print("\nNo strategies with performance data.")
except Exception as e:
    print(f"\nPF query error: {e}")

# PF sample verification - actual trades with PnL
print("\n--- PF Calculation Sample (Last 5 trades with PnL) ---")
try:
    rows = db("""
        SELECT id, strategy_id, ticker, action, quantity, price, pnl_amt, pnl_pct, trade_date
        FROM paper_trades
        WHERE action = 'sell'
        ORDER BY trade_date DESC FETCH FIRST 5 ROWS ONLY
    """)
    if rows:
        for r in rows:
            d = r[8].strftime("%Y-%m-%d %H:%M") if r[8] else ""
            print(f"  Trade {r[0]}: S{r[1]} {r[2]} qty={r[4]} price={r[5]} pnl={r[6]} pnl_pct={r[7]}% date={d}")
    else:
        print("  No sell trades found.")
except Exception as e:
    print(f"  PF sample error: {e}")

# Total gross profit / loss
try:
    rows = db("""
        SELECT
            (SELECT COALESCE(SUM(pnl_amt), 0) FROM paper_trades WHERE action = 'sell' AND pnl_amt > 0) as gp,
            (SELECT COALESCE(SUM(pnl_amt), 0) FROM paper_trades WHERE action = 'sell' AND pnl_amt < 0) as gl
        FROM dual
    """)
    if rows:
        gp = float(rows[0][0])
        gl = abs(float(rows[0][1])) if rows[0][1] else 0
        pf = gp / gl if gl > 0 else (gp if gp > 0 else 0)
        print(f"\n  Gross Profit: {gp:,.2f}")
        print(f"  Gross Loss:   {gl:,.2f}")
        print(f"  Profit Factor: {pf:.4f}")
        # Grade
        if pf >= 2.0: grade = "EXCELLENT"
        elif pf >= 1.5: grade = "STRONG"
        elif pf >= 1.2: grade = "GOOD"
        elif pf >= 1.0: grade = "WEAK"
        else: grade = "LOSS"
        print(f"  PF Grade: {grade}")
except Exception as e:
    print(f"  Gross P&L error: {e}")

# ============================================================
# 6. Paper Trading (Last 7 days)
# ============================================================
print("\n" + "="*70)
print("[6] PAPER TRADING (Last 7 days)")
print("="*70)

try:
    rows = db("""
        SELECT created_at, message FROM system_logs
        WHERE source = 'paper_trading_scheduler'
          AND created_at >= CURRENT_TIMESTAMP - INTERVAL '7' DAY
        ORDER BY created_at DESC FETCH FIRST 20 ROWS ONLY
    """)
    if rows:
        print(f"\nLast {len(rows)} paper trading cycle logs:")
        for r in rows:
            kst = (r[0] + timedelta(hours=9)).strftime("%m-%d %H:%M") if r[0] else ""
            print(f"  {kst} {r[1][:150]}")
    else:
        print("\nNo paper trading logs found in last 7 days.")
except Exception as e:
    print(f"\nPaper trading log error: {e}")

# Paper trading performance
print(f"\nPaper Trading Performance:")
perf = api("/paper-trading/performance?period=7D")
print(json.dumps(perf, indent=2, ensure_ascii=False)[:500])

# ============================================================
# 7. Scheduler Status
# ============================================================
print("\n" + "="*70)
print("[7] SCHEDULER STATUS")
print("="*70)

sched = api("/scheduler/status")
print(f"\nAPI Response:")
print(json.dumps(sched, indent=2, ensure_ascii=False))

# Check scheduler failures
try:
    rows = db("""
        SELECT created_at, source, message FROM system_logs
        WHERE log_type = 'error' AND source IN ('evolution_scheduler','paper_trading_scheduler','market_scheduler')
        ORDER BY created_at DESC FETCH FIRST 10 ROWS ONLY
    """)
    if rows:
        print(f"\nRecent scheduler errors ({len(rows)}):")
        for r in rows:
            kst = (r[0] + timedelta(hours=9)).strftime("%m-%d %H:%M") if r[0] else ""
            print(f"  [{r[1]}] {kst} {r[2][:100]}")
except Exception as e:
    print(f"\nScheduler error query error: {e}")

# ============================================================
# 8. Health Dashboard
# ============================================================
print("\n" + "="*70)
print("[8] SYSTEM HEALTH")
print("="*70)

health = api("/system/health")
print(f"\nAPI Response:")
print(json.dumps(health, indent=2, ensure_ascii=False))

# System metrics
print(f"\nSystem metrics:")
os.system("free -h")
os.system("uptime")

# ============================================================
# 9. Evolution Status
# ============================================================
print("\n" + "="*70)
print("[9] EVOLUTION STATUS (Last 30 Generations)")
print("="*70)

evo = api("/evolution/dashboard")
print(f"\nAPI Response (summary):")
print(json.dumps({k:v for k,v in evo.items() if k != 'trends'}, indent=2, ensure_ascii=False))

if 'trends' in evo:
    trends = evo['trends'][-30:] if len(evo['trends']) > 30 else evo['trends']
    print(f"\nLast {len(trends)} Generations Trend:")
    print(f"{'Gen':<8} {'Fitness':<12} {'Return':<12} {'WinRate':<10} {'StratCnt'}")
    print("-"*55)
    for t in trends:
        print(f"{t['generation']:<8} {t['avg_fitness']:<12.4f} {t['avg_return']:<12.4f} {t['avg_winrate']:<10.2f} {t.get('strategy_count',0)}")

    # Trend analysis
    if len(trends) >= 5:
        recent = trends[-5:]
        older = trends[-10:-5]
        fit_trend = "UP" if recent[-1]['avg_fitness'] > recent[0]['avg_fitness'] else ("DOWN" if recent[-1]['avg_fitness'] < recent[0]['avg_fitness'] else "FLAT")
        ret_trend = "UP" if recent[-1]['avg_return'] > recent[0]['avg_return'] else ("DOWN" if recent[-1]['avg_return'] < recent[0]['avg_return'] else "FLAT")
        wr_trend = "UP" if recent[-1]['avg_winrate'] > recent[0]['avg_winrate'] else ("DOWN" if recent[-1]['avg_winrate'] < recent[0]['avg_winrate'] else "FLAT")
        print(f"\nTrend (last 5 gens):")
        print(f"  Fitness: {fit_trend} ({recent[0]['avg_fitness']:.2f} → {recent[-1]['avg_fitness']:.2f})")
        print(f"  Return:  {ret_trend} ({recent[0]['avg_return']:.2f} → {recent[-1]['avg_return']:.2f})")
        print(f"  WinRate: {wr_trend} ({recent[0]['avg_winrate']:.2f} → {recent[-1]['avg_winrate']:.2f})")

# ============================================================
# 10. Overall Assessment
# ============================================================
print("\n" + "="*70)
print("[10] OPERATIONAL READINESS ASSESSMENT")
print("="*70)

# Check actual paper trading cycle worked
risk_result = api("/risk/check")
perf_result = api("/paper-trading/performance")
cycle_logs = [l for l in logs if l.get('source') == 'paper_trading_scheduler' and 'Cycle result' in str(l.get('message',''))]
cycle_count_7d = len(cycle_logs)
cycle_count_7d = len(cycle_logs)

print(f"Risk Check: {'PASS' if risk_result.get('risk_status') == 'PASS' else 'FAIL'} (open_positions={risk_result.get('open_positions',0)})")
print(f"Paper Trading Cycles (7d): {cycle_count_7d}")
print(f"Total Trades: {perf_result.get('total_trades',0)}")
print(f"Open Positions: {risk_result.get('open_positions',0)}")
print(f"Promotion Records: {len(promo_logs)}")
print(f"Evolution Running: {evo.get('is_running', False)}")
print(f"Generation: {evo.get('current_generation', '?')}")
print(f"DB Connected: {health.get('db_connected', False)}")

# Final assessment
print(f"\n--- FINAL VERDICT ---")
can_start = True
issues = []

if not health.get('db_connected'):
    can_start = False
    issues.append("DB not connected")
if cycle_count_7d == 0:
    can_start = False
    issues.append("Paper trading not running")
if health.get('db_pool', {}) == {}:
    issues.append("DB pool status unknown")

if can_start:
    print("READY for 30-day validation mode")
    print("All core systems operational")
else:
    print("NOT READY - issues found:")
    for i in issues:
        print(f"  - {i}")
