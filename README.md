# Мониторинг терминалов Vendista

Приложение для мониторинга статусов терминалов Vendista с уведомлениями в Telegram и логированием в CSV.

## Функциональность

- Автоматическая проверка статусов терминалов каждую минуту
- Отправка уведомлений в Telegram при изменении статуса (уход/возврат на связь)
- Логирование всех изменений статусов в CSV файл
- Команды Telegram бота:
  - `/status <terminal_id>` - проверка текущего статуса терминала
  - `/csv` - получение CSV файла с логом статусов
  - `/help` - справка по командам

## Установка

1. Установите зависимости:
```bash
npm install
```

2. Создайте файл `.env` в корне проекта со следующим содержимым:
```
VENDISTA_LOGIN=your_login
VENDISTA_PASSWORD=your_password
TELEGRAM_TOKEN=your_telegram_bot_token
TELEGRAM_GROUP_ID=your_telegram_group_id
TERMINAL_IDS=64157,64158
```

## Настройка Telegram бота

1. Создайте бота через [@BotFather](https://t.me/BotFather) в Telegram
2. Получите токен бота
3. Добавьте бота в группу
4. Получите ID группы (можно использовать бота [@userinfobot](https://t.me/userinfobot) или другие способы)
5. Укажите токен и ID группы в `.env` файле

## Запуск

### Режим разработки (с hot-reload):
```bash
npm run dev
```

### Продакшн режим:
```bash
npm run build
npm start
```

## Статусы терминалов

- `0` - ONLINE (онлайн)
- `1` - OFFLINE (офлайн)
- `2` - INACTIVE (неактивен)
- `3` - NO_POWER (нет питания)
- `4` - ERROR (ошибка)

## CSV файл

Все изменения статусов записываются в файл `terminal_status_log.csv` со следующими колонками:
- Terminal ID - ID терминала
- Timestamp - Время изменения статуса
- Status Code - Код статуса (0-4)
- Status Name - Название статуса (ONLINE, OFFLINE, и т.д.)
- Offline Duration - Длительность отсутствия на связи (заполняется только при возврате терминала на связь, формат: "2д 3ч 15м 30с")

## Структура проекта

```
src/
  ├── index.ts          # Основной файл приложения
  ├── types.ts          # TypeScript типы и интерфейсы
  ├── vendistaApi.ts    # Модуль для работы с Vendista API
  ├── telegramBot.ts    # Модуль для работы с Telegram ботом
  └── csvLogger.ts      # Модуль для логирования в CSV
```

# checkterm
