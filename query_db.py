import sys, asyncio
sys.path.insert(0, '/home/ubuntu/stock-auto-backend-python/app')
sys.path.insert(0, '/home/ubuntu/stock-auto-backend-python')
from app.database import execute_query, init_oracle

async def main():
    await init_oracle()
    r = await execute_query('SELECT MAX(trade_date) FROM stock_daily_prices', None)
    print(f'MAX trade_date: {r[0][0] if r else None}')
    r = await execute_query('SELECT COUNT(*) FROM stock_daily_prices', None)
    print(f'Total rows: {r[0][0] if r else None}')
    r = await execute_query('SELECT COUNT(DISTINCT ticker) FROM stock_daily_prices', None)
    print(f'Distinct tickers: {r[0][0] if r else None}')
    r = await execute_query('SELECT COUNT(*) FROM stock_master', None)
    print(f'stock_master rows: {r[0][0] if r else None}')
    r = await execute_query('SELECT COUNT(*) FROM stock_daily', None)
    print(f'stock_daily rows: {r[0][0] if r else None}')
    r = await execute_query('SELECT COUNT(*) FROM batch_history', None)
    print(f'batch_history rows: {r[0][0] if r else None}')
    r = await execute_query('SELECT COUNT(*) FROM scheduler_history WHERE job_id=:1', ['market_data_sync'])
    print(f'scheduler_history market_data_sync rows: {r[0][0] if r else None}')
    r = await execute_query('SELECT MAX(created_at) FROM scheduler_history WHERE job_id=:1', ['market_data_sync'])
    print(f'scheduler_history last: {r[0][0] if r else None}')

asyncio.run(main())
