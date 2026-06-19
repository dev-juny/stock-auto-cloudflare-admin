import oracledb, os
os.environ['ORACLE_WALLET_PATH'] = '/home/ubuntu/wallet'
os.environ['TNS_ADMIN'] = '/home/ubuntu/wallet'
os.environ['LD_LIBRARY_PATH'] = '/home/ubuntu/instantclient_19_19'
oracledb.init_oracle_client(config_dir='/home/ubuntu/wallet')
conn = oracledb.connect(user='ADMIN', password='!Odhfkzmfelql1379', dsn='stockdb_high')
cur = conn.cursor()
cur.execute("SELECT COUNT(*), MIN(trade_date), MAX(trade_date) FROM stock_daily_prices")
row = cur.fetchone()
print(f'Total rows: {row[0]}, Min date: {row[1]}, Max date: {row[2]}')
cur.execute("""
    SELECT ticker FROM stock_daily_prices 
    WHERE trade_date >= TO_DATE('2025-12-11','YYYY-MM-DD') 
      AND trade_date <= TO_DATE('2026-06-09','YYYY-MM-DD') 
    GROUP BY ticker 
    HAVING AVG(volume) > 500000 
       AND AVG((high_price - low_price) / NULLIF(close_price, 0)) < 0.12 
    ORDER BY AVG(volume) DESC 
    FETCH NEXT 30 ROWS ONLY
""")
rows = cur.fetchall()
print(f'Pre-filter count: {len(rows)}')
for r in rows:
    print(f'  {r[0]}')
conn.close()
