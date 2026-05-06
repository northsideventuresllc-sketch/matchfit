/** Add whole business days (Mon–Fri) skipping weekends in UTC. */
export function addBusinessDaysUtc(start: Date, businessDays: number): Date {
  const d = new Date(start.getTime());
  let left = businessDays;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) left -= 1;
  }
  return d;
}
