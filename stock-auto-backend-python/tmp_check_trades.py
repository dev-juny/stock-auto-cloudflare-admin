#!/usr/bin/env python3
"""Detailed trade/position timeline."""
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
cur = conn.cursor()

# All trades with timestamps
cur.execute("SELECT id, ticker, action, price, quantity, trade_date, reason FROM paper_trades ORDER BY trade_date DESC FETCH FIRST 40 ROWS ONLY")
print("=== All Trades (newest first) ===")
for r in cur.fetchall():
    dt = r[5].strftime("%m-%d %H:%M") if hasattr(r[5], 'strftime') else str(r[5])
    print(f"  #{r[0]} {r[1]:8s} {r[2]:6s} price={r[3]:>8.0f} qty={r[4]:>5d} {dt} reason={r[6]}")

# Position creation dates
cur.execute("SELECT pp.id, pp.ticker, pp.entry_price, pp.entry_date, pp.strategy_id, pp.highest_price FROM paper_positions pp ORDER BY pp.entry_date DESC")
print("\n=== All Positions (newest first) ===")
for r in cur.fetchall():
    dt = r[3].strftime("%m-%d %H:%M") if hasattr(r[3], 'strftime') else str(r[3])
    print(f"  #{r[0]} {r[1]:8s} entry={r[2]:>8.0f} highest={r[4] if r[4] else 'N/A':>8} {dt} sid={r[5]}")

# Check market_data_sync
cur.execute("SELECT job_id, status, executed_at, message FROM scheduler_history ORDER BY executed_at DESC FETCH FIRST 10 ROWS ONLY")
print("\n=== Scheduler History (recent) ===")
for r in cur.fetchall():
    dt = r[2].strftime("%m-%d %H:%M") if hasattr(r[2], 'strftime') else str(r[2])
    print(f"  {dt} [{r[0]}] {r[1]} - {(r[3] or '')[:120]}")

conn.close()
