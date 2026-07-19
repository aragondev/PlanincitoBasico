/** Ventana deslizante simple por socket para frenar bucles del frontend (§3.5). */
export class RateLimiter {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly windowMs: number,
    private readonly maxEvents: number,
    private readonly now: () => number = Date.now,
  ) {}

  allow(key: string): boolean {
    const timestamp = this.now();
    const bucket = this.buckets.get(key);

    if (!bucket || timestamp >= bucket.resetAt) {
      // Con claves sin evento de baja (una IP, por ejemplo) el mapa crecería
      // sin límite; lo podamos al superar un tamaño razonable (§3.6).
      if (this.buckets.size > 500) this.prune(timestamp);
      this.buckets.set(key, { count: 1, resetAt: timestamp + this.windowMs });
      return true;
    }
    if (bucket.count >= this.maxEvents) return false;
    bucket.count += 1;
    return true;
  }

  forget(key: string): void {
    this.buckets.delete(key);
  }

  prune(timestamp: number = this.now()): void {
    for (const [key, bucket] of this.buckets) {
      if (timestamp >= bucket.resetAt) this.buckets.delete(key);
    }
  }

  get size(): number {
    return this.buckets.size;
  }
}
