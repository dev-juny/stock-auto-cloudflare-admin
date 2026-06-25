#!/usr/bin/env python3
"""Check actual positions and diagnose why no sell exits."""
import urllib.request, json, oracledb

# --- API ---
d = json.loads(urllib.request.urlopen('http://localhost:5000/api/paper-trading/positions').read().decode())
items = d.get('items', [])
print("Total positions:", len(items))
for p in items[:20]:
    pnl = p.get('pnl_pct', 0)
    high = p.get('highest_price', 0)
    print(f"  {p.get('ticker'):8s} entry={p.get('entry_price'):>8.0f} current={p.get('current_price'):>8.0f} pnl%={pnl:>8.1f} highest={high:>8.0f} qty={p.get('quantity')} sid={p.get('strategy_id')}")

# --- DB for deeper analysis ---
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

# Get positions with strategy params to understand exit conditions
cur.execute("""
    SELECT pp.ticker, pp.entry_price, pp.current_price, pp.highest_price, pp.pnl_pct, pp.strategy_id, sp.params_json
    FROM paper_positions pp
    LEFT JOIN strategy_pool sp ON sp.id = pp.strategy_id
    WHERE pp.status = 'open'
    ORDER BY pp.entry_date DESC
    FETCH FIRST 20 ROWS ONLY
""")
print("\n=== Position Diagnostics ===")
for r in cur.fetchall():
    ticker, entry_p, curr_p, high_p, pnl, sid, params_json = r
    entry = float(entry_p or 0)
    curr = float(curr_p or 0)
    high = float(high_p or 0)
    pnl_pct = float(pnl or 0)
    
    # Parse params
    import json as j
    try:
        params = j.loads(params_json or '{}')
    except:
        params = {}
    
    sl = float(params.get("stop_loss_pct", 0))
    tp = float(params.get("fixed_take_profit_pct", 0.07))
    trail_act = float(params.get("trailing_activation_pct", 0.07))
    trail_stop = float(params.get("trailing_stop_pct", 0.03))
    
    tp_price = entry * (1 + tp) if entry > 0 else 0
    sl_price = entry * (1 - sl) if (entry > 0 and sl > 0) else 0
    trail_active = high > entry * (1 + trail_act) if entry > 0 else False
    trail_stop_price = high * (1 - trail_stop) if trail_active else 0
    
    print(f"\n  {ticker:8s} entry={entry:8.0f} curr={curr:8.0f} high={high:8.0f} pnl={pnl_pct:6.1f}% sid={sid}")
    print(f"         SL={sl*100:.0f}%({sl_price:8.0f}) TP={tp*100:.0f}%({tp_price:8.0f}) Trail(act={trail_act*100:.0f}% stop={trail_stop*100:.0f}%) active={trail_active} stop_price={trail_stop_price:8.0f}")
    
    # Diagnose why no exit
    reasons = []
    if sl > 0 and curr <= sl_price:
        reasons.append(f"STOP_LOSS triggered! ({curr:.0f} <= {sl_price:.0f})")
    elif sl > 0:
        reasons.append(f"SL not hit: need <= {sl_price:.0f}, curr={curr:.0f} ({(curr - sl_price):+.0f})")
    else:
        reasons.append("SL disabled (0%)")
        
    if tp > 0 and curr >= tp_price:
        reasons.append(f"TAKE_PROFIT triggered! ({curr:.0f} >= {tp_price:.0f})")
    elif tp > 0:
        reasons.append(f"TP not hit: need >= {tp_price:.0f}, curr={curr:.0f} ({(curr - tp_price):+.0f})")
    else:
        reasons.append("TP disabled (0%)")
    
    if trail_active:
        if curr <= trail_stop_price:
            reasons.append(f"TRAILING_STOP triggered! ({curr:.0f} <= {trail_stop_price:.0f})")
        else:
            reasons.append(f"Trailing active: high={high:.0f} stop={trail_stop_price:.0f} curr={curr:.0f} dist={((curr-trail_stop_price)/high*100):.1f}%")
    else:
        need = entry * (1 + trail_act)
        reasons.append(f"Trailing not active: high={high:.0f} need > {need:.0f}")
    
    print("         " + "; ".join(reasons))

conn.close()
