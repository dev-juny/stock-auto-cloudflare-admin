#!/usr/bin/env python3
import oracledb

env = {}
with open("/home/ubuntu/stock-auto-backend-python/.env") as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        k, _, v = line.partition("=")
        env[k.strip()] = v.strip()

oracledb.init_oracle_client(
    lib_dir="/home/ubuntu/instantclient_19_19",
    config_dir=env.get("ORACLE_WALLET_PATH", "/home/ubuntu/wallet"),
)
conn = oracledb.connect(
    user=env["DB_USER"], password=env["DB_PASSWORD"], dsn=env["ORACLE_DSN"]
)
cur = conn.cursor()

# Check scheduler_history
try:
    cur.execute(
        "SELECT table_name FROM user_tables WHERE table_name = 'SCHEDULER_HISTORY'"
    )
    if cur.fetchall():
        cur.execute(
            "SELECT job_id, status, execution_time_ms, executed_at, message "
            "FROM scheduler_history ORDER BY executed_at DESC FETCH FIRST 10 ROWS ONLY"
        )
        print("SCHEDULER HISTORY:")
        for r in cur.fetchall():
            t = r[3].strftime("%m-%d %H:%M") if r[3] else ""
            print(f"  {t} [{r[0]}] {r[1]} {r[2]}ms - {(r[4] or '')[:100]}")
    else:
        print("SCHEDULER_HISTORY table does not exist")
except Exception as e:
    print(f"SCHEDULER_HISTORY error: {e}")

# Evolution status
try:
    cur.execute("""
        SELECT current_generation, is_running, status, last_run_at, next_scheduled_run
        FROM evolution_status ORDER BY id DESC FETCH FIRST 1 ROW ONLY
    """)
    r = cur.fetchone()
    if r:
        last = r[3].strftime("%m-%d %H:%M") if r[3] else ""
        nxt = r[4].strftime("%m-%d %H:%M") if r[4] else ""
        print("\nEVOLUTION STATUS:")
        print(f"  Generation: {r[0]}")
        print(f"  Running: {r[1]}")
        print(f"  Status: {r[2]}")
        print(f"  Last run: {last}")
        print(f"  Next: {nxt}")
except Exception as e:
    print(f"Evolution status query error: {e}")

# Test the index
try:
    import time
    t0 = time.time()
    cur.execute("""
        SELECT COUNT(*) FROM strategy_pool sp
        LEFT JOIN strategy_performance pf ON pf.strategy_id = sp.id
          AND pf.generation = (SELECT MAX(pf2.generation) FROM strategy_performance pf2 WHERE pf2.strategy_id = sp.id)
        WHERE sp.is_alive = 'Y'
    """)
    cnt = cur.fetchone()[0]
    elapsed = time.time() - t0
    print(f"\nINDEX PERFORMANCE TEST:")
    print(f"  Query returned {cnt} rows in {elapsed:.3f}s")
    if elapsed < 5:
        print("  VERDICT: Index is working - query fast")
    else:
        print("  VERDICT: Index may not be helping - query still slow")
except Exception as e:
    print(f"\nIndex TEST query error: {e}")

conn.close()
