#!/usr/bin/env python3
"""Test: does asyncio.gather with Semaphore block the event loop?"""
import asyncio
import time

async def worker(n, delay):
    """Simulate a blocking CPU task that yields periodically."""
    async def inner():
        for i in range(10):
            # Simulate sync CPU work
            for _ in range(5000000):
                pass
            # Yield to event loop
            await asyncio.sleep(0)
            # Check if we should stop
            if i % 3 == 0:
                pass
    await inner()
    return n

async def health_check():
    """Simulate a health check endpoint."""
    return "ok"

async def main():
    sem = asyncio.Semaphore(3)
    
    async def limited_worker(n):
        async with sem:
            return await worker(n, 0.5)
    
    t0 = time.time()
    
    # Start gather in background
    async def run_scan():
        results = await asyncio.gather(*[limited_worker(i) for i in range(30)])
        print(f"Scan done in {time.time()-t0:.3f}s", flush=True)
        return results
    
    scan_task = asyncio.create_task(run_scan())
    
    # Poll health every second for 15 seconds
    for i in range(15):
        await asyncio.sleep(1)
        h = await health_check()
        print(f"Poll {i+1}: health={h} at {time.time()-t0:.1f}s", flush=True)
    
    await scan_task

asyncio.run(main())
