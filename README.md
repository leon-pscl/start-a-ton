# start-a-ton

So far, this is built to be run locally.

## Backend

Open a terminal and run the following:
```bash
cd star-system/backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Frontend

Open a **new terminal** and run:
```bash
cd star-system/frontend
npm install
npm run dev
```

You should be given a local URL after that (e.g. `http://localhost:5173`).

star-system/backend/seed.py creates star.db in the same folder and adds mock data. So if you deleted the mock data and want to try again, just delete star.db at all and start over, I guess.