<p align="center">
<img width="600" alt="Screenshot 2023-10-13 at 19 41 35" src="https://github.com/kubk/memo-card/assets/22447849/7f754776-3e57-4669-becc-410e1b285199"></p>

<p align="center">
  Available in: <a href="./README.md">English</a>, <a href="./README.ru.md">Русский</a>, <a href="./README.ua.md">Українська</a>
</p>

Люди мають звичку забувати. Протягом лише години до 60% нової інформації може загубитися, і до кінця тижня залишиться лише близько 10%. Проте регулярне повернення до інформації допомагає протистояти цьому спаду. Цей бот використовує перевірений метод карток, допомагаючи користувачам зберігати та вивчати мови, історію та багато іншого.

Запустіть бота: [https://t.me/memo_card_bot](https://t.me/memo_card_bot)

Хабр: https://teletype.in/@alteregor/memocard-telegram-contest-win

## Приклади використання
- Ви турист у новій країні і хочете вивчити основи іноземної мови.
- Ви розробник і хочете краще запам'ятовувати складні команди bash або конструкції програмування.
- Ви студент медичного коледжу і прагнете запам'ятати всі латинські назви м'язів.
- Ви хочете покращити свої знання з географії, намагаючись запам'ятати країни, столиці, великі міста, гори, річки та інші географічні факти.
- Ви вивчаєте музику і хочете вправлятися в гармонії.
- Ви вивчаєте історію і хочете пам'ятати ключові історичні факти.
- Ви вчитель англійської мови і хочете поділитися своїми колодами зі своїми студентами.

## Як це відрізняється від інших додатків

Хоча є безкоштовні додатки, такі як Anki, вони мають обмеження платформи та недоліки у функціях:
- Anki не пропонує способу особисто ділитися колодами з друзями або колегами, не враховуючи функцію загально доступних колод. Більше того, щоб ділитися колодою потрібно перемикатися між настільною та веб-версіями Anki. З ботом Memo Card користувачі можуть без зусиль ділитися колодами прямо в Telegram.
- Для додаткового функціоналу в Anki користувачам потрібно встановлювати плагіни, які обмежені лише настільною версією. Натомість бот Memo Card доступний на Mac, Windows, iOS, Android та веб-версіях Telegram.
- В Anki немає автоматичних пуш-сповіщень, щоб повідомити користувачів про майбутні огляди. Це можна легко вирішити за допомогою пуш-сповіщень в Telegram.

## Для розробників

Цей проект складається з двох додатків: фронтенду та бекенду, обидва з яких написані на TypeScript. Бекенд створений за допомогою Cloudflare functions.

### Чому Cloudflare

Cloudflare Pages - це хороший вибір для створення Telegram Mini App.
- Доменні імена для фронтенду та бекенду з активованим SSL.
- Автоматичний CI/CD; простий `git push` розгортає як фронтенд, так і бекенд.
- 100,000 безкоштовних запитів на день.
- [UI лог](https://developers.cloudflare.com/pages/platform/functions/debugging-and-logging/) для кожної функції.

### Локальний запуск
- Отримайте свій API-ключ від [BotFather](https://core.telegram.org/bots/tutorial)
- Встановіть залежності за допомогою `npm i`
- Скопіюйте API-файл оточення: `cp .dev.vars.example .dev.vars`. Цей файл використовується робочими процесами Cloudflare для локальної розробки. Ви можете дізнатися більше про це [тут](https://developers.cloudflare.com/workers/configuration/environment-variables/).
- Оновіть змінну оточення `BOT_TOKEN`, щоб відповідати вашому API-ключу.
- Запустіть функції Cloudflare з `npm run dev:api:start`
- Запустіть фронтенд-проект з `npm run dev:frontend:start`
- Щоб відкрити ваш фронтенд та API для Інтернету та забезпечити SSL, ви можете використовувати [ngrok](https://ngrok.com). Після реєстрації ви отримаєте 1 безкоштовний стабільний домен. Отримайте його [тут](https://dashboard.ngrok.com/cloud-edge/domains) та запустіть `ngrok http --domain=<your_domain>.ngrok-free.app 5173`
- Скажіть BotFather оновити налаштування: перейдіть до налаштувань бота -> Кнопка меню -> Редагувати URL кнопки меню та введіть отриманий раніше домен.

Після завершення цих кроків достатньо запустити `npm run dev:api:start`, `npm run dev:frontend:start` та `ngrok`, щоб запустити локальну версію бота.

### Розгортання
Для розгортання достатньо запушити змiни за допомогою `git push`, якщо ви підключите свій репозиторій до панелі Cloudflare. Перейдіть до [Панелі Cloudflare](https://dash.cloudflare.com/) -> Workers & Pages -> Overview -> виберіть вкладку Pages -> натисніть Connect to Git.

На панелі Cloudflare додайте змінні оточення `BOT_TOKEN`, `SUPABASE_KEY` та `SUPABASE_URL`.

### База даних
Проект використовує [Supabase](https://supabase.com/) як основне сховище даних. Це хмарна реляційна база даних з інтерфейсом та JavaScript-клієнтом для спілкування за допомогою API. Всередині використовується PostgreSQL, отже, ви можете використовувати всі його можливості.

Процес налаштування бази даних:
- Реєстрація на [supabase.com](https://supabase.com/dashboard/projects), додавання проекту
- Скопіюйте `SUPABASE_KEY` та `SUPABASE_URL` з налаштувань проекту
- Для локальної розробки вставте `SUPABASE_KEY` та `SUPABASE_URL` в `.dev.vars`
- Для продакшну вставте ці змінні оточення у панель Cloudflare.
- Щоб ознайомитися з supabase, рекомендується прочитати [офіційний посібник](https://supabase.com/docs/guides/database/overview).

### Перевірка Telegram

Дані, отримані через Mini App, [повинні бути перевірені](https://core.telegram.org/bots/webapps#testing-mini-apps) для запобігання несанкціонованому доступу.
У цьому ботi реалізація базується на [Web Crypto API](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/). Робочі процеси Cloudflare працюють у унікальному оточенні, яке не є браузером, але й не є традиційним серверним середовищем, таким як Node.js. Вони працюють на мережі Cloudflare, і їхнє виконавче середовище нагадує робоче середовище веб-браузера Service Worker. Ось чому ми повинні використовувати Web Crypto API для перевірки даних, отриманих через Mini App. У цьому ботi дані користувача [передаються через заголовки HTTP](https://github.com/kubk/memo-card/blob/main/src/lib/request/request.ts#L17) та [перевіряються](https://github.com/kubk/memo-card/blob/main/functions/lib/telegram/validate-telegram-request.ts#L26) на кожний запит API.

### Telegram webhook

Щоб бот відповідав на повідомлення користувачів у чаті, налаштуйте веб-гак:

- Dev: `curl "https://api.telegram.org/bot<DEV_BOT_TOKEN>/setWebhook?url=<ngrok_domain>/api/bot?token=DEV_BOT_TOKEN"`
- Prod: `curl "https://api.telegram.org/bot<PROD_BOT_TOKEN>/setWebhook?url=<prod_domain>/bot?token=PROD_BOT_TOKEN"`
 
Зверніть увагу, що для продакшну використовується `/bot?token=`, тоді як для розробки - `/api/bot?token=` який працює через проксі-сервер, налаштований для розробки за допомогою конфігурації Vite.
