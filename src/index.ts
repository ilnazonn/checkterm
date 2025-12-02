import * as dotenv from 'dotenv';
import { VendistaApi } from './vendistaApi';
import { TelegramBotService } from './telegramBot';
import { CsvLogger } from './csvLogger';
import { TerminalStatus, TerminalStateHistory } from './types';

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

      // Записываем в CSV
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

      console.log(
        `Терминал ${terminalId}: статус изменился с ${CsvLogger.getStatusName(previousStatus)} на ${CsvLogger.getStatusName(currentStatus)}${offlineDuration ? `, не был на связи: ${offlineDuration}` : ''}`
      );
    } else {
      console.log(`Терминал ${terminalId}: статус не изменился (${CsvLogger.getStatusName(currentStatus)})`);
    }
  } catch (error) {
    console.error(`Ошибка проверки статуса терминала ${terminalId}:`, error);
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
  console.log(`\n[${new Date().toISOString()}] Проверка статусов терминалов...`);
  
  const promises = terminalIds.map(id => checkTerminalStatus(id));
  await Promise.all(promises);
}

/**
 * Инициализация и запуск мониторинга
 */
async function startMonitoring(): Promise<void> {
  console.log('Запуск мониторинга терминалов Vendista...');
  console.log(`Мониторинг терминалов: ${terminalIds.join(', ')}`);

  // Первоначальная авторизация
  try {
    await vendistaApi.authenticate();
    console.log('Авторизация в Vendista API успешна');
  } catch (error) {
    console.error('Ошибка авторизации:', error);
    process.exit(1);
  }

  // Первоначальная проверка статусов
  await checkAllTerminals();

  // Запуск периодической проверки каждую минуту
  setInterval(checkAllTerminals, 60 * 1000);

  console.log('Мониторинг запущен. Проверка статусов каждую минуту.');
}

// Обработка ошибок
process.on('unhandledRejection', (error) => {
  console.error('Необработанная ошибка:', error);
});

process.on('SIGINT', () => {
  console.log('\nЗавершение работы...');
  process.exit(0);
});

// Запуск приложения
startMonitoring().catch(error => {
  console.error('Критическая ошибка при запуске:', error);
  process.exit(1);
});

