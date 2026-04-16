# Autodesk (Frontend + Backend)

A visual automation tool built with **React Flow (frontend)** and **FastAPI (backend)**.

------

# Requirements

Make sure the following are installed:

## Frontend

- Node.js (>= 16, recommended 18+)
- npm (comes with Node.js)

## Backend

- Python (>= 3.9)
- pip

------

#  Installation

## 1. Clone the Repository

```bash
git clone <your-repo-url>
cd <your-project-folder>
```

------

## 2. Setup Backend (FastAPI)

Navigate to backend folder:

```bash
cd backend
```

### Create virtual environment (recommended)

```bash
python -m venv venv
```

### Activate virtual environment

**Mac / Linux**

```bash
source venv/bin/activate
```

**Windows**

```bash
venv\Scripts\activate
```

### Install dependencies

```bash
pip install -r requirements.txt
```

If you don’t have a `requirements.txt`, use:

```txt
fastapi
uvicorn[standard]
pydantic
pyautogui
python-multipart
```

------

## 3. Run Backend

```bash
uvicorn main:app --reload
```

Backend will run at:

```
http://127.0.0.1:8000
```

------

## 4. Setup Frontend

Open a new terminal and go to frontend folder:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

------

## 5. Run Frontend

```bash
npm run dev
```

or (if using Create React App):

```bash
npm start
```

Open in browser:

```
http://localhost:5173
```

------

# Backend Connection

The frontend sends requests to:

```
http://127.0.0.1:8000/run
```

Make sure the backend is running, otherwise the **Run** button will not work.

------

# Important Notes

## pyautogui

- Runs only on local machine (not suitable for servers)
- Requires system permissions (especially on macOS)

------

## CORS (Backend)

Ensure your backend includes:

```python
from fastapi.middleware.cors import CORSMiddleware
```

------

#  Troubleshooting

## Frontend cannot connect to backend

- Check backend is running
- Check port is `8000`

------

## pyautogui not working

- Ensure running locally
- Check system permissions

------

## Missing dependencies

```bash
pip install -r requirements.txt
npm install
```

------

#  Quick Start

```bash
# backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

# frontend (new terminal)
cd frontend
npm install
npm run dev
```

------

# You're Ready

Now you can:

- Build automation flows visually
- Click **Run**
- Execute automation on your machine 