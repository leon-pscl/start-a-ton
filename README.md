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
