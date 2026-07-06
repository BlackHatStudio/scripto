declare module "pg" {
  export type QueryResultRow = Record<string, unknown>

  export interface QueryResult<T extends QueryResultRow = QueryResultRow> {
    rows: T[]
  }

  export interface PoolConfig {
    connectionString?: string
    max?: number
    connectionTimeoutMillis?: number
    idleTimeoutMillis?: number
  }

  export class Pool {
    constructor(config?: PoolConfig)
    query<T extends QueryResultRow = QueryResultRow>(
      text: string,
      params?: readonly unknown[]
    ): Promise<QueryResult<T>>
  }
}
