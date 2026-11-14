# 🎤 Mimic Voice Party

Онлайн-игра в реальном времени для компании до **10 игроков** по ссылке в браузере.

## Ключевые особенности
- **Онлайн-мультиплеер без БД и платных хранилищ**: запись голоса (`audio/webm;codecs=opus`) передаётся через `Socket.io` в оперативной памяти (RAM) сервера с автоочисткой после каждого раунда.
- **10 уникальных 2D SVG-персонажей**: при входе в комнату каждому игроку без повторов выдаётся стилизованный герой (Лис, Кибер-Бот, Жаба, Кот, Марсианин, Панда, Сова, Дино, Гризли-DJ, Осьминог).
- **Интерактивная концертная сцена**: прожекторы, живая idle-анимация, выход выступающего в центр под луч софита и синхронизация открытия рта персонажа с громкостью голоса через `AnalyserNode` (плюс тряска экрана при громких криках!).
- **Рекордер с наложением дорожек (Waveform Overlay)**: на HTML5 Canvas рисуется волна оригинала, а поверх в реальном времени ложится слой живого голоса игрока — как караоке по таймингу и громкости.
- **Математический анализатор схожести (Web Audio API)**: 0% рандома — сравнение `AudioBuffer` через `OfflineAudioContext` по 3 метрикам (огибающая громкости RMS, длительность/VAD-тайминг, динамика тона/ZCR).
- **Свой пак мемов**: добавляйте любые MP3, WAV, OGG, M4A, MP4, WebM до 15 секунд (аудио из видео извлекается автоматически и синхронизируется со всеми игроками в комнате).

---

## Локальный запуск

```bash
npm run install:all
npm run dev
```
- Фронтенд: `http://localhost:5173`
- Бэкенд: `http://localhost:3001`

---

## 🚀 Бесплатный деплой на GitHub + Render.com + Vercel за 5 минут

### Шаг 1. Залить проект на GitHub
1. Создайте новый репозиторий на GitHub (например, `mimic-voice-party`).
2. Выполните в папке `d:\Voice_Game`:
   ```bash
   git init
   git add .
   git commit -m "Initial Mimic Voice Party"
   git branch -M main
   git remote add origin https://github.com/<ВАШ_ЛОГИН>/mimic-voice-party.git
   git push -u origin main
   ```

### Шаг 2. Развернуть Бэкенд на Render.com (Free Tier)
1. Зайдите на [render.com](https://render.com) → **New +** → **Web Service**.
2. Подключите ваш GitHub-репозиторий `mimic-voice-party`.
   *(Или используйте встроенный [render.yaml](render.yaml) через **New + → Blueprint**).*
3. При ручной настройке укажите:
   - **Root Directory**: `server`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`
   - **Environment Variables**: `CORS_ORIGIN=*` (позже можно заменить на точный URL Vercel)
4. Нажмите **Create Web Service** и скопируйте выданный адрес (например, `https://mimic-voice-party-server.onrender.com`).

### Шаг 3. Развернуть Фронтенд на Vercel (Free Tier)
1. Зайдите на [vercel.com](https://vercel.com) → **Add New… → Project** и выберите репозиторий `mimic-voice-party`.
2. Настройте параметры:
   - **Root Directory**: `client`
   - **Framework Preset**: `Vite`
   - **Environment Variables**:
     - `VITE_SERVER_URL` = `https://mimic-voice-party-server.onrender.com` (без `/` в конце!)
3. Нажмите **Deploy**. Готово — ссылка на игру работает по HTTPS для всех друзей с ПК и смартфонов!
