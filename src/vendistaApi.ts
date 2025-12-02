import axios, { AxiosInstance } from 'axios';
import { VendistaTokenResponse, TerminalResponse, TerminalStatus } from './types';

export class VendistaApi {
  private apiClient: AxiosInstance;
  private token: string | null = null;
  private login: string;
  private password: string;

  constructor(login: string, password: string) {
    this.login = login;
    this.password = password;
    this.apiClient = axios.create({
      baseURL: 'https://api.vendista.ru:99',
      timeout: 10000,
    });
  }

  /**
   * Авторизация в API и получение токена
   */
  async authenticate(): Promise<string> {
    try {
      const response = await this.apiClient.get<VendistaTokenResponse>('/token', {
        params: {
          login: this.login,
          password: this.password,
        },
      });

      this.token = response.data.token;
      return this.token;
    } catch (error) {
      console.error('Ошибка авторизации в Vendista API:', error);
      throw new Error('Не удалось авторизоваться в Vendista API');
    }
  }

  /**
   * Получение информации о терминале
   */
  async getTerminalStatus(terminalId: number): Promise<TerminalStatus> {
    if (!this.token) {
      await this.authenticate();
    }

    try {
      const response = await this.apiClient.get<TerminalResponse>(
        `/terminals/${terminalId}`,
        {
          params: {
            token: this.token,
          },
        }
      );

      if (!response.data.success) {
        throw new Error('Не удалось получить статус терминала');
      }

      return response.data.item.state as TerminalStatus;
    } catch (error: any) {
      // Если ошибка авторизации, пробуем переавторизоваться
      if (error.response?.status === 401 || error.response?.status === 403) {
        await this.authenticate();
        return this.getTerminalStatus(terminalId);
      }

      console.error(`Ошибка получения статуса терминала ${terminalId}:`, error);
      throw error;
    }
  }

  /**
   * Получение полной информации о терминале
   */
  async getTerminalInfo(terminalId: number): Promise<TerminalResponse['item']> {
    if (!this.token) {
      await this.authenticate();
    }

    try {
      const response = await this.apiClient.get<TerminalResponse>(
        `/terminals/${terminalId}`,
        {
          params: {
            token: this.token,
          },
        }
      );

      if (!response.data.success) {
        throw new Error('Не удалось получить информацию о терминале');
      }

      return response.data.item;
    } catch (error: any) {
      // Если ошибка авторизации, пробуем переавторизоваться
      if (error.response?.status === 401 || error.response?.status === 403) {
        await this.authenticate();
        return this.getTerminalInfo(terminalId);
      }

      console.error(`Ошибка получения информации о терминале ${terminalId}:`, error);
      throw error;
    }
  }
}

