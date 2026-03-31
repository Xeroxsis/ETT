# Smart Study Planner — Local Setup Guide

## Prerequisites
Make sure the following are installed on your machine:

| Tool | Version | Download |
|------|---------|----------|
| Node.js | v18 or higher | https://nodejs.org |
| Python | 3.10 or higher | https://python.org |
| MongoDB | 6.0 or higher | https://www.mongodb.com/try/download/community |

---

## Step 1 — Clone / Download the project

Download your project from Emergent (Save to GitHub or Download ZIP) and unzip it.

```
your-project/
├── backend/
├── frontend/
└── README.md
```

---

## Step 2 — Start MongoDB

Make sure MongoDB is running locally on the default port **27017**.

**Mac (Homebrew):**
```bash
brew services start mongodb-community
```

**Windows:**
MongoDB runs as a service automatically after install. Or start manually:
```bash
"C:\Program Files\MongoDB\Server\6.0\bin\mongod.exe"
```

**Linux:**
```bash
sudo systemctl start mongod
```

---

## Step 3 — Backend Setup

```bash
cd backend
```

Create a virtual environment (recommended):
```bash
python -m venv venv

# Mac/Linux:
source venv/bin/activate

# Windows:
venv\Scripts\activate
```

Install dependencies:
```bash
pip install -r requirements.txt
pip install emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/
```

Create/update `backend/.env` with these values:
```env
MONGO_URL="mongodb://localhost:27017"
DB_NAME="smartplanner_db"
JWT_SECRET="your-random-64-char-secret-key-here"
ADMIN_EMAIL="admin@smartplanner.com"
ADMIN_PASSWORD="admin123"
EMERGENT_LLM_KEY="sk-emergent-d5572F57787Ae57Fd5"
FRONTEND_URL="http://localhost:3000"
```

Start the backend:
```bash
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

Backend will be running at: **http://localhost:8001**

---

## Step 4 — Frontend Setup

Open a **new terminal tab/window**:

```bash
cd frontend
```

Update `frontend/.env`:
```env
REACT_APP_BACKEND_URL=http://localhost:8001
WDS_SOCKET_PORT=3000
```

Install dependencies (`.npmrc` handles peer dep conflicts automatically):
```bash
npm install
```

Start the frontend:
```bash
npm start
```

Frontend opens at: **http://localhost:3000**

---

## Step 5 — Login

Once both are running, open **http://localhost:3000** and log in:

| Role  | Email                    | Password |
|-------|--------------------------|----------|
| Admin | admin@smartplanner.com   | admin123 |
| User  | Register a new account   | any      |

---

## Troubleshooting

**`npm install` fails with ERESOLVE**
The `.npmrc` file already sets `legacy-peer-deps=true`. If still failing:
```bash
npm install --legacy-peer-deps
```

**`emergentintegrations` not found**
```bash
pip install emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/
```

**MongoDB connection refused**
```bash
mongosh   # should connect — if not, start mongod first
```

**CORS errors in browser**
Set `FRONTEND_URL=http://localhost:3000` in `backend/.env` and restart backend.

---

## API Docs (once backend is running)
- Swagger UI: http://localhost:8001/docs
- ReDoc: http://localhost:8001/redoc
