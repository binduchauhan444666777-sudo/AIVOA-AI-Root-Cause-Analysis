# AIVOA – AI-Powered Root Cause Analysis & CAPA Management System

An AI-powered web application designed to streamline deviation investigation, Root Cause Analysis (RCA), and Corrective and Preventive Action (CAPA) management in pharmaceutical manufacturing.

## Overview

AIVOA is a full-stack application that assists users in investigating manufacturing deviations through AI-powered document extraction and structured root cause analysis.

The system helps organize investigation workflows, identify potential root causes, and generate corrective and preventive action suggestions.

It combines Artificial Intelligence, modern web technologies, and database management to simplify quality investigation processes.

## Key Features

- **Incident Management:** Capture and manage pharmaceutical manufacturing deviations.
- **AI-Powered Document Extraction:** Extract relevant information from uploaded investigation reports.
- **Root Cause Analysis:** Support structured investigations using the 5 Whys and Fishbone methodologies.
- **CAPA Management:** Generate corrective and preventive action suggestions.
- **AI-Assisted Investigation:** Use an AI-powered workflow to support investigation activities.
- **Investigation Repository:** Store and review investigation records.
- **Interactive User Interface:** Manage investigation workflows through a React-based frontend.

## Technology Stack

### Frontend
- React.js
- Vite
- Redux Toolkit
- JavaScript
- CSS

### Backend
- Python
- FastAPI
- SQLAlchemy

### Artificial Intelligence
- Groq API
- LangGraph
- LLM-based processing

### Database
- PostgreSQL

### Document Processing
- PyMuPDF

## Project Architecture

The application follows a frontend-backend architecture.

1. The React frontend provides the user interface.
2. The FastAPI backend handles application requests and business logic.
3. The AI service processes investigation information and supports root cause analysis.
4. LangGraph manages the AI workflow.
5. PostgreSQL provides database persistence when configured.

## Project Structure

```text
AIVOA_RCA_Project/
│
├── backend/
│   ├── app/
│   │   ├── ai_service.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── langgraph_workflow.py
│   │   ├── main.py
│   │   ├── models.py
│   │   └── schemas.py
│   │
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── redux/
│   │   ├── App.jsx
│   │   ├── App.module.css
│   │   ├── api.js
│   │   ├── global.css
│   │   └── main.jsx
│   │
│   ├── package.json
│   └── .env.example
│
├── .gitignore
└── README.md
```

## Installation and Setup

Follow these steps to run the project locally.

### Prerequisites

Make sure you have installed:

- Python 3.10 or later
- Node.js and npm
- Git
- Groq API key

PostgreSQL is required if you want database persistence.

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/AIVOA-Root-Cause-Analysis.git
```

Navigate into the project:

```bash
cd AIVOA-Root-Cause-Analysis
```

### 2. Backend Setup

Navigate to the backend directory:

```bash
cd backend
```

Create a virtual environment:

```bash
python -m venv venv
```

Activate it on Windows:

```bash
venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create a `.env` file by copying `.env.example`.

Configure your environment variables:

```env
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.3-70b-versatile
DATABASE_URL=your_postgresql_connection_string
```

If you are not configuring PostgreSQL, leave DATABASE_URL empty.

Start the backend server:

```bash
uvicorn app.main:app --reload
```

Backend API:

`http://localhost:8000`

API documentation:

`http://localhost:8000/docs`

### 3. Frontend Setup

Open another terminal and navigate to the frontend directory:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Create a `.env` file using `.env.example`.

Configure:

```env
VITE_API_URL=http://localhost:8000
```

Start the frontend:

```bash
npm run dev
```

Open the local URL provided by Vite, usually:

`http://localhost:5173`

## AI Workflow

AIVOA uses AI-assisted processing to support investigation activities.

The workflow incorporates:

- Incident information extraction
- Investigation analysis
- 5 Whys methodology
- Fishbone analysis
- Corrective and Preventive Action suggestions

## Future Improvements

Potential areas for future development include:

- User authentication and role-based access.
- Advanced investigation analytics.
- Investigation report generation and export.
- Improved investigation tracking.
- Enhanced dashboard and reporting capabilities.

## Security Notice

- Never upload API keys, passwords, or database credentials.
- Keep environment variables inside `.env` files.
- Use `.env.example` to document required configuration.
- Do not upload confidential pharmaceutical manufacturing records.

## Disclaimer

AIVOA is an AI-assisted project intended for demonstration and educational purposes. AI-generated investigation outputs and CAPA suggestions should be reviewed and validated by qualified personnel before practical use.

## Author

Developed as an internship project.

**Project:** AIVOA – Root Cause Analysis & CAPA Management System
