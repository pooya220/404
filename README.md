# GameNet Plus Manager

مدیریت‌گر باشگاه گیم با React/Vite، سرور Express و MySQL موجود در WAMP.

## اجرای محلی با WAMP و Node.js

پیش‌نیازها:

- Node.js نسخه 20 یا جدیدتر
- WAMP با سرویس MySQL روشن (Apache برای اجرای این نسخه لازم نیست)

1. در WAMP، سرویس MySQL را Start کنید. پورت پیش‌فرض `3306` است.
2. این پوشه را در PowerShell باز کنید و وابستگی‌ها را نصب کنید:

   ```powershell
   npm install
   ```

3. فایل `.env.example` را با نام `.env` کپی کنید. برای WAMP پیش‌فرض، این مقادیر کافی است:

   ```env
   MYSQL_ENABLED=true
   MYSQL_HOST=127.0.0.1
   MYSQL_PORT=3306
   MYSQL_DATABASE=game_net_club
   MYSQL_USER=root
   MYSQL_PASSWORD=
   ```

4. برنامه را اجرا کنید:

   ```powershell
   npm run dev
   ```

5. مرورگر را روی [http://localhost:3000](http://localhost:3000) باز کنید.

سرور در اولین اتصال، دیتابیس `game_net_club` و تمام جدول‌های لازم را خودکار می‌سازد. اگر ترجیح می‌دهید از phpMyAdmin استفاده کنید، فایل [wamp-schema.sql](./wamp-schema.sql) را Import کنید.

## حالت Production

```powershell
npm run build
npm start
```

برای تغییر پورت، مقدار `PORT` را در `.env` تغییر دهید. فایل `.mysql_config.json` فقط تنظیمات ذخیره‌شده از بخش تنظیمات برنامه است و عمداً در Git نادیده گرفته می‌شود.

## اجرای خودکار بعد از روشن‌شدن ویندوز

برای نصب اجرای خودکار، یک‌بار فایل [launcher/install-autostart.cmd](./launcher/install-autostart.cmd) را اجرا کنید. از دفعهٔ بعد، بعد از ورود به ویندوز، WAMP/MySQL و Node به‌صورت خودکار بررسی و برنامه اجرا می‌شوند. گزارش اجرا در `logs/launcher.log` و خطاهای Node در `logs/server-error.log` ذخیره می‌شود.

برای حذف اجرای خودکار، فایل [launcher/uninstall-autostart.cmd](./launcher/uninstall-autostart.cmd) را اجرا کنید.

## آپدیت برنامه

فایل نسخهٔ جدید را داخل پوشهٔ [update](./update) قرار دهید و نام آن را اعلام کنید. قبل از آپدیت از دیتابیس `game_net_club` در phpMyAdmin خروجی بگیرید. پوشهٔ update راهنمای کامل نگهداری `.env` و تنظیمات اتصال را دارد.

## ورود اولیه

در نسخه فعلی حساب محلی اولیه `admin` با رمز `1234` است. بعد از ورود، از بخش تنظیمات کاربر مدیر و رمز را تغییر دهید. این برنامه برای استفاده روی شبکه داخلی طراحی شده و نباید بدون افزودن احراز هویت سمت سرور مستقیماً روی اینترنت قرار بگیرد.
