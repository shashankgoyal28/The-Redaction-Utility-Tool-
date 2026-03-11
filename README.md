📄 PII Redaction Tool

A full-stack application for detecting and redacting Personally Identifiable Information (PII) from text, PDF, and images.
Built with React + TypeScript, FastAPI, and Python-based PDF/Text processing tools.

⸻

🚀 Features

🔍 PII Detection

Detects the following using regex-based rules:
	•	📧 Emails
	•	📱 Phone Numbers
	•	🧑 Names
	•	🏠 Addresses

⸻

🖥️ Two Operating Modes

1️⃣ Text Mode

Paste any text directly.

Choose redaction style:
	•	Typed labels → [EMAIL_1]
	•	Black boxes → ██████
	•	Custom labels → [REDACTED]

Output includes:
	•	Original text
	•	Redacted text
	•	Redaction Summary

⸻

2️⃣ PDF Mode

Upload:
	•	PDFs
	•	JPEGs
	•	PNGs

Backend:
	1.	Extracts text
	2.	Detects PII
	3.	Redacts using PyMuPDF

PDFs always use solid black-box redaction (industry standard & legally safe).

Output:
	•	Downloadable redacted PDF

⸻

🧠 How It Works (Architecture Overview)

Frontend (React + TypeScript)

Handles:
	•	User interaction
	•	File uploads
	•	Text input
	•	Redaction options
	•	Results preview
	•	Downloading the final PDF

Key components:

InputPage.tsx
ResultsPage.tsx
FileUploader.tsx
api/redact.ts

Backend (FastAPI)

API Routes

Endpoint              | Description
POST /api/redact-text | Redacts raw text
POST /api/redact-file | Redacts uploaded file
GET /api/download/{filename} | Download redacted PDF

Responsibilities:
	•	Text extraction
	•	PII detection
	•	Text redaction
	•	PDF redaction
	•	File storage
	•	Cleanup

Core Python Modules

Module | Purpose  
pdf_extractor.py | Extract text from PDFs/images  
pii_detector.py | Regex detection of EMAIL/PHONE/NAME/ADDRESS
redactor.py | Generates redacted text 
PyMuPDF | Draws black boxes on PDFs

End-to-End Workflow

Text Mode
	1.	User enters text
	2.	Selects redaction options
	3.	Frontend sends request → /api/redact-text

Backend:
	1.	Detects PII
	2.	Applies redaction
	3.	Returns:
original_text
redacted_text
summary

Frontend displays results.

PDF Mode
	1.	User uploads PDF/image
	2.	Frontend sends file → /api/redact-file

Backend:
	1.	Saves file
	2.	Extracts text
	3.	Detects PII
	4.	Applies redaction
	5.	Draws black boxes on PDF
	6.	Saves final PDF

Frontend receives:

summary
download_url

User downloads final redacted PDF.

🛠️ Tech Stack

Frontend
	•	React (Vite)
	•	TypeScript
	•	React Router
	•	HTML/CSS

Backend
	•	FastAPI
	•	Python 3.10+
	•	PyMuPDF
	•	pdfplumber
	•	Pillow
	•	pytesseract
	•	Uvicorn

Database
	•	PostgreSQL
	•	SQLAlchemy (logging redaction history)

⸻

📂 Project Structure

PII_Project/
│
├── pii-redaction-backend/
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   ├── routers/redact.py
│   ├── modules/
│   │   ├── pdf_extractor.py
│   │   ├── pii_detector.py
│   │   ├── redactor.py
│   ├── redacted_pdfs/
│   ├── requirements.txt
│   └── venv/
│
└── pii-redaction-ui/
    ├── src/pages/InputPage.tsx
    ├── src/pages/ResultsPage.tsx
    ├── src/components/FileUploader.tsx
    ├── src/api/redact.ts
    ├── public/
    └── package.json

Running the Project Locally

Below is the complete step-by-step process to run the project locally.

Database Setup (PostgreSQL)
Start PostgreSQL

Mac (Homebrew):

brew services start postgresql
Create Database
createdb pii_redaction_db
Access Database
psql -U shashankgoyal -d pii_redaction_db
Inside PostgreSQL:
Show Tables
\dt
Show Logs
SELECT * FROM redaction_logs;
\q
Backend Setup
Go to backend folder:
cd pii-redaction-backend
Create virtual environment:
python3 -m venv venv
Activate environment:
Mac/Linux
source venv/bin/activate
Windows
venv\Scripts\activate
Install dependencies:
pip install -r requirements.txt
Run backend server:
uvicorn main:app --reload
Backend runs on:
http://127.0.0.1:8000

Swagger API Docs:
http://127.0.0.1:8000/docs

Frontend Setup
Go to frontend folder:
cd ../pii-redaction-ui

Install dependencies:
npm install

Run frontend:
npm run dev

Frontend runs on:
http://localhost:5173

🧪 Example Output
Text Before
Contact John Doe at john@example.com or 9876543210

Redacted (Typed)
Contact [NAME_1] at [EMAIL_1] or [PHONE_1]

Redacted (Blackbox)
Contact ██████ at ██████ or ███████

🔒 Security Notes
	•	Redactions are burned into the PDF
	•	Hidden data cannot be recovered
	•	Custom labels are not written into PDFs
	•	File system access is restricted

⸻

📝 Future Improvements
	•	ML-based PII detection
	•	Better OCR alignment
	•	Preview redaction mode
	•	Multi-language PII detection
	•	Highlight redaction option

⸻

🧑‍💻 Author

Shashank Goyal
Full-Stack Developer | Python | React | Embedded Systems

📞 +91 8107787245

Currently working on improving the local deployment setup and preparing the system for production hosting.
