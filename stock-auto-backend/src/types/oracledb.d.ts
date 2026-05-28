declare module 'oracledb' {
  interface PoolAttributes {
    user?: string;
    password?: string;
    connectString?: string;
    poolMin?: number;
    poolMax?: number;
    poolIncrement?: number;
    poolTimeout?: number;
    configDir?: string;
    walletPassword?: string;
  }

  interface Pool {
    getConnection(): Promise<Connection>;
    close(timeout?: number): Promise<void>;
  }

  interface Connection {
    execute<T>(sql: string, binds?: unknown[], options?: object): Promise<{ rows: T[] }>;
    close(): Promise<void>;
    release(): Promise<void>;
  }

  interface InitOracleClientOptions {
    configDir?: string;
    libDir?: string;
    driverName?: string;
  }

  export function initOracleClient(options?: InitOracleClientOptions): void;
  export function getConnection(options: { user: string; password: string; connectString: string }): Promise<Connection>;
  export function createPool(options: PoolAttributes): Promise<Pool>;
}
