from fastapi import FastAPI, UploadFile, File, Depends
from sqlalchemy.orm import Session
from dotenv import load_dotenv
import os
import shutil


from llama_index.llms.groq import Groq
import models
from database import engine, SessionLocal
import vector_db

from llama_index.core import SimpleDirectoryReader, VectorStoreIndex, StorageContext, Settings
from llama_index.vector_stores.qdrant import QdrantVectorStore
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from vector_db import qdrant_client, COLLECTION_NAME

from pydantic import BaseModel
import pytesseract
from pdf2image import convert_from_path
from pypdf import PdfReader
from llama_index.core import Document
import platform

from llama_index.core.memory import ChatMemoryBuffer

    

# 1. Dynamically set paths based on the Operating System
if platform.system() == "Windows":
    # Use your local Windows paths for testing
    pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
    POPPLER_PATH = r'C:\poppler-24.08.0\Library\bin'
else:
    # In Linux/Docker, tools are in the global PATH, so we leave this blank
    POPPLER_PATH = None


pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

class ChatRequest(BaseModel):
    query: str
    session_id: str = "default_session" # Added a session ID to track different users/chats

# Configure the embedding model globally (this downloads a small model on first run)
Settings.embed_model = HuggingFaceEmbedding(model_name="BAAI/bge-small-en-v1.5")
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
    file_location = f"uploads/{file.filename}"
    with open(file_location, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    new_resource = models.Resource(
        title=file.filename, 
        source_type="pdf", 
        status="processing"
    )
    db.add(new_resource)
    db.commit()
    db.refresh(new_resource)
    
    try:
        documents = []
        reader = PdfReader(file_location)
        
        for i, page in enumerate(reader.pages):
            text = page.extract_text()
            
            if not text or len(text.strip()) < 20 or "\x00" in text:
                print(f"Page {i+1} is unreadable. Triggering OCR...")
                
                # 2. Pass the dynamic POPPLER_PATH here
                images = convert_from_path(
                    file_location, 
                    first_page=i+1, 
                    last_page=i+1, 
                    poppler_path=POPPLER_PATH
                )
                text = pytesseract.image_to_string(images[0])
            
            documents.append(Document(text=text, metadata={"page": i+1, "file": file.filename}))


        # 4. Set up Qdrant connection
        vector_store = QdrantVectorStore(client=qdrant_client, collection_name=COLLECTION_NAME)
        storage_context = StorageContext.from_defaults(vector_store=vector_store)
        
        # 5. Chunk the text, generate embeddings, and save
        index = VectorStoreIndex.from_documents(
            documents, 
            storage_context=storage_context
        )
        
        new_resource.status = "processed"
        db.commit()
        
    except Exception as e:
        new_resource.status = "failed"
        db.commit()
        return {"error": str(e)}
        
    return {
        "message": f"'{file.filename}' uploaded successfully!", 
        "resource_id": new_resource.id, 
        "status": new_resource.status
    }



chat_engines = {}

@app.post("/api/chat")
async def chat_with_brain(request: ChatRequest):
    try:
        # 1. Check if this session already has an active memory
        if request.session_id not in chat_engines:
            print(f"Starting new conversation memory for: {request.session_id}")
            vector_store = QdrantVectorStore(client=qdrant_client, collection_name=COLLECTION_NAME)
            index = VectorStoreIndex.from_vector_store(vector_store=vector_store)
            
            # Create a memory buffer to remember recent messages (limit to 1500 tokens to save context window)
            memory = ChatMemoryBuffer.from_defaults(token_limit=1500)
            
            # Upgrade from 'query_engine' to 'chat_engine'
            chat_engines[request.session_id] = index.as_chat_engine(
                chat_mode="context",
                memory=memory,
                llm=llm,
                similarity_top_k=5,
                system_prompt="You are BrainVault AI, a helpful personal assistant. Answer questions based on the provided document context."
            )
        
        # 2. Retrieve the AI engine with this session's memory
        engine = chat_engines[request.session_id]
        
        # 3. Use .chat() instead of .query() to continue the conversation
        response = engine.chat(request.query)
        
        # (Optional Debug: Print what the AI read from the documents)
        print("\n=== WHAT THE AI READ ===")
        for i, node in enumerate(response.source_nodes):
            print(f"--- Chunk {i+1} ---")
            print(node.text[:200] + "...\n") 
        print("========================\n")
        
        return {
            "answer": str(response), 
            "session_id": request.session_id
        }
        
    except Exception as e:
        return {"error": str(e)}
