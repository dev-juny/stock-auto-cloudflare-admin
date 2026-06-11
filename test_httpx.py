import asyncio
import httpx
import time

async def main():
    http = httpx.AsyncClient(timeout=15, follow_redirects=True,
        headers={"User-Agent": "Mozilla/5.0", "Referer": "https://finance.naver.com/"})
    
    async def fetch():
        url = "https://finance.naver.com/sise/sise_market_sum.naver?sosok=0&page=1"
        resp = await http.get(url)
        return resp.status_code
    
    async def health():
        return "ok"
    
    t0 = time.time()
    results = await asyncio.gather(fetch(), health())
    t = time.time() - t0
    print(f"Results: {results}, time: {t:.3f}s")
    
    await http.aclose()

asyncio.run(main())
