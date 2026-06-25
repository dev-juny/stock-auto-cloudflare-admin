import os
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
    user=env["DB_USER"],
    password=env["DB_PASSWORD"],
    dsn=env["ORACLE_DSN"],
)
cur = conn.cursor()

cur.execute(
    "SELECT index_name, column_name FROM user_ind_columns "
    "WHERE table_name='STRATEGY_PERFORMANCE' ORDER BY index_name, column_position"
)
print("Existing indexes:", cur.fetchall())

try:
    cur.execute(
        "CREATE INDEX idx_strat_perf_sid_gen ON strategy_performance(strategy_id, generation)"
    )
    print("Index created successfully")
except Exception as e:
    print("Index:", e)

conn.commit()
conn.close()
print("Done")
