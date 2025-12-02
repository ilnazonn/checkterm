/**
 * Утилиты для работы с московским временем (UTC+3)
 */

const MOSCOW_TIMEZONE_OFFSET_HOURS = 3; // UTC+3

/**
 * Получение компонентов времени в московском часовом поясе (UTC+3)
 */
function getMoscowTimeComponents(date: Date = new Date()) {
  // Получаем UTC время
  const utcTime = date.getTime() + (date.getTimezoneOffset() * 60 * 1000);
  // Добавляем смещение для Москвы (UTC+3)
  const moscowTime = new Date(utcTime + (MOSCOW_TIMEZONE_OFFSET_HOURS * 60 * 60 * 1000));
  
  return {
    year: moscowTime.getUTCFullYear(),
    month: moscowTime.getUTCMonth(),
    day: moscowTime.getUTCDate(),
    hours: moscowTime.getUTCHours(),
    minutes: moscowTime.getUTCMinutes(),
    seconds: moscowTime.getUTCSeconds(),
  };
}

/**
 * Форматирование даты в строку в московском времени (UTC+3)
 * Формат: YYYY-MM-DD HH:mm:ss
 */
export function formatMoscowTime(date: Date): string {
  const components = getMoscowTimeComponents(date);
  const year = components.year;
  const month = String(components.month + 1).padStart(2, '0');
  const day = String(components.day).padStart(2, '0');
  const hours = String(components.hours).padStart(2, '0');
  const minutes = String(components.minutes).padStart(2, '0');
  const seconds = String(components.seconds).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Форматирование даты в ISO строку в московском времени (UTC+3)
 * Формат: YYYY-MM-DDTHH:mm:ss+03:00
 */
export function formatMoscowTimeISO(date: Date): string {
  const components = getMoscowTimeComponents(date);
  const year = components.year;
  const month = String(components.month + 1).padStart(2, '0');
  const day = String(components.day).padStart(2, '0');
  const hours = String(components.hours).padStart(2, '0');
  const minutes = String(components.minutes).padStart(2, '0');
  const seconds = String(components.seconds).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+03:00`;
}

