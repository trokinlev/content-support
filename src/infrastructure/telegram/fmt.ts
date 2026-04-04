export function formatDate(date: Date): string {
  const formatter = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Moscow",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  let day = "";
  let month = "";
  let hour = "";
  let minute = "";

  for (const part of parts) {
    switch (part.type) {
      case "day":
        day = part.value;
        break;
      case "month":
        month = part.value;
        break;
      case "hour":
        hour = part.value;
        break;
      case "minute":
        minute = part.value;
        break;
    }
  }
  day = parseInt(day).toString();
  return `${day} ${month} в ${hour}:${minute} МСК`;
}

export function parseDateTime(dateStr: string): Date | null {
  const regex = /^(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})$/;
  const match = dateStr.match(regex);

  if (!match) {
    return null;
  }

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const hours = parseInt(match[3], 10);
  const minutes = parseInt(match[4], 10);

  const now = new Date();
  let year = now.getFullYear();

  const parsedDate = new Date(year, month, day, hours, minutes);

  // Если дата уже прошла в этом году, берём следующий год
  if (parsedDate < now) {
    parsedDate.setFullYear(year + 1);
  }

  return parsedDate;
}