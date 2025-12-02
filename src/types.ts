export enum TerminalStatus {
  ONLINE = 0,
  OFFLINE = 1,
  INACTIVE = 2,
  NO_POWER = 3,
  ERROR = 4
}

export interface VendistaTokenResponse {
  token: string;
  user_id: number;
}

export interface TerminalItem {
  id: number;
  state: TerminalStatus;
  serial_number: string;
  last_online_time: string;
  [key: string]: any;
}

export interface TerminalResponse {
  item: TerminalItem;
  success: boolean;
}

export interface TerminalStateRecord {
  terminalId: number;
  timestamp: Date;
  status: TerminalStatus;
  statusName: string;
  offlineDuration?: string; // Длительность отсутствия на связи в читаемом формате (например, "2h 30m 15s")
}

export interface TerminalStateHistory {
  terminalId: number;
  currentStatus: TerminalStatus;
  lastStatusChange: Date | null;
  previousStatus: TerminalStatus | null;
  offlineSince: Date | null; // Время, когда терминал ушел со связи
}

