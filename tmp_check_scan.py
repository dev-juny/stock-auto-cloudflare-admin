import sys
sys.path.insert(0, '/home/ubuntu/stock-auto-backend-python')
sys.path.insert(0, '/home/ubuntu/stock-auto-backtest/src')
from app.routers.backtest import _scan_states
for sid, s in list(_scan_states.items()):
    n = len(s.get('results', []))
    msg = s.get('message', '')[:40]
    status = s.get('status', '')
    total = s.get('total', 0)
    processed = s.get('processed', 0)
    print(f'{sid}: status={status} total={total} processed={processed} results={n} msg={msg}')
