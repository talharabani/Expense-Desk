/**
 * An in-memory stand-in for the Supabase client, covering the query shapes the
 * service layer actually uses:
 *
 *   from(t).insert(row).select().single()
 *   from(t).insert(row)                       // awaited directly
 *   from(t).select(cols).eq(a, b).single()
 *   from(t).select('id', { count: 'exact', head: true }).eq(a, b)
 *   from(t).select(cols).in(col, values).eq(a, b)
 *   from(t).update(patch).eq(a, b)
 *   from(t).delete().eq(a, b)
 *
 * It is deliberately not a database: there is no join support, so a test that
 * needs an embedded relation (`select('*, income_payments(amount)')`) seeds the
 * related rows on the parent row itself. Nor is there RLS — these tests cover
 * the service logic above the database, not the policies inside it.
 *
 * Every builder is thenable so both `await query` and `await query.single()`
 * work, matching how postgrest-js behaves at the call sites.
 */

export interface MockRow {
  [key: string]: unknown
}

export type MockTables = Record<string, MockRow[]>

interface Filter {
  kind: 'eq' | 'in' | 'neq' | 'ilike'
  column: string
  value: unknown
}

/** Case-insensitive match honouring postgrest's `%` wildcard. */
function ilikeMatches(actual: unknown, pattern: string): boolean {
  if (typeof actual !== 'string') return false
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*')
  return new RegExp(`^${escaped}$`, 'i').test(actual)
}

export interface MockCall {
  table: string
  op: 'select' | 'insert' | 'update' | 'delete'
  payload?: MockRow
  filters: Filter[]
}

let idCounter = 0
const nextId = () => `mock-id-${++idCounter}`

function matches(row: MockRow, filters: Filter[]): boolean {
  return filters.every((f) => {
    const actual = row[f.column]
    if (f.kind === 'eq') return actual === f.value
    if (f.kind === 'neq') return actual !== f.value
    if (f.kind === 'ilike') return ilikeMatches(actual, String(f.value))
    return Array.isArray(f.value) && (f.value as unknown[]).includes(actual)
  })
}

class QueryBuilder implements PromiseLike<{ data: unknown; error: { message: string } | null; count?: number }> {
  private filters: Filter[] = []
  private wantSingle = false
  private headOnly = false
  private wantCount = false
  private rowLimit?: number
  private payload?: MockRow

  constructor(
    private tables: MockTables,
    private table: string,
    private op: 'select' | 'insert' | 'update' | 'delete',
    private calls: MockCall[],
    /** Table name -> error to return, for exercising failure paths. */
    private failures: Record<string, string>
  ) {}

  private get rows(): MockRow[] {
    this.tables[this.table] ??= []
    return this.tables[this.table]
  }

  select(_columns?: string, options?: { count?: string; head?: boolean }) {
    if (options?.count) this.wantCount = true
    if (options?.head) this.headOnly = true
    return this
  }

  insert(payload: MockRow) {
    this.op = 'insert'
    this.payload = payload
    return this
  }

  update(payload: MockRow) {
    this.op = 'update'
    this.payload = payload
    return this
  }

  delete() {
    this.op = 'delete'
    return this
  }

  eq(column: string, value: unknown) {
    this.filters.push({ kind: 'eq', column, value })
    return this
  }

  neq(column: string, value: unknown) {
    this.filters.push({ kind: 'neq', column, value })
    return this
  }

  in(column: string, value: unknown[]) {
    this.filters.push({ kind: 'in', column, value })
    return this
  }

  order() {
    return this
  }

  limit(count: number) {
    this.rowLimit = count
    return this
  }

  gte() {
    return this
  }

  lte() {
    return this
  }

  ilike(column: string, pattern: string) {
    this.filters.push({ kind: 'ilike', column, value: pattern })
    return this
  }

  single() {
    this.wantSingle = true
    return this
  }

  maybeSingle() {
    this.wantSingle = true
    return this
  }

  private run() {
    this.calls.push({
      table: this.table,
      op: this.op,
      payload: this.payload,
      filters: [...this.filters],
    })

    const failure = this.failures[this.table]
    if (failure) return { data: null, error: { message: failure } }

    if (this.op === 'insert') {
      const row = { id: nextId(), ...this.payload }
      this.rows.push(row)
      return { data: this.wantSingle ? row : [row], error: null }
    }

    const matched = this.rows.filter((r) => matches(r, this.filters))
    const hits = this.rowLimit === undefined ? matched : matched.slice(0, this.rowLimit)

    if (this.op === 'update') {
      hits.forEach((r) => Object.assign(r, this.payload))
      return { data: hits, error: null }
    }

    if (this.op === 'delete') {
      for (const hit of hits) this.rows.splice(this.rows.indexOf(hit), 1)
      return { data: hits, error: null }
    }

    if (this.wantCount) {
      return { data: this.headOnly ? null : hits, error: null, count: hits.length }
    }

    if (this.wantSingle) {
      // postgrest returns an error, not an empty row, when single() finds nothing.
      if (hits.length !== 1) {
        return { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned' } }
      }
      return { data: hits[0], error: null }
    }

    return { data: hits, error: null }
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: { message: string } | null; count?: number }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected)
  }
}

export interface MockUpload {
  bucket: string
  path: string
  contentType?: string
}

export interface MockSupabase {
  from(table: string): QueryBuilder
  storage: {
    from(bucket: string): {
      upload(path: string, file: unknown, options?: { contentType?: string }): Promise<{ error: { message: string } | null }>
      createSignedUrl(path: string, expiresIn: number): Promise<{ data: { signedUrl: string } | null }>
    }
  }
  /** Every query the code under test issued, in order. */
  calls: MockCall[]
  tables: MockTables
  /** Every file handed to storage, in order. */
  uploads: MockUpload[]
  /** Make every query against `table` fail with `message`. */
  failOn(table: string, message: string): void
  /** Make the next storage upload fail. */
  failUploads(message: string): void
  /** Rows currently in a table. */
  rowsIn(table: string): MockRow[]
}

export function createMockSupabase(seed: MockTables = {}): MockSupabase {
  const tables: MockTables = JSON.parse(JSON.stringify(seed))
  const calls: MockCall[] = []
  const failures: Record<string, string> = {}
  const uploads: MockUpload[] = []
  let uploadFailure: string | null = null

  return {
    from: (table: string) => new QueryBuilder(tables, table, 'select', calls, failures),
    storage: {
      from: (bucket: string) => ({
        async upload(path: string, _file: unknown, options?: { contentType?: string }) {
          if (uploadFailure) return { error: { message: uploadFailure } }
          uploads.push({ bucket, path, contentType: options?.contentType })
          return { error: null }
        },
        async createSignedUrl(path: string, expiresIn: number) {
          return { data: { signedUrl: `https://signed.test/${bucket}/${path}?exp=${expiresIn}` } }
        },
      }),
    },
    calls,
    tables,
    uploads,
    failOn: (table, message) => {
      failures[table] = message
    },
    failUploads: (message) => {
      uploadFailure = message
    },
    rowsIn: (table) => tables[table] ?? [],
  }
}
