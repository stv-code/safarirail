type Env = NodeJS.ProcessEnv
type Fetcher = typeof fetch

type RateLimitResult = {
  limited: boolean
}

export type RateLimiter = {
  check(key: string): Promise<RateLimitResult>
}

export type RateLimitOptions = {
  namespace: string
  windowMs: number
  maxRequests: number
  fetcher?: Fetcher
}

class InMemoryRateLimiter implements RateLimiter {
  private readonly requests = new Map<string, { count: number; resetAt: number }>()

  constructor(private readonly options: RateLimitOptions) {}

  async check(key: string) {
    const now = Date.now()
    const scopedKey = `${this.options.namespace}:${key}`
    const current = this.requests.get(scopedKey)

    if (!current || current.resetAt <= now) {
      this.requests.set(scopedKey, { count: 1, resetAt: now + this.options.windowMs })
      return { limited: false }
    }

    current.count += 1
    return { limited: current.count > this.options.maxRequests }
  }
}

class UpstashRateLimiter implements RateLimiter {
  constructor(
    private readonly restUrl: string,
    private readonly token: string,
    private readonly options: RateLimitOptions,
  ) {}

  async check(key: string) {
    const redisKey = `safarirail:${this.options.namespace}:${key}`
    const increment = await this.command<number>(['INCR', redisKey])
    if (increment === 1) {
      await this.command<number>(['PEXPIRE', redisKey, String(this.options.windowMs)])
    }
    return { limited: increment > this.options.maxRequests }
  }

  private async command<T>(command: string[]) {
    const fetcher = this.options.fetcher || fetch
    const response = await fetcher(`${this.restUrl.replace(/\/$/, '')}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
    })
    if (!response.ok) throw new Error(`Rate limiter failed with status ${response.status}`)
    const payload = (await response.json()) as { result?: T; error?: string }
    if (payload.error) throw new Error('Rate limiter command failed')
    return payload.result as T
  }
}

export function createRateLimiter(env: Env, options: RateLimitOptions): RateLimiter {
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    return new UpstashRateLimiter(env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN, options)
  }

  return new InMemoryRateLimiter(options)
}

export function getClientIp(req: { headers: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }) {
  const forwardedFor = req.headers['x-forwarded-for']
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim()
  }
  return req.socket?.remoteAddress || 'unknown'
}
