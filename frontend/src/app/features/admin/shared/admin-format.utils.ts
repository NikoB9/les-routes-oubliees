const BYTE_UNITS = ['o', 'Kio', 'Mio', 'Gio'];

export function formatFileSize(sizeBytes: number): string {
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0) {
    return 'Taille inconnue';
  }
  let value = sizeBytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const digits = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(digits)} ${BYTE_UNITS[unitIndex]}`;
}

export function toLocalDateTimeInput(value: string | null, timezone: string): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const parts = dateTimeParts(date, timezone);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function toOffsetDateTime(value: string | null, timezone: string): string | null {
  if (!value) {
    return null;
  }
  const match = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})T(?<hour>\d{2}):(?<minute>\d{2})$/.exec(value);
  if (!match?.groups) {
    return value;
  }
  const localUtc = Date.UTC(
    Number(match.groups['year']),
    Number(match.groups['month']) - 1,
    Number(match.groups['day']),
    Number(match.groups['hour']),
    Number(match.groups['minute']),
  );
  const firstOffset = timezoneOffsetMinutes(new Date(localUtc), timezone);
  const actualInstant = new Date(localUtc - firstOffset * 60_000);
  const offset = timezoneOffsetMinutes(actualInstant, timezone);
  return `${value}:00${formatOffset(offset)}`;
}

function timezoneOffsetMinutes(date: Date, timezone: string): number {
  const parts = dateTimeParts(date, timezone);
  const zonedUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((zonedUtc - date.getTime()) / 60_000);
}

function dateTimeParts(
  date: Date,
  timezone: string,
): Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', string> {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  return Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  ) as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', string>;
}

function formatOffset(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absolute = Math.abs(offsetMinutes);
  const hours = Math.floor(absolute / 60);
  const minutes = absolute % 60;
  return `${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}
