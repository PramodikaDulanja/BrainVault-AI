from fastapi import FastAPI, UploadFile, File, Depends
from sqlalchemy.orm import Session
from dotenv import load_dotenv
import os
import shutil

from llama_index.llms.groq import Groq
import models
from database import engine, SessionLocal
import vector_db

# Create the database tables in PostgreSQL
models.Base.metadata.create_all(bind=engine)

load_dotenv()

app = FastAPI(title="BrainVault AI Backend")

# Initialize the Groq LLM
llm = Groq(model="openai/gpt-oss-20b", api_key=os.getenv("GROQ_API_KEY"))

# Dependency to get the PostgreSQL database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
def read_root():
    return {"message": "BrainVault AI Backend is running!"}

@app.get("/test-llm")
def test_llm():
    response = llm.complete("In one short sentence, what is retrieval-augmented generation?")
    return {"llm_response": str(response)}

@app.post("/api/resources/upload")
async def upload_pdf(file: UploadFile = File(...), db: Session = Depends(get_db)):
    # 1. Save the file to the local uploads directory
    file_location = f"uploads/{file.filename}"
    with open(file_location, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # 2. Save the resource record to PostgreSQL
    new_resource = models.Resource(
        title=file.filename, 
        source_type="pdf", 
        status="processing"
    )
    db.add(new_resource)
    db.commit()
    db.refresh(new_resource)
    
    # (Next up: We will add the text extraction and Qdrant embedding logic here)
    
    return {
        "message": f"'{file.filename}' uploaded successfully!", 
        "resource_id": new_resource.id, 
        "status": new_resource.status
    }