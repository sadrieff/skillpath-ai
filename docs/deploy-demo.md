# Демо-стенд на VPS

Публичная демо-версия SkillPath AI на одном сервере: Next.js, FastAPI, PostgreSQL и Caddy (HTTPS выдаётся автоматически), всё через Docker Compose. Стенд показывает курсы, уроки, тесты и ИИ-наставника. Данные демонстрационные, реальных пользователей и персональных данных здесь быть не должно.

Файлы: `deploy/docker-compose.demo.yml`, `deploy/Caddyfile`, `deploy/demo.env.example`, скрипты в `deploy/`.

## Какой сервер

- VPS в России, 2 ГБ RAM, 1-2 vCPU, 20 ГБ диска.
- Ubuntu 22.04 или 24.04 (Debian тоже подходит).
- Почему в России: RouterAI (сервис ИИ-наставника) российский и доступен с российского VPS напрямую, без обходов. Пользователи из России открывают стенд без задержек.
- Нужен доступ по SSH под root и открытые порты 80 и 443.

## Шаги

1. **Адрес.** Либо домен с A-записью на IP сервера, либо бесплатный `sslip.io`: для IP `203.0.113.10` адрес будет `203-0-113-10.sslip.io`.

2. **Подключиться** к серверу:

   ```bash
   ssh root@IP_СЕРВЕРА
   ```

3. **Склонировать репозиторий** и запустить настройку:

   ```bash
   git clone https://github.com/sadrieff/skillpath-ai.git /opt/skillpath-ai
   bash /opt/skillpath-ai/deploy/setup-server.sh
   ```

   При первом запуске скрипт ставит Docker, настраивает firewall (открыты только 22, 80, 443), создаёт `deploy/demo.env` из шаблона и останавливается.

4. **Заполнить `/opt/skillpath-ai/deploy/demo.env`.** Нужно заменить все `CHANGE_ME`:
   - `DEMO_HOST`, а также домен в `BACKEND_URL`, `FRONTEND_URL`, `CORS_ORIGINS` (без `/` в конце);
   - `JWT_SECRET`: сгенерировать командой `openssl rand -hex 32`;
   - `POSTGRES_PASSWORD` и тот же пароль в `DATABASE_URL`;
   - `ROUTERAI_API_KEY`: ключ RouterAI. Без него ИИ-наставник не работает.

5. **Запустить снова** тот же скрипт:

   ```bash
   bash /opt/skillpath-ai/deploy/setup-server.sh
   ```

   Скрипт собирает образы, поднимает контейнеры, применяет миграции и загружает демо-курсы. Повторный запуск безопасен.

6. **Проверить:**
   - `https://ВАШ_HOST/health` должен вернуть `{"status":"ok"}`;
   - `https://ВАШ_HOST/` открывает главную страницу;
   - `https://ВАШ_HOST/docs` открывает документацию API.

   Первый запуск может занять минуту: Caddy получает сертификат.

7. **Включить ночной сброс данных** (см. ниже).

## Демо-режим

- **Вход.** Кнопки «Войти как студент» и «Войти как админ» работают при `DEMO_MODE=1` (запрос `POST /api/auth/demo-login`). Вход через Google появляется на главной сам, как только заполнены `GOOGLE_CLIENT_ID` и `GOOGLE_CLIENT_SECRET`. `ENABLE_DEV_LOGIN` на стенде оставляйте `0`.
- **Лимиты ИИ.** `DEMO_AI_PER_USER=2`: два запроса к наставнику на одного посетителя (считаются и отказы модели). `AI_DAILY_LIMIT=300`: общий потолок на весь стенд в сутки. `DEMO_RATE_PER_HOUR=20`: сколько демо-входов в час с одного адреса.
- **Стоп-список.** Опасные темы и попытки сменить правила отсекаются до обращения к ИИ (`backend/app/services/ai_guard.py`).
- **Ночной сброс.** Каждую ночь данные возвращаются к исходному состоянию (`python -m app.demo_reset`, работает только при `DEMO_MODE=1`).
- **Загрузки.** Файлы до `MAX_UPLOAD_MB=2` МБ.

### Cron для ночного сброса

Сброс запускается в 04:00 по времени сервера. Сначала проверить часовой пояс: `timedatectl`. Если нужен московский, `timedatectl set-timezone Europe/Moscow`.

Добавить строку в crontab root (`crontab -e`):

```cron
0 4 * * * bash /opt/skillpath-ai/deploy/reset-demo.sh >> /var/log/skillpath-reset.log 2>&1
```

## Логи

Из папки `/opt/skillpath-ai`:

```bash
docker compose -f deploy/docker-compose.demo.yml --env-file deploy/demo.env logs -f api
```

Вместо `api` можно указать `web`, `caddy` или `db`. Лог сброса: `/var/log/skillpath-reset.log`.

## Обновление

```bash
bash /opt/skillpath-ai/deploy/update.sh
```

Скрипт делает `git pull`, пересобирает образы, применяет миграции и удаляет старые образы.

## Остановить и удалить

Все команды выполняются из `/opt/skillpath-ai`, с той же частью `docker compose -f deploy/docker-compose.demo.yml --env-file deploy/demo.env`:

- Остановить, данные сохранить: `... stop`
- Убрать контейнеры, данные в томах сохранить: `... down`
- Убрать всё вместе с базой, загрузками и сертификатами: `... down -v`
- Полностью удалить стенд: `... down -v`, затем удалить строку из crontab, затем `rm -rf /opt/skillpath-ai`. Образы можно убрать командой `docker image prune -a`.

## Чего не делать

- Не класть реальные ключи в репозиторий: ни в код, ни в `.env.example`, ни в коммиты и issues.
- Ключ RouterAI хранится только в `deploy/demo.env` на сервере. Файл добавлен в `.gitignore`. Перед коммитом убедиться, что `git status` его не показывает.
- Не публиковать порты PostgreSQL (5432) и API (8000). В compose они намеренно не открыты наружу, наружу идут только 80 и 443 через Caddy.
- Не оставлять пароли и `JWT_SECRET` из шаблона (`CHANGE_ME`).
- Не запускать `down -v` без необходимости: это удаляет базу.
- Не загружать на стенд реальные персональные данные: он публичный и демонстрационный.

## Стенд на общей ноде (https://demo.ciferkaservice.online:8443)

Так стенд запущен на самом деле. На ноде уже работают чужие сервисы, и 80 с 443 занимает Xray, поэтому схема другая:

- Образы `skillpath-api` и `skillpath-web` собирает GitHub Actions (`.github/workflows/demo-images.yml`) и кладёт в `ghcr.io`. Пакеты публичные. На ноде ничего не собирается.
- `deploy/docker-compose.node.yml`: db, api, web и свой Caddy на порту 8443. У каждого контейнера лимит памяти и процессора, чтобы стенд не мешал соседям. Сейчас он занимает около 135 МБ.
- Адрес фронта вшит в образ при сборке (`DEMO_URL` в workflow), поэтому при смене домена или порта образы нужно пересобрать.
- Автоматический HTTPS Caddy не работает на нестандартном порту, поэтому сертификат выпущен отдельно (`certbot`, проверка по DNS, запись `_acme-challenge.demo` на reg.ru) и лежит в `deploy/certs/` на ноде. Каталог в `.gitignore`.
- Данные сбрасываются ночью cron-ом: `deploy/reset-demo.sh` с `COMPOSE_FILE=deploy/docker-compose.node.yml`.

Обновление после нового коммита: дождаться зелёного `Demo images` в GitHub Actions, затем на ноде `bash ~/skillpath-demo/deploy/update-node.sh`.

### Продление сертификата

Сертификат Let's Encrypt действует 90 дней, автопродления нет. Продлевать за неделю-две до срока (первый истекает 2027-01-14):

1. На машине с certbot: `certbot certonly --manual --preferred-challenges dns -d demo.ciferkaservice.online`.
2. Certbot покажет значение TXT. Заменить на reg.ru запись `_acme-challenge.demo` и подтвердить.
3. Скопировать `fullchain.pem` и `privkey.pem` в `~/skillpath-demo/deploy/certs/` на ноде и выполнить `docker compose -f deploy/docker-compose.node.yml --env-file deploy/demo.env restart caddy`.

### Что делать, если стенд лёг

`docker compose -f deploy/docker-compose.node.yml --env-file deploy/demo.env ps` и `logs --tail 50 api`. Остановить полностью: `down` (данные базы сохранятся, `down -v` их удаляет).
