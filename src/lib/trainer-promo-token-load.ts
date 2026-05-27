export type MicrotaskScheduler = (callback: () => void) => void;

export function queuePromoTokensLoad(load: () => Promise<void> | void, schedule: MicrotaskScheduler = queueMicrotask): void {
  schedule(() => {
    void load();
  });
}
