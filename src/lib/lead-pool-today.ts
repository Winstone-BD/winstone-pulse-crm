/** Start of a Dhaka calendar day (UTC+6, no DST) as an ISO timestamp. */
export function dhakaDayStartIso(workDate: string): string {
  return new Date(`${workDate}T00:00:00+06:00`).toISOString();
}
