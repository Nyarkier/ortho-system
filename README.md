# Ortho System

A local appointment booking and check-in application with a React frontend and a FastAPI backend.

## What this repo contains

- `backend/main.py` — FastAPI backend serving a SQLite appointment database and the frontend build.
- `ortho-app/` — React + Vite frontend app.
- `requirements.txt` — Python dependencies for the backend.
- `package-lock.json` — frontend lock file for installed packages.

## Current status

This app is functional for local use, but it is not yet production-grade.

### Working features

- Create appointments
- Prevent duplicate bookings for the same date/time
- Simple patient check-in
- Export appointments to `appointments.xlsx`
- Frontend communicates with backend at `http://127.0.0.1:8000`

### Known gaps and issues

- `Admin.jsx` includes a DELETE button, but backend does not expose a DELETE `/appointments/{id}` endpoint.
- Frontend uses a hardcoded backend URL (`127.0.0.1:8000`). This is fine for local use but not robust for deployment.
- No authentication or access control.
- CORS is wide open (`allow_origins=['*']`). This is okay for local development but not secure for production.
- No validation beyond required fields and duplicate time checks.
- There is no packaged installer yet.

## Install and run locally

### Prerequisites

- Windows PC
- Python 3.14+ installed
- Node.js and npm installed

### Backend setup

1. Open a terminal in `d:\Projexts\ortho-system\backend`
2. Create and activate a virtual environment (optional but recommended):
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```
3. Install dependencies:
   ```powershell
   python -m pip install -r ..\requirements.txt
   ```
4. Run the backend:
   ```powershell
   python main.py
   ```

### Frontend setup

1. Open a terminal in `d:\Projexts\ortho-system\ortho-app`
2. Install Node dependencies:
   ```powershell
   npm install
   ```
3. Start development server:
   ```powershell
   npm run dev
   ```
4. In production, build the frontend and serve it from the backend:
   ```powershell
   npm run build
   ```

The backend is already configured to serve the generated frontend build from `ortho-app/dist` when that folder exists.

## Deploying to an isolated PC

### If the isolated PC has Wi-Fi and can access GitHub

1. Clone or download the repository from GitHub.
2. Install Python and Node.js on that PC.
3. Follow the backend and frontend setup steps above.

### If the isolated PC cannot access the internet

1. On a connected PC, clone or copy the repo files.
2. Build the frontend on the connected PC:
   ```powershell
   cd ortho-app
   npm install
   npm run build
   ```
3. Optionally package the backend into a standalone executable using PyInstaller:
   ```powershell
   cd ..\backend
   .venv\Scripts\pyinstaller --onefile main.py
   ```
4. Copy the built `dist` frontend folder and the backend executable to the isolated PC.
5. Run the executable on the isolated PC.

### Recommended isolated deployment path

- Build frontend once on a connected machine.
- Package the backend into a single executable.
- Transfer only the built assets to the offline machine.

### Build a portable Windows package

From the repository root, run one of these:

```powershell
./package.ps1
```

or

```cmd
package.cmd
```

That script will:

- install frontend dependencies if needed
- run `npm run build` in `ortho-app`
- package `backend/main.py` into a single executable with PyInstaller
- include the built frontend assets inside the executable
- place the output in `dist/package/OrthoSystem.exe`

Copy `dist/package/OrthoSystem.exe` to the isolated PC and run it directly.

## Suggested improvements before production

- Add a backend delete endpoint for admin appointment removal.
- Add environment-based backend URL configuration.
- Add authentication for admin access.
- Harden CORS and run on a specific trusted host.
- Add more form validation and error handling.
- Add a real installer or packaged distribution.

