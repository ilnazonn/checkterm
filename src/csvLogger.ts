import * as fs from 'fs';
import * as path from 'path';
import { createObjectCsvWriter } from 'csv-writer';
import { TerminalStateRecord, TerminalStatus } from './types';
import { formatMoscowTime } from './utils/timeUtils';

export class CsvLogger {
  private csvFilePath: string;
  private csvWriter: any;

  constructor(csvFilePath: string = 'terminal_status_log.csv') {
    this.csvFilePath = csvFilePath;
    this.initializeCsvWriter();
  }

  private initializeCsvWriter() {
    // Проверяем, существует ли файл
    const fileExists = fs.existsSync(this.csvFilePath);

    this.csvWriter = createObjectCsvWriter({
      path: this.csvFilePath,
      header: [
        { id: 'terminalId', title: 'Terminal ID' },
        { id: 'timestamp', title: 'Timestamp' },
        { id: 'status', title: 'Status Code' },
        { id: 'statusName', title: 'Status Name' },
        { id: 'offlineDuration', title: 'Offline Duration' },
      ],
      append: fileExists,
    });
  }

  /**
   * Запись изменения статуса терминала в CSV
   */
  async logStatusChange(record: TerminalStateRecord): Promise<void> {
    try {
      const moscowTime = formatMoscowTime(record.timestamp);
      const logMessage = record.offlineDuration 
        ? `Записано в CSV: Терминал ${record.terminalId}, статус ${record.statusName} в ${moscowTime} (МСК), не был на связи: ${record.offlineDuration}`
        : `Записано в CSV: Терминал ${record.terminalId}, статус ${record.statusName} в ${moscowTime} (МСК)`;

      await this.csvWriter.writeRecords([{
        terminalId: record.terminalId,
        timestamp: moscowTime,
        status: record.status,
        statusName: record.statusName,
        offlineDuration: record.offlineDuration || '',
      }]);
      console.log(logMessage);
    } catch (error) {
      console.error('Ошибка записи в CSV:', error);
      throw error;
    }
  }

  /**
   * Получение пути к CSV файлу
   */
  getCsvFilePath(): string {
    return path.resolve(this.csvFilePath);
  }

  /**
   * Получение статуса терминала из названия
   */
  static getStatusName(status: TerminalStatus): string {
    const statusNames: Record<TerminalStatus, string> = {
      [TerminalStatus.ONLINE]: 'ONLINE',
      [TerminalStatus.OFFLINE]: 'OFFLINE',
      [TerminalStatus.INACTIVE]: 'INACTIVE',
      [TerminalStatus.NO_POWER]: 'NO_POWER',
      [TerminalStatus.ERROR]: 'ERROR',
    };
    return statusNames[status] || 'UNKNOWN';
  }
}

