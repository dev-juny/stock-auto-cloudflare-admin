import asyncio
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path("/home/ubuntu/stock-auto-backend-python").resolve()))
sys.path.insert(0, str(Path("/home/ubuntu/stock-auto-backtest/src").resolve()))

from app.services.data_provider import get_all_tickers

async def main():
    # Start get_all_tickers in background
    t0 = time.time()
    
    async def poller():
        while True:
            await asyncio.sleep(0.5)
            elapsed = time.time() - t0
            print(f"[poller] alive at {elapsed:.1f}s", flush=True)
            if elapsed > 15:
                break
    
    async def scanner():
        print(f"[scanner] Starting get_all_tickers...", flush=True)
        result = await get_all_tickers()
        print(f"[scanner] Done, got {len(result)} tickers in {time.time()-t0:.1f}s", flush=True)
    
    await asyncio.gather(scanner(), poller())

asyncio.run(main())
