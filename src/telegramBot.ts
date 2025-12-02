import TelegramBot from 'node-telegram-bot-api';
import { TerminalStatus } from './types';
import { CsvLogger } from './csvLogger';
import { VendistaApi } from './vendistaApi';
import * as fs from 'fs';

export class TelegramBotService {
  private bot: TelegramBot;
  private groupId: string;
  private csvLogger: CsvLogger;
  private vendistaApi: VendistaApi;

  constructor(token: string, groupId: string, csvLogger: CsvLogger, vendistaApi: VendistaApi) {
    this.bot = new TelegramBot(token, { polling: true });
    this.groupId = groupId;
    this.csvLogger = csvLogger;
    this.vendistaApi = vendistaApi;
    this.setupCommands();
  }

  private setupCommands() {
    // Команда для проверки текущего статуса терминала
    this.bot.onText(/\/status (.+)/, async (msg, match) => {
      const terminalId = match?.[1];
      if (!terminalId) {
        this.bot.sendMessage(msg.chat.id, 'Использование: /status <terminal_id>');
        return;
      }

      try {
        const id = parseInt(terminalId, 10);
        if (isNaN(id)) {
          this.bot.sendMessage(msg.chat.id, 'Неверный ID терминала');
          return;
        }

        // Отправляем запрос на получение статуса
        await this.bot.sendMessage(msg.chat.id, `Проверяю статус терминала ${id}...`);
        
        // Получаем информацию о терминале
        const terminalInfo = await this.vendistaApi.getTerminalInfo(id);
        await this.sendTerminalStatus(msg.chat.id, id, terminalInfo.state, terminalInfo);
      } catch (error: any) {
        const errorMessage = error?.message || String(error);
        await this.bot.sendMessage(msg.chat.id, `Ошибка: ${errorMessage}`);
      }
    });

    // Команда для выгрузки CSV файла
    this.bot.onText(/\/csv/, async (msg) => {
      try {
        const csvPath = this.csvLogger.getCsvFilePath();
        
        if (!fs.existsSync(csvPath)) {
          this.bot.sendMessage(msg.chat.id, 'CSV файл не найден');
          return;
        }

        await this.bot.sendDocument(msg.chat.id, csvPath, {
          caption: 'Лог статусов терминалов',
        });
      } catch (error) {
        console.error('Ошибка отправки CSV файла:', error);
        this.bot.sendMessage(msg.chat.id, `Ошибка отправки файла: ${error}`);
      }
    });

    // Команда помощи
    this.bot.onText(/\/help/, (msg) => {
      const helpText = `
Доступные команды:
/status <terminal_id> - Проверить текущий статус терминала
/csv - Получить CSV файл с логом статусов
/help - Показать эту справку
      `;
      this.bot.sendMessage(msg.chat.id, helpText);
    });
  }

  /**
   * Отправка уведомления в группу о изменении статуса терминала
   */
  async sendStatusChangeNotification(
    terminalId: number,
    oldStatus: TerminalStatus | null,
    newStatus: TerminalStatus,
    isBackOnline: boolean
  ): Promise<void> {
    const statusName = CsvLogger.getStatusName(newStatus);
    const oldStatusName = oldStatus !== null ? CsvLogger.getStatusName(oldStatus) : 'неизвестен';

    let message: string;
    if (isBackOnline) {
      message = `✅ Терминал ${terminalId} вернулся на связь!\nСтатус: ${statusName} (было: ${oldStatusName})`;
    } else {
      message = `⚠️ Терминал ${terminalId} ушел со связи!\nСтатус: ${statusName} (было: ${oldStatusName})`;
    }

    try {
      await this.bot.sendMessage(this.groupId, message);
      console.log(`Отправлено уведомление в Telegram: ${message}`);
    } catch (error) {
      console.error('Ошибка отправки уведомления в Telegram:', error);
    }
  }

  /**
   * Отправка сообщения о текущем статусе терминала
   */
  async sendTerminalStatus(chatId: number, terminalId: number, status: TerminalStatus, terminalInfo?: any): Promise<void> {
    const statusName = CsvLogger.getStatusName(status);
    let message = `Терминал ${terminalId}\nСтатус: ${statusName} (${status})`;

    if (terminalInfo) {
      message += `\nСерийный номер: ${terminalInfo.serial_number || 'N/A'}`;
      message += `\nПоследний онлайн: ${terminalInfo.last_online_time || 'N/A'}`;
    }

    try {
      await this.bot.sendMessage(chatId, message);
    } catch (error) {
      console.error('Ошибка отправки статуса терминала:', error);
    }
  }

}

