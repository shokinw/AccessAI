
# AccessAI — Assistive Agent for the Visually Impaired

AccessAI is a mobile-friendly AI-assisted application designed to help users access information through image-based text extraction, scene descriptions, and voice interaction.

## Features

- **Read Text:** Extract text from images using OCR and listen to the result.
- **Describe a Scene:** Request a description of a selected image.
- **Live Camera:** Capture a photo and use the existing text-reading or scene-description functions.
- **Voice Assistant:** Interact with supported voice commands.
- **Mobile-friendly interface:** Designed for use on mobile and desktop browsers.

## Tech Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Python, FastAPI
- API communication: HTTP/REST
- Accessibility: Speech synthesis, supported browser speech recognition, keyboard-friendly controls
- Deployment: Planned static frontend hosting and cloud backend hosting

## Project Structure

```text
AccessAI/
├── frontend/
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   ├── app-navigation.js
│   ├── manifest.json
│   ├── sw.js
│   └── icons/
└── backend/
    ├── main.py
    ├── requirements.txt
    └── services/
```

## Run Locally

### 1. Clone the repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd AccessAI
```

### 2. Create and activate a virtual environment

Windows PowerShell:

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

### 3. Install backend dependencies

```powershell
pip install -r backend/requirements.txt
```

### 4. Start the backend

```powershell
cd backend
uvicorn main:app --reload
```

The API documentation should be available at:

`http://127.0.0.1:8000/docs`

### 5. Open the frontend

Serve the `frontend` directory using VS Code Live Server or another local static web server.

Configure the frontend API URL to point to your running backend.

## Accessibility and Safety

AI-generated descriptions and extracted text may be incomplete or incorrect. AccessAI is an assistive information tool, not a certified navigation or obstacle-avoidance system.

## Project Status

The core frontend and backend features are under development and testing. Public cloud deployment and cross-device verification are planned.

## Contributions

Suggestions, bug reports, and improvements are welcome.
