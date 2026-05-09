# TeleVault v2

Unlimited cloud storage using Telegram as backend. Google Drive-like UI.

## Stack
- **Frontend**: React + Vite + Tailwind + Framer Motion → Netlify/Vercel
- **Backend**: FastAPI + Telethon + SQLite → Render/Koyeb
- **Storage**: Telegram (user's own account)

## Local Setup

### Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Fill .env with your values
python -m uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env
# Set VITE_API_URL=http://localhost:8000
npm run dev
```

## Deploy

### Backend → Render.com
1. Push repo to GitHub
2. Go to render.com → New Web Service → Connect repo
3. Root directory: `backend`
4. Build: `pip install -r requirements.txt`
5. Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
6. Add environment variables from `.env.example`
7. Copy the Render URL (e.g. `https://televault-backend.onrender.com`)

### Frontend → Netlify
1. Go to netlify.com → Add new site → Import from Git
2. Root directory: `frontend`
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Add environment variable: `VITE_API_URL=https://your-render-url.onrender.com`
6. Deploy!

## Environment Variables

### Backend (.env)
| Variable | Description |
|---|---|
| `TELEGRAM_API_ID` | From my.telegram.org |
| `TELEGRAM_API_HASH` | From my.telegram.org |
| `TELEGRAM_CHANNEL_ID` | Your private channel ID (-100...) |
| `JWT_SECRET` | Random 64-char string |
| `FRONTEND_URL` | Your Netlify URL |

### Frontend (.env)
| Variable | Description |
|---|---|
| `VITE_API_URL` | Your Render backend URL |
