declare module 'sql.js' {
  export interface QueryExecResult {
    columns: string[];
    values: any[][];
  }
  export class Database {
    constructor(data?: Uint8Array);
    exec(sql: string): QueryExecResult[];
    close(): void;
  }
  export default function initSqlJs(config?: any): Promise<{ Database: typeof Database }>;
} 