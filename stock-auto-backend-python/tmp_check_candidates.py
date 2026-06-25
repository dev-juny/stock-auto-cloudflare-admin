#!/usr/bin/env python3
"""Check portfolio_strategy candidates and why auto-promotion fails."""
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

# All portfolio_strategy entries
cur.execute("""
    SELECT ps.id, ps.strategy_id, sp.name, ps.status, ps.generation, ps.allocation,
           pf.fitness_score, pf.win_rate, pf.total_trades, pf.max_drawdown, pf.profit_factor
    FROM portfolio_strategy ps
    LEFT JOIN strategy_pool sp ON sp.id = ps.strategy_id
    LEFT JOIN strategy_performance pf ON pf.strategy_id = ps.strategy_id
      AND pf.generation = (SELECT MAX(pf2.generation) FROM strategy_performance pf2 WHERE pf2.strategy_id = ps.strategy_id)
    ORDER BY ps.id
""")
rows = cur.fetchall()
print(f"portfolio_strategy entries: {len(rows)}")
if not rows:
    print("  TABLE EMPTY")
else:
    for r in rows:
        pid, sid, name, status, gen, alloc, fitness, wr, trades, mdd, pf = r
        print(f"  id={pid} sid={sid} name={str(name or '')[:25]:25s} status={status} gen={gen}")
        if status == 'candidate':
            print(f"    fitness={fitness} wr={wr} trades={trades} mdd={mdd} pf={pf}")
            fail_reasons = []
            if fitness is None or float(fitness or 0) < 50:
                fail_reasons.append(f"fitness {fitness or 0} < 50")
            if wr is None or float(wr or 0) < 45:
                fail_reasons.append(f"win_rate {wr or 0} < 45")
            if trades is None or int(trades or 0) < 30:
                fail_reasons.append(f"trades {trades or 0} < 30")
            if pf is None or float(pf or 0) < 1.3:
                fail_reasons.append(f"PF {pf or 0} < 1.3")
            if mdd is None or abs(float(mdd or 0)) > 20:
                fail_reasons.append(f"MDD {abs(float(mdd or 0)):.1f} > 20")
            if fail_reasons:
                print(f"    FAIL: {'; '.join(fail_reasons)}")
            else:
                print(f"    ELIGIBLE for promotion!")

conn.close()
