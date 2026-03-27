export function formatChileanDate(date: Date): string {
  return new Intl.DateTimeFormat('es-CL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Santiago',
  }).format(date);
}

export function isClosingSoon(closingDate: Date, thresholdDays = 3): boolean {
  const now = new Date();
  const diffMs = closingDate.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays > 0 && diffDays <= thresholdDays;
}

export function parseFlexibleDate(input: string | Date | null | undefined): Date | undefined {
  if (!input) return undefined;
  if (input instanceof Date) return isNaN(input.getTime()) ? undefined : input;
  const parsed = new Date(input);
  return isNaN(parsed.getTime()) ? undefined : parsed;
}

export function toISOStringSafe(date: Date | null | undefined): string | undefined {
  if (!date) return undefined;
  try {
    return date.toISOString();
  } catch {
    return undefined;
  }
}
