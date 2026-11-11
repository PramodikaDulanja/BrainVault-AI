# BrainVault AI

> **Your Personal Enterprise-Grade Second Brain & Multi-Source Knowledge Assistant**

BrainVault AI is a full-stack, AI-powered knowledge management system designed to ingest, categorize, index, and retrieve information from multiple sources, including PDFs, Web URLs, and Images.

Built with a modern hybrid OCR and vector search pipeline, it allows you to chat directly with your personal knowledge base using advanced LLM reasoning.

---

## Key Features

- **Multi-Source Ingestion Pipeline**
  - **PDF Documents:** Two-tier processing with fast metadata extraction and deep hybrid OCR using `PyTesseract` and `Poppler`.
  - **Web Articles:** Automated live HTML scraping using `BeautifulSoup` and `Requests` to clean and index web content.
  - **Images & Diagrams:** Optical Character Recognition (OCR) to extract text and analyze visual assets.

- **Intelligent Auto-Categorization:** Leverages Groq LLMs to automatically assign primary categories, subcategories, and smart tags to all ingested files.

- **Vector Search & Storage:** Powered by the Qdrant vector database and HuggingFace embeddings (`BAAI/bge-small-en-v1.5`) for semantic similarity search.

- **Conversational AI Assistant:** Context-aware chat engine with token-limited memory buffers and multi-session tracking.

- **Professional Next.js Frontend:** A sleek, dark-mode dashboard featuring a persistent sidebar, live system statistics, a dedicated Knowledge Library browser, and a ChatGPT-style conversational workspace.

---

## Tech Stack

### Backend

- **Framework:** FastAPI (Python)
- **Relational Database:** PostgreSQL (Managed via SQLAlchemy)
- **Vector Database:** Qdrant
- **AI & LLM Inference:** Groq API, LlamaIndex
- **Processing & OCR:** PyTesseract, pdf2image, BeautifulSoup4, Requests

### Frontend

- **Framework:** Next.js (React / App Router)
- **Styling:** Tailwind CSS
- **Icons:** Lucide React

---

## Getting Started & Installation

### Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL installed and running locally
- Qdrant instance (Local or Cloud)
- Tesseract OCR and Poppler binaries installed on your system (for PDF/Image OCR)

### 1. Backend Setup (FastAPI & PostgreSQL)

Clone the repository and navigate to the backend directory:

```bash
git clone https://github.com/your-username/brainvault-ai.git
cd brainvault-ai/backend
```

Create and activate a virtual environment:

```bash
python -m venv venv
```

**On Windows:**

```bash
venv\Scripts\activate
```

**On macOS/Linux:**

```bash
source venv/bin/activate
```

Install dependencies:

```bash
pip install fastapi uvicorn sqlalchemy psycopg2-binary pydantic python-dotenv llama-index llama-index-llms-groq llama-index-vector-stores-qdrant llama-index-embeddings-huggingface qdrant-client pypdf pdf2image pytesseract requests beautifulsoup4 pillow
```

Create a `.env` file in the backend root and configure your environment variables:

```env
GROQ_API_KEY=your_groq_api_key_here
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/brainvault
QDRANT_HOST=localhost
QDRANT_PORT=6333
```

Start the FastAPI server:

```bash
uvicorn main:app --reload
```

The backend will run at [http://localhost:8000](http://localhost:8000).

### 2. Frontend Setup (Next.js)

Navigate to the frontend directory:

```bash
cd ../frontend
```

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to access the application.
