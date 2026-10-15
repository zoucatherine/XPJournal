// Latest-wins serializer: one request in flight; newer intents replace older ones;
// an older response never reports itself as the latest.
export class LatestWins<T> {
  latest: T | null = null;
  inflight = false;
  cancelled = false;
  private send: (v: T) => Promise<unknown>;
  private eq: (a: T, b: T) => boolean;
  private onAck: (sent: T, saved: unknown, isLatest: boolean) => void;
  private onFail: (sent: T, error: unknown, isLatest: boolean) => void;
  constructor(
    send: (v: T) => Promise<unknown>,
    eq: (a: T, b: T) => boolean,
    onAck: (sent: T, saved: unknown, isLatest: boolean) => void,
    onFail: (sent: T, error: unknown, isLatest: boolean) => void,
  ) { this.send = send; this.eq = eq; this.onAck = onAck; this.onFail = onFail; }
  set(v: T) { this.latest = v; void this.pump(); }
  retry() { void this.pump(); }
  cancel() { this.cancelled = true; this.latest = null; }
  private async pump(): Promise<void> {
    if (this.inflight || this.cancelled || this.latest === null) return;
    this.inflight = true;
    const sent = this.latest;
    try {
      const saved = await this.send(sent);
      this.inflight = false;
      if (this.cancelled) return;
      const isLatest = this.latest !== null && this.eq(sent, this.latest);
      this.onAck(sent, saved, isLatest);
      if (isLatest) this.latest = null; else void this.pump();
    } catch (e) {
      this.inflight = false;
      if (this.cancelled) return;
      const isLatest = this.latest !== null && this.eq(sent, this.latest);
      this.onFail(sent, e, isLatest);
      if (!isLatest) void this.pump();
    }
  }
}
