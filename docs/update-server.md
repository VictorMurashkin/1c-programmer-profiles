# Как выложить сайт и обновлять его с GitHub

IIS не хранит страницы приложения. В папке сайта IIS лежит только `web.config`: он пересылает запросы программе Node. Файлы сайта — в `C:\apps\programming-profiles`. Их читает служба `ProfilesNext`. Скрипт обновляет эту папку. Папку IIS он не копирует.

Пока служба остановлена, сайт не открывается. Сборка занимает несколько минут.

Пароли и база обычным обновлением не затираются: `.env.local` и `data` в GitHub не входят. `npm run db:seed` на живой базе не запускать.

## 1. Поставить Git и забрать репозиторий

Скрипт обновления запускается только из папки, в которой есть `.git`, и только если в PowerShell находится команда `git`. Ручная копия файлов без Git для следующих обновлений не подходит: скрипт сразу выходит и службу не останавливает.

Node.js 24 к этому моменту уже должен стоять. Если нет — [docs/deploy-iis.md](deploy-iis.md), шаг 1. PowerShell каждый раз открывать заново после установки программы и всегда от имени администратора.

### Поставить Git

1. Скачать установщик [Git для Windows](https://git-scm.com/download/win) и запустить его на сервере.
2. В мастере оставить вариант, при котором Git попадает в командную строку. Отдельные инструменты вроде Git Bash для обновления не нужны.
3. Дождаться окончания, закрыть старое окно PowerShell и открыть новое от администратора.
4. Проверить:

```powershell
git --version
```

Должна напечататься версия. Если команда `git` не находится, установщик не добавил Git в PATH или открыто окно, которое было запущено до установки.

### Если папки приложения ещё нет

```powershell
cd C:\apps
git clone https://github.com/firstBitSportivnaya/1c-programmer-profiles.git programming-profiles
cd C:\apps\programming-profiles
git status
```

`git status` должен показать ветку `main` и чистую папку. Дальше — раздел 2 этой инструкции: пароли, сборка, служба и сайт IIS.

Если GitHub просит войти, нужен вход учётной записи, которой разрешено читать репозиторий.

### Если приложение уже стоит копией, без Git

Папку службы не затирать поверх. Служба `ProfilesNext` ждёт путь `C:\apps\programming-profiles`. Секреты и база лежат в этой папке и в GitHub их нет: перед заменой папки их надо унести в сторону.

1. Поставить Git, как выше, и убедиться, что `git --version` печатает версию.
2. Остановить службу, чтобы она не писала базу во время копирования:

```powershell
Stop-Service ProfilesNext
```

3. Унести пароли и базу из папки приложения:

```powershell
New-Item -ItemType Directory -Force -Path C:\apps\programming-profiles-keep
Copy-Item C:\apps\programming-profiles\.env.local C:\apps\programming-profiles-keep\.env.local
Copy-Item C:\apps\programming-profiles\data C:\apps\programming-profiles-keep\data -Recurse
```

4. Освободить путь, который уже прописан в службе, и клонировать репозиторий на это же место:

```powershell
Rename-Item C:\apps\programming-profiles C:\apps\programming-profiles-old
cd C:\apps
git clone https://github.com/firstBitSportivnaya/1c-programmer-profiles.git programming-profiles
cd C:\apps\programming-profiles
git status
```

Ветка должна быть `main`.

5. Вернуть пароли и базу. Папки `data` в клоне ещё нет: её создаёт копирование.

```powershell
New-Item -ItemType Directory -Force -Path C:\apps\programming-profiles\data
Copy-Item C:\apps\programming-profiles-keep\.env.local C:\apps\programming-profiles\.env.local
Copy-Item C:\apps\programming-profiles-keep\data\* C:\apps\programming-profiles\data\ -Force
```

Если рядом с базой были `profiles.sqlite-wal` и `profiles.sqlite-shm`, они приедут вместе с папкой `data`.

6. Собрать клон и запустить службу:

```powershell
cd C:\apps\programming-profiles
npm ci
npm run build
Start-Service ProfilesNext
```

7. Подождать около полминуты. Сайт должен открыться, вход логином сотрудника — пройти. `git status` не должен показывать `.env.local` и файл базы: они в git не входят.

8. Папку `C:\apps\programming-profiles-old` удалить только после этой проверки. `C:\apps\programming-profiles-keep` тоже можно удалить после проверки: там копия учёток и хэшей паролей, её не публиковать и в git не класть.

Дальше файлы на сервер руками не копировать. Обновления — раздел 4.

## 2. Опубликовать

Первый запуск — по [docs/deploy-iis.md](deploy-iis.md), шаги 5–12. Коротко, что должно получиться:

1. В `C:\apps\programming-profiles` создать `.env.local` с паролями сервера.
2. В этой же папке выполнить `npm ci` и `npm run build`.
3. Служба `ProfilesNext` запускает `node.exe` с аргументами `node_modules\next\dist\bin\next start --hostname 127.0.0.1`. Каталог запуска — `C:\apps\programming-profiles`.
4. Сайт IIS на свободном порту смотрит в пустую папку с одним `web.config` и проксирует на `http://127.0.0.1:3000`.

Проверка: сайт открывается по IP и порту, вход логином сотрудника проходит.

## 3. Дождаться изменений в GitHub

Правки делают на своём компьютере и отправляют в GitHub. Пока коммита нет в `main`, на сервере обновлять нечего.

## 4. Запустить скрипт обновления

На сервере, в PowerShell от имени администратора:

```powershell
powershell -ExecutionPolicy Bypass -File C:\apps\programming-profiles\scripts\update-server.ps1
```

Чтобы вместе с кодом перезаписать компетенции и профили из `seed/data.json`, добавить ключ `-SyncCatalog`. Сотрудники, планы и задания остаются. Если компетенцию убрали из исходников, а на хосте на неё ещё есть задание, строка плана или личная пометка, шаг отменяется и сайт остаётся на прежней версии.

```powershell
powershell -ExecutionPolicy Bypass -File C:\apps\programming-profiles\scripts\update-server.ps1 -SyncCatalog
```

Каталог должен быть на ветке `main`. Иначе скрипт выходит сразу и службу не останавливает.

Скрипт сам делает следующее.

1. Останавливает службу `ProfilesNext`.
2. Снимает копию `data\profiles.sqlite` командой `npm run db:snapshot` в `C:\apps\programming-profiles-backups` (параметр `-BackupDir`). Имя файла: `profiles-<дата-время>-<коммит>.sqlite`. Копия лежит вне папки приложения и вне сайта IIS. Если копию снять нельзя, служба запускается снова и обновление прерывается.
3. Забирает `origin/main` (`git pull --ff-only`). Если менялись `package.json` или `package-lock.json` — `npm ci`.
4. Запускает `npm run check:upgrade` на копии из шага 2. Проверка пишет во временный файл и исходную копию не меняет. В конце успешная строка: `upgrade ok`.
5. Собирает сайт (`npm run build`) и запускает службу. В конце печатает путь к копии.

Без ключа `-SyncCatalog` рабочую базу скрипт не меняет. С ключом после успешной сборки он перезаписывает компетенции и профили из `seed/data.json`. Новые таблицы появятся при первом открытии страницы.

Если `git pull`, `npm ci`, `check:upgrade` или сборка падают, скрипт возвращает код на коммит до обновления (`git reset --hard`). Когда менялись библиотеки или сборка новой версии уже началась, он ставит библиотеки старой версии и собирает её заново, затем запускает службу. Сообщение называет упавший шаг и путь к копии. Сайт остаётся на старой версии.

Если откат сам не удался, служба остаётся выключенной. В том же окне будет, что выполнить вручную: `git reset --hard` на напечатанный коммит, `npm ci`, `npm run build`, `Start-Service ProfilesNext`.

Старые копии скрипт не удаляет. В копии есть учётки и хэши паролей: папку копий не публиковать и не класть в git.

Восстановление базы из копии — вручную, пока служба остановлена. Подставить файл вместо `data\profiles.sqlite` и удалить рядом файлы `profiles.sqlite-wal` и `profiles.sqlite-shm`, если они есть. Затем запустить службу. `scripts/upgrade-base.ts` на рабочей базе не запускать: он добавляет администратора с паролем из репозитория.

Журнал службы — `C:\apps\programming-profiles\logs\node-err.log`. IIS перенастраивать не нужно. После успешного обновления подождать около полминуты и обновить страницу через Ctrl+F5.
