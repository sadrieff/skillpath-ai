# Разработка

Работа шла волнами. Исполнители Haiku получали задание со ссылкой на `ARCHITECTURE.md`, список файлов, которые можно менять, и требование реально запустить тесты или сборку.

| Волна | Исполнитель | Что сделал | Результат проверки у исполнителя |
|---|---|---|---|
| 1 | backend-core | конфиг, БД, безопасность, схемы, Alembic, сид (3 курса, 12 уроков, 4 теста), фикстуры | 9 тестов |
| 1 | frontend | Next.js, API-клиент, типы, дашборд, каталог, страница курса | typecheck, lint, build |
| 1 | devops | Dockerfile, docker-compose, CI, README | валидный YAML, Docker не запускался |
| 2 | routers-A | auth, курсы, уроки, тесты, дашборд | 111 тестов |
| 2 | routers-B | клиент RouterAI, ИИ-эндпоинты, админка, загрузка | 71 тест (вместе с core) |
| 2 | frontend-2 | страница урока, тест, панель ИИ-наставника, админка | typecheck, lint, build |
| 3 | landing | лендинг по скиллу design-taste-frontend | inspect.mjs: 0 FAIL, 1 WARN |
| 4 | app-design | токены, шрифт, route groups, доступность, аудит | typecheck, lint, build |

Дизайн: ui-ux-pro-max (правила UX), design-taste-frontend (лендинг), web-design-guidelines (аудит). Решения по дизайну записаны в `docs/design/DESIGN.md`.

Итого после ревью: 207 тестов backend, ruff без замечаний.
