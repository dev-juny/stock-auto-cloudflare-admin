#!/usr/bin/env python3
"""Check stock_daily_prices vs positions."""
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

cur.execute("SELECT COUNT(*) FROM stock_daily_prices")
print("stock_daily_prices total:", cur.fetchone()[0])

cur.execute("SELECT MIN(trade_date), MAX(trade_date) FROM stock_daily_prices")
r = cur.fetchone()
print("Date range:", r[0], "~", r[1])

cur.execute("SELECT DISTINCT ticker FROM paper_positions WHERE status = 'open'")
tickers = [r[0] for r in cur.fetchall()]
print(f"Position tickers: {len(tickers)}")

for t in tickers[:10]:
    cur.execute("SELECT COUNT(*) FROM stock_daily_prices WHERE ticker = :1", [t])
    cnt = cur.fetchone()[0]
    cur.execute("SELECT trade_date, close_price FROM stock_daily_prices WHERE ticker = :1 ORDER BY trade_date DESC FETCH FIRST 3 ROWS ONLY", [t])
    rows = cur.fetchall()
    print(f"  {t}: {cnt} rows, prices in stock_daily_prices: {['{:.0f}'.format(r[1]) if r[1] else 'N/A' for r in rows]}")

cur.execute("SELECT COUNT(*), COUNT(highest_price), COUNT(CASE WHEN highest_price > 0 THEN 1 END) FROM paper_positions WHERE status = 'open'")
r = cur.fetchone()
print(f"positions: total={r[0]} highest_not_null={r[1]} highest_gt_zero={r[2]}")

cur.execute("SELECT pp.ticker, pp.entry_price, pp.current_price, pp.highest_price FROM paper_positions pp WHERE pp.status = 'open' FETCH FIRST 5 ROWS ONLY")
print("Sample positions (ticker, entry, current, highest):")
for r in cur.fetchall():
    print(f"  {r[0]} entry={r[1]} current={r[2]} highest={r[3]}")

conn.close()
