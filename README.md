- # FlowDesk

  **FlowDesk** is a visual desktop automation tool that allows you to build and run workflows by connecting nodes on a canvas.

  It combines a **React-based UI** with a **FastAPI backend** and executes automation directly on your local machine using PyAutoGUI.

  ------

  ## ✨ Features

  - 🧩 **Visual Workflow Builder**
     Create automation flows by dragging and connecting nodes
  - 🖱 **Desktop Automation**
     Automate mouse actions:
    - Image-based clicking
    - Coordinate clicking
    - Waiting / conditional waiting
    - Loop execution
  - 📡 **Real-time Execution Feedback**
     See which node is running and track loop progress live
  - ⚡ **Single EXE Runtime**
    - No need to install Python or Node.js
    - Automatically opens in your browser
    - Frontend and backend bundled together

  ------

  ## 🧱 Tech Stack

  ### Frontend

  - React
  - React Flow
  - Vite

  ### Backend

  - FastAPI
  - Uvicorn
  - Pydantic
  - PyAutoGUI

  ------

  ## 📂 Project Structure

  ```
  FlowDesk/
  ├── backend/
  │   └── backend.py
  ├── frontend/
  │   ├── src/
  │   └── dist/
  ```

  ------

  ## ⚙️ Development Setup

  ### 1. Clone the repository

  ```
  git clone https://github.com/NevinRock/FlowDesk.git
  cd FlowDesk
  ```

  ------

  ### 2. Backend setup

  ```
  cd backend
  python -m venv venv
  venv\Scripts\activate
  pip install -r requirements.txt
  ```

  Run backend:

  ```
  python backend.py
  ```

  ------

  ### 3. Frontend setup

  ```
  cd frontend
  npm install
  npm run dev
  ```

  ------

  ## 📦 Build EXE (Windows)

  ### 1. Build frontend

  ```
  cd frontend
  npm run build
  ```

  ------

  ### 2. Package with PyInstaller

  ```
  backend\venv\Scripts\python -m PyInstaller ^
    --clean --noconfirm --onefile ^
    --name FlowDesk ^
    backend\backend.py ^
    --add-data "frontend\dist;frontend_dist"
  ```

  ------

  ### 3. Run

  ```
  dist\FlowDesk.exe
  ```

  ------

  ## 🖥 How to Use

  1. Launch FlowDesk
  2. Create a workflow using nodes
  3. Click **Run**
  4. Watch the automation execute on your desktop

  ------

  ## ⚠️ Notes

  - Works only on local machines with a GUI
  - May require system permissions (especially on macOS)
  - Antivirus software may block automation behavior

  ------

  ## 🐞 Troubleshooting

  ### App does not open

  Check the terminal output and open the displayed URL manually.

  ------

  ### Run button does nothing

  - Make sure you're not using the Vite dev URL (`localhost:5173`)
  - Open the app from the backend address instead

  ------

  ### PyAutoGUI not working

  - Ensure you're running locally (not on a server)
  - Check system permissions

  ------

  ## 📌 .gitignore

  The following are ignored:

  - `venv/`
  - `dist/`
  - `build/`
  - `*.exe`
  - `*.spec`

  You need to build the EXE locally.

  ------

  ## 📄 License

  MIT