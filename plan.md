1) Статусы терминалов:
        0 => self::ONLINE,
        1 => self::OFFLINE,
        2 => self::INACTIVE,
        3 => self::NO_POWER,
        4 => self::ERROR


2)        Авторизация в апи: GET https://api.vendista.ru:99/token?login=login&password=password
        В ответе получаем token, который будем использовать для последующих запросов. Ответ апи:
        {
    "token": "токен",
    "user_id": 17606
}

3) Запрос получения информации по терминалам: https://api.vendista.ru:99//terminals/{id}?token={{token}}
Ответ:
{
    "item": {
        "bank_id": null,
        "tid": null,
        "mid": null,
        "processing_id": 0,
        "reserve_tid_id": null,
        "serial_number": "123412521306239",
        "version": 8807,
        "fw_type": 0,
        "gsm_operator": "*MegaFo",
        "gsm_rssi": 26,
        "imei": 869310064930368,
        "partner_id": 8,
        "partner_name": null,
        "main_owner_id": null,
        "external_server_id": null,
        "last_online_time": "2025-06-30 17:26:38.247",
        "last24_hours_online": 0,
        "last_hour_online": 0,
        "sber_qrid": "",
        "auto_cancel_timeout": 0,
        "bonus_percent": null,
        "bonus_transactions": true,
        "qr_discount_percent": 0.0,
        "send_cash": false,
        "send_cashless": false,
        "type": 117,
        "sim_balance": 0,
        "sim_number": 79992651168,
        "sim_text": "Megafone",
        "paid_sim": true,
        "bootloader_version": 9,
        "success_message": null,
        "success_message_timeout": 0,
        "machine_id": 0,
        "ping": 0,
        "disable_firmware_updates": false,
        "kassa_id": null,
        "generate_eva_dts_report": false,
        "min_pay_server": 6,
        "offline_payment_max": 0,
        "hid": 1100000021102000000,
        "comment": "",
        "owner_id": 237,
        "owner_name": null,
        "longitude": 49.142216,
        "latitude": 55.767895,
        "color": "#f2d675",
        "state": 3,
        "id": 64157
    },
    "success": true
}
4) Задаем токен телеграмма, группу, логин и пароль вендисты в енв.
5) Логировать изменение статуса и записывать в csv.


Задача:
У нас имеются два терминала, нам нужно каждую минуту делать запрос на проверку статуса https://api.vendista.ru:99//terminals/{id}?token={{token}}
Из ответа брать только состояние state. Записывать состояние state, если оно поменялось, то также записывать это время. Суть такая, что нам нужно понимать как часто терминалы уходят со связи и через какое время они возвращаются.
Информация о том, что терминал ушел со связи или вернулся на связь должна поступать в ТГ бот,  т.е у нас есть группа и в нее добавлен бот, который пишет туда.
Также должно быть две команды на проверку текущего статуса терминала и на выгрузку файла csv куда записываются состояния терминалов и сколько они не были на связи.
Используемый язык typescript.