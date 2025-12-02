import * as dotenv from 'dotenv';
import { VendistaApi } from './vendistaApi';
import { TelegramBotService } from './telegramBot';
import { CsvLogger } from './csvLogger';
import { TerminalStatus, TerminalStateHistory } from './types';
import { formatMoscowTime } from './utils/timeUtils';

// Загрузка переменных окружения
dotenv.config();

// Проверка обязательных переменных окружения
const requiredEnvVars = [
  'VENDISTA_LOGIN',
  'VENDISTA_PASSWORD',
  'TELEGRAM_TOKEN',
  'TELEGRAM_GROUP_ID',
  'TERMINAL_IDS',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Ошибка: переменная окружения ${envVar} не установлена`);
    process.exit(1);
  }
}

const vendistaLogin = process.env.VENDISTA_LOGIN!;
const vendistaPassword = process.env.VENDISTA_PASSWORD!;
const telegramToken = process.env.TELEGRAM_TOKEN!;
const telegramGroupId = process.env.TELEGRAM_GROUP_ID!;
const terminalIds = process.env.TERMINAL_IDS!.split(',').map(id => parseInt(id.trim(), 10));

// Инициализация сервисов
const vendistaApi = new VendistaApi(vendistaLogin, vendistaPassword);
const csvLogger = new CsvLogger();
const telegramBot = new TelegramBotService(telegramToken, telegramGroupId, csvLogger, vendistaApi);

// Хранение истории статусов терминалов
const terminalHistory: Map<number, TerminalStateHistory> = new Map();

// Флаг первой проверки после запуска (чтобы не записывать ложные изменения при перезапуске)
let isFirstCheck = true;

// Инициализация истории для каждого терминала
terminalIds.forEach(id => {
  terminalHistory.set(id, {
    terminalId: id,
    currentStatus: TerminalStatus.ONLINE,
    lastStatusChange: null,
    previousStatus: null,
    offlineSince: null,
  });
});

/**
 * Проверка статуса терминала и обработка изменений
 */
async function checkTerminalStatus(terminalId: number): Promise<void> {
  try {
    const currentStatus = await vendistaApi.getTerminalStatus(terminalId);
    const history = terminalHistory.get(terminalId);

    if (!history) {
      console.error(`История для терминала ${terminalId} не найдена`);
      return;
    }

    // Если статус изменился
    if (history.currentStatus !== currentStatus) {
      const previousStatus = history.currentStatus;
      const now = new Date();

      // Определяем, вернулся ли терминал на связь или ушел со связи
      const wasOffline = previousStatus === TerminalStatus.OFFLINE || 
                        previousStatus === TerminalStatus.INACTIVE ||
                        previousStatus === TerminalStatus.NO_POWER ||
                        previousStatus === TerminalStatus.ERROR;
      
      const isNowOffline = currentStatus === TerminalStatus.OFFLINE || 
                          currentStatus === TerminalStatus.INACTIVE ||
                          currentStatus === TerminalStatus.NO_POWER ||
                          currentStatus === TerminalStatus.ERROR;
      
      const isNowOnline = currentStatus === TerminalStatus.ONLINE;
      const isBackOnline = wasOffline && isNowOnline;
      const isGoneOffline = previousStatus === TerminalStatus.ONLINE && isNowOffline;

      // Вычисляем длительность отсутствия на связи, если терминал вернулся
      let offlineDuration: string | undefined;
      if (isBackOnline && history.offlineSince) {
        const durationMs = now.getTime() - history.offlineSince.getTime();
        offlineDuration = formatDuration(durationMs);
      }

      // Обновляем историю
      history.previousStatus = previousStatus;
      history.currentStatus = currentStatus;
      history.lastStatusChange = now;
      
      // Если терминал ушел со связи (с ONLINE на не ONLINE), сохраняем время
      if (isGoneOffline) {
        history.offlineSince = now;
      } else if (isBackOnline) {
        // Если вернулся на связь, сбрасываем время ухода
        history.offlineSince = null;
      } else if (isNowOffline && !history.offlineSince) {
        // Если терминал уже был офлайн, но offlineSince не установлен (например, при первом запуске),
        // устанавливаем текущее время как время ухода
        history.offlineSince = now;
      }
      // Если терминал меняет один офлайн статус на другой, не обновляем offlineSince

      // При первой проверке после запуска не записываем изменения в CSV и не отправляем уведомления,
      // так как мы не знаем, когда реально произошло изменение (приложение могло быть закрыто)
      if (!isFirstCheck) {
        // Записываем в CSV только если это не первая проверка
        await csvLogger.logStatusChange({
          terminalId,
          timestamp: now,
          status: currentStatus,
          statusName: CsvLogger.getStatusName(currentStatus),
          offlineDuration,
        });

        // Отправляем уведомление в Telegram, если терминал ушел со связи или вернулся
        if (isGoneOffline || isBackOnline) {
          await telegramBot.sendStatusChangeNotification(
            terminalId,
            previousStatus,
            currentStatus,
            isBackOnline
          );
        }

        const moscowTime = formatMoscowTime(now);
        console.log(
          `[${moscowTime} МСК] Терминал ${terminalId}: статус изменился с ${CsvLogger.getStatusName(previousStatus)} на ${CsvLogger.getStatusName(currentStatus)}${offlineDuration ? `, не был на связи: ${offlineDuration}` : ''}`
        );
      } else {
        // При первой проверке просто синхронизируем состояние без записи в CSV
        const moscowTime = formatMoscowTime(now);
        console.log(
          `[${moscowTime} МСК] Терминал ${terminalId}: синхронизация состояния при запуске - текущий статус: ${CsvLogger.getStatusName(currentStatus)}`
        );
      }
    } else {
      const moscowTime = formatMoscowTime(new Date());
      console.log(`[${moscowTime} МСК] Терминал ${terminalId}: статус не изменился (${CsvLogger.getStatusName(currentStatus)})`);
    }
  } catch (error) {
    const moscowTime = formatMoscowTime(new Date());
    console.error(`[${moscowTime} МСК] Ошибка проверки статуса терминала ${terminalId}:`, error);
  }
}

/**
 * Форматирование длительности в читаемый формат
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const parts: string[] = [];
  
  if (days > 0) {
    parts.push(`${days}д`);
  }
  if (hours > 0) {
    parts.push(`${hours % 24}ч`);
  }
  if (minutes > 0) {
    parts.push(`${minutes % 60}м`);
  }
  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds % 60}с`);
  }

  return parts.join(' ');
}

/**
 * Проверка всех терминалов
 */
async function checkAllTerminals(): Promise<void> {
  const moscowTime = formatMoscowTime(new Date());
  const checkType = isFirstCheck ? ' (первая проверка после запуска)' : '';
  console.log(`\n[${moscowTime} МСК] Проверка статусов терминалов${checkType}...`);
  
  const promises = terminalIds.map(id => checkTerminalStatus(id));
  await Promise.all(promises);
  
  // После первой проверки сбрасываем флаг
  if (isFirstCheck) {
    isFirstCheck = false;
    const syncTime = formatMoscowTime(new Date());
    console.log(`[${syncTime} МСК] Синхронизация завершена. Мониторинг изменений активен.`);
  }
}

/**
 * Инициализация и запуск мониторинга
 */
async function startMonitoring(): Promise<void> {
  const startTime = formatMoscowTime(new Date());
  console.log(`[${startTime} МСК] Запуск мониторинга терминалов Vendista...`);
  console.log(`[${startTime} МСК] Мониторинг терминалов: ${terminalIds.join(', ')}`);

  // Первоначальная авторизация
  try {
    await vendistaApi.authenticate();
    const authTime = formatMoscowTime(new Date());
    console.log(`[${authTime} МСК] Авторизация в Vendista API успешна`);
  } catch (error) {
    const errorTime = formatMoscowTime(new Date());
    console.error(`[${errorTime} МСК] Ошибка авторизации:`, error);
    process.exit(1);
  }

  // Первоначальная проверка статусов
  await checkAllTerminals();

  // Запуск периодической проверки каждую минуту
  setInterval(checkAllTerminals, 60 * 1000);

  const readyTime = formatMoscowTime(new Date());
  console.log(`[${readyTime} МСК] Мониторинг запущен. Проверка статусов каждую минуту.`);
}

// Обработка ошибок
process.on('unhandledRejection', (error) => {
  const errorTime = formatMoscowTime(new Date());
  console.error(`[${errorTime} МСК] Необработанная ошибка:`, error);
});

process.on('SIGINT', () => {
  const exitTime = formatMoscowTime(new Date());
  console.log(`\n[${exitTime} МСК] Завершение работы...`);
  process.exit(0);
});

// Запуск приложения
startMonitoring().catch(error => {
  const errorTime = formatMoscowTime(new Date());
  console.error(`[${errorTime} МСК] Критическая ошибка при запуске:`, error);
  process.exit(1);
});

