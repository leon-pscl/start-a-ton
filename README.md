# start-a-ton

So far, this is built to be run locally.

## Backend

Open a terminal and run the following line by line:
```bash
cd star-system/backend
python -m venv venv
venv\Scripts\Activate
python -m pip install -r requirements.txt
```

If you are using Command Prompt (`cmd.exe`), use:
```bash
venv\Scripts\activate.bat
```

If you are using Git Bash, use:
```bash
source venv/Scripts/activate
```

to initialize the database, and then fill it with mock data:
```bash
python seed.py
```

after all that, start the API server:
```bash
uvicorn main:app --reload --port 8000
```

If `python -m venv .venv` fails because a broken environment already exists, delete the old `.venv` folder first and run the commands again.

## Frontend

Open a **new terminal** and run:
```bash
cd star-system/frontend
npm install
npm run dev
```

You should be given a local URL after that (e.g. `http://localhost:5173`).

`star-system/backend/seed.py` creates `star.db` in the same folder and adds mock data. If you want a fresh database, delete `star.db` and run `python seed.py` again.

## Using Supabase (PostgreSQL)

You can point this backend to Supabase by setting `DATABASE_URL`.

1. Open Supabase -> Project Settings -> Database -> Connection string.
2. Copy the URI (do not copy the multiline breakdown fields).
3. In `star-system/backend/.env`, set:

```env
DATABASE_URL=postgresql+psycopg://YOUR_USER:YOUR_PASSWORD@YOUR_HOST:5432/postgres?sslmode=require
```

Notes:
- If Supabase gives `postgresql://...`, convert only the prefix to `postgresql+psycopg://...`.
- Keep `?sslmode=require`.
- If your password has special characters, URL-encode them.

Then run from `star-system/backend`:

```bash
python -m pip install -r requirements.txt
python seed.py
uvicorn main:app --reload --port 8000
```

How to verify seed data reached Supabase:

1. In Supabase SQL Editor, run:

```sql
select count(*) as teachers from teacher;
select count(*) as training_records from trainingrecord;
```

2. You should see non-zero counts after `python seed.py`.
