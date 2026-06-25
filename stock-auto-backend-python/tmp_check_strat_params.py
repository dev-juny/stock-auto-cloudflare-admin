#!/usr/bin/env python3
"""Check strategy params for positions."""
import oracledb, json

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

# Strategies used by positions
cur.execute("SELECT DISTINCT strategy_id FROM paper_positions WHERE status = 'open'")
sids = [r[0] for r in cur.fetchall()]
print("Strategy IDs in positions:", sids)

for sid in sids:
    cur.execute("SELECT params_json FROM strategy_pool WHERE id = :1", [sid])
    row = cur.fetchone()
    if row and row[0]:
        raw = row[0].read() if hasattr(row[0], 'read') else row[0]
        params = json.loads(raw)
        print(f"\nStrategy {sid} params:")
        for k, v in sorted(params.items()):
            print(f"  {k}: {v}")
    else:
        print(f"\nStrategy {sid}: no params found")

# Current price for each ticker today
cur.execute("SELECT pp.ticker, pp.entry_price, sp.close_price FROM paper_positions pp LEFT JOIN (SELECT ticker, close_price, trade_date, ROW_NUMBER() OVER (PARTITION BY ticker ORDER BY trade_date DESC) rn FROM stock_daily_prices) sp ON sp.ticker = pp.ticker AND sp.rn = 1 WHERE pp.status = 'open'")
print("\nEntry vs Latest prices:")
seen = set()
for r in cur.fetchall():
    t = r[0]
    if t not in seen:
        seen.add(t)
        entry = float(r[1] or 0)
        latest = float(r[2] or 0)
        diff = (latest - entry) / entry * 100 if entry > 0 else 0
        print(f"  {t}: entry={entry:.0f} latest={latest:.0f} diff={diff:+.2f}%")

conn.close()
