from fastapi import FastAPI, UploadFile, File, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from dotenv import load_dotenv
import os
import shutil
import json

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

app = FastAPI(title="BrainVault AI Backend")

# allow Next.js to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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



class LinkRequest(BaseModel):
    url: str

# Configure the embedding model globally (this downloads a small model on first run)
Settings.embed_model = HuggingFaceEmbedding(model_name="BAAI/bge-small-en-v1.5")
# Create the database tables in PostgreSQL
models.Base.metadata.create_all(bind=engine)

load_dotenv()


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
    os.makedirs("uploads", exist_ok=True)
    file_location = f"uploads/{file.filename}"
    
    with open(file_location, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # 1. Read just enough to categorize
    reader = PdfReader(file_location)
    full_text = "\n".join([page.extract_text() for page in reader.pages if page.extract_text()])
    
    if len(full_text) > 3000:
        sample_text = f"{full_text[:1000]}\n...\n{full_text[len(full_text)//2 - 500 : len(full_text)//2 + 500]}\n...\n{full_text[-1000:]}"
    else:
        sample_text = full_text

    # 2. Ask Groq to categorize
    prompt = f"""
    Analyze this text sample. Return strictly valid JSON:
    {{"title": "Doc Title", "topics": ["t1", "t2"], "category": "Category Name", "description": "Short summary"}}
    Text: {sample_text}
    """
    
    try:
        ai_data = json.loads(str(llm.complete(prompt)).strip())
        cat_name = ai_data.get("category", "Uncategorized")
        cat_desc = ai_data.get("description", "Auto-categorized by AI")
    except Exception as e:
        print(f"AI JSON Error: {e}")
        ai_data = {} # <-- FIX: Initialize an empty dictionary if the AI fails
        cat_name, cat_desc = "Uncategorized", "Could not parse AI response"

    category = db.query(models.Category).filter(models.Category.name == cat_name).first()
    if not category:
        category = models.Category(name=cat_name, description=cat_desc)
        db.add(category)
        db.commit()
        db.refresh(category)
        
    # 3. Save to PostgreSQL as 'pending_processing'
    new_resource = models.Resource(
        title=ai_data.get("title", file.filename), 
        source_type="pdf", 
        status="pending_processing",
        category_id=category.id
    )
    db.add(new_resource)
    db.commit()
    db.refresh(new_resource)
    
    return {
        "message": "File uploaded and categorized instantly.", 
        "resource_id": new_resource.id, 
        "category": cat_name,
        "status": new_resource.status
    }



@app.post("/api/resources/{resource_id}/process")
async def process_resource(resource_id: int, db: Session = Depends(get_db)):
    # 1. Find the resource in PostgreSQL
    resource = db.query(models.Resource).filter(models.Resource.id == resource_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
        
    file_location = f"uploads/{resource.title}"
    
    try:
        documents = []
        reader = PdfReader(file_location)
        
        # 2. The heavy Hybrid OCR loop (gets the CLEAN text)
        for i, page in enumerate(reader.pages):
            text = page.extract_text()
            if not text or len(text.strip()) < 20 or "\x00" in text:
                images = convert_from_path(file_location, first_page=i+1, last_page=i+1, poppler_path=POPPLER_PATH)
                text = pytesseract.image_to_string(images[0])
            
            documents.append(Document(text=text, metadata={"page_number": i+1, "document_id": resource.id}))

        # 3. DEEP CATEGORIZATION VERIFICATION
        print("Running deep categorization to verify/update categories...")
        full_clean_text = "\n".join([doc.text for doc in documents])
        
        # Give the AI a much richer sample now that we have OCR'd the whole document
        if len(full_clean_text) > 10000:
            deep_sample = f"{full_clean_text[:5000]}\n...\n{full_clean_text[-5000:]}"
        else:
            deep_sample = full_clean_text
            
        deep_prompt = f"""
        You are BrainVault AI's deep knowledge organizer.
        Read this fully extracted, clean text and provide the absolute most accurate classification.
        Return strictly valid JSON:
        {{
            "primary_category": "Main Category",
            "sub_category": "Sub Category",
            "tags": ["tag1", "tag2", "tag3"]
        }}
        Text: {deep_sample}
        """
        
        try:
            # 1. Get the raw string from the AI
            raw_response = str(llm.complete(deep_prompt)).strip()
            
            # 2. Print it to the terminal so we can debug what the AI is actually saying
            print(f"\n--- RAW AI RESPONSE ---\n{raw_response}\n-----------------------\n")
            
            # 3. Strip out markdown code blocks if the AI added them
            clean_response = raw_response.replace("```json", "").replace("```", "").strip()
            
            # 4. Parse the clean JSON
            deep_ai_data = json.loads(clean_response)
            
            final_cat_name = deep_ai_data.get("primary_category", "Uncategorized")
            final_sub_cat = deep_ai_data.get("sub_category", "")
            final_tags = deep_ai_data.get("tags", [])
        except Exception as e:
            print(f"Deep AI JSON Error: {e}")
            final_cat_name, final_sub_cat, final_tags = None, None, []
            
        # 4. Correct the Database if necessary
        # First, default to the category we already assigned in the fast upload step
        category = db.query(models.Category).filter(models.Category.id == resource.category_id).first()
        
        # If the Deep AI successfully found a better category, update it
        if final_cat_name and final_cat_name != "Uncategorized":
            new_category = db.query(models.Category).filter(models.Category.name == final_cat_name).first()
            if not new_category:
                print(f"Deep Analysis created a more accurate category: {final_cat_name}")
                new_category = models.Category(name=final_cat_name, description=final_sub_cat)
                db.add(new_category)
                db.commit()
                db.refresh(new_category)
            
            # Override our default category with the new AI category
            category = new_category
            resource.category_id = category.id
            db.commit()

        # 5. Embed the verified metadata into every chunk for perfect Qdrant retrieval
        for doc in documents:
            doc.metadata["category_name"] = category.name if category else "Uncategorized"
            doc.metadata["sub_category"] = final_sub_cat
            doc.metadata["tags"] = final_tags
            doc.metadata["source_name"] = resource.title

        # 6. Generate embeddings and save to Qdrant
        vector_store = QdrantVectorStore(client=qdrant_client, collection_name=COLLECTION_NAME)
        storage_context = StorageContext.from_defaults(vector_store=vector_store)
        index = VectorStoreIndex.from_documents(documents, storage_context=storage_context)
        
        # 7. Mark as complete
        resource.status = "processed"
        db.commit()
        
        return {
            "message": "Advanced extraction and deep categorization complete", 
            "verified_category": category.name if category else "Uncategorized",
            "sub_category": final_sub_cat,
            "tags": final_tags,
            "status": resource.status
        }
        
    except Exception as e:
        resource.status = "failed"
        db.commit()
        return {"error": str(e)}





@app.post("/api/resources/link")
async def ingest_link(req: LinkRequest, db: Session = Depends(get_db)):
    import requests
    from bs4 import BeautifulSoup
    
    # 1. Scrape the URL
    try:
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
        response = requests.get(req.url, headers=headers, timeout=10)
        soup = BeautifulSoup(response.content, "html.parser")
        
        title = soup.title.string.strip() if soup.title else req.url
        
        # Strip out navigation menus, scripts, and footers to isolate the core article
        for element in soup(["script", "style", "nav", "footer", "header"]):
            element.extract()
            
        text = soup.get_text(separator="\n")
        clean_text = "\n".join(line.strip() for line in text.splitlines() if line.strip())
        
        if not clean_text:
            return {"error": "No readable text found on this page."}
            
    except Exception as e:
        return {"error": f"Failed to read URL: {str(e)}"}

    # 2. Deep Categorization (Skipping the fast step since text extraction is instant)
    deep_prompt = f"""
    You are BrainVault AI. Read this web article and provide the most accurate classification.
    Return strictly valid JSON:
    {{
        "primary_category": "Main Category",
        "sub_category": "Sub Category",
        "tags": ["tag1", "tag2", "tag3"]
    }}
    Text: {clean_text[:5000]}
    """
    
    try:
        raw_response = str(llm.complete(deep_prompt)).strip()
        clean_response = raw_response.replace("```json", "").replace("```", "").strip()
        ai_data = json.loads(clean_response)
        
        cat_name = ai_data.get("primary_category", "Web Article")
        sub_cat = ai_data.get("sub_category", "")
        tags = ai_data.get("tags", [])
    except Exception as e:
        print(f"Deep AI JSON Error: {e}")
        cat_name, sub_cat, tags = "Web Article", "Uncategorized", []

    # 3. Save to PostgreSQL
    category = db.query(models.Category).filter(models.Category.name == cat_name).first()
    if not category:
        category = models.Category(name=cat_name, description=sub_cat)
        db.add(category)
        db.commit()
        db.refresh(category)

    resource = models.Resource(
        title=title[:255], 
        source_type="url", 
        status="processed", # Marked processed instantly
        category_id=category.id
    )
    db.add(resource)
    db.commit()
    db.refresh(resource)

    # 4. Embed directly into Qdrant
    doc = Document(text=clean_text, metadata={
        "document_id": resource.id,
        "source_name": req.url,
        "category_name": category.name,
        "tags": tags
    })
    
    vector_store = QdrantVectorStore(client=qdrant_client, collection_name=COLLECTION_NAME)
    storage_context = StorageContext.from_defaults(vector_store=vector_store)
    VectorStoreIndex.from_documents([doc], storage_context=storage_context)

    return {
        "message": "Web link ingested and embedded successfully!",
        "resource_id": resource.id,
        "title": title,
        "category": cat_name,
        "tags": tags,
        "status": "processed"
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





@app.get("/api/resources")
def get_all_resources(db: Session = Depends(get_db)):
    # Fetch all resources, newest first
    resources = db.query(models.Resource).order_by(models.Resource.id.desc()).all()
    
    library = []
    for res in resources:
        # Get the matching category
        category = db.query(models.Category).filter(models.Category.id == res.category_id).first()
        
        library.append({
            "id": res.id,
            "title": res.title,
            "status": res.status,
            "category": category.name if category else "Uncategorized",
            "sub_category": category.description if category else ""
        })
        
    return {"resources": library}




@app.post("/api/resources/image")
async def upload_image(file: UploadFile = File(...), db: Session = Depends(get_db)):
    from PIL import Image
    
    os.makedirs("uploads", exist_ok=True)
    file_location = f"uploads/{file.filename}"
    
    with open(file_location, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # 1. Use our existing Tesseract OCR to read the image text
    try:
        img = Image.open(file_location)
        extracted_text = pytesseract.image_to_string(img)
        
        if not extracted_text or len(extracted_text.strip()) < 5:
            return {"error": "No readable text found in this image."}
            
    except Exception as e:
        return {"error": f"OCR Engine failed to read image: {str(e)}"}
        
    # 2. Categorize using the EXACT SAME model setup used for PDFs
    deep_prompt = f"""
    You are BrainVault AI. Read this extracted image text and provide the most accurate classification.
    Return strictly valid JSON:
    {{
        "primary_category": "Main Category",
        "sub_category": "Sub Category",
        "tags": ["tag1", "tag2", "tag3"]
    }}
    Text: {extracted_text[:4000]}
    """
    
    try:
        raw_response = str(llm.complete(deep_prompt)).strip()
        clean_response = raw_response.replace("```json", "").replace("```", "").strip()
        ai_data = json.loads(clean_response)
        
        cat_name = ai_data.get("primary_category", "Image Asset")
        sub_cat = ai_data.get("sub_category", "")
        tags = ai_data.get("tags", [])
    except Exception as e:
        print(f"AI JSON Error: {e}")
        cat_name, sub_cat, tags = "Image Asset", "Uncategorized", []

    # 3. Save to Database
    category = db.query(models.Category).filter(models.Category.name == cat_name).first()
    if not category:
        category = models.Category(name=cat_name, description=sub_cat)
        db.add(category)
        db.commit()
        db.refresh(category)

    resource = models.Resource(
        title=file.filename[:255], 
        source_type="image", 
        status="processed", 
        category_id=category.id
    )
    db.add(resource)
    db.commit()
    db.refresh(resource)

    # 4. Embed the extracted text to Qdrant
    doc = Document(text=extracted_text, metadata={
        "document_id": resource.id,
        "source_name": file.filename,
        "category_name": category.name,
        "tags": tags
    })
    
    vector_store = QdrantVectorStore(client=qdrant_client, collection_name=COLLECTION_NAME)
    storage_context = StorageContext.from_defaults(vector_store=vector_store)
    VectorStoreIndex.from_documents([doc], storage_context=storage_context)

    return {
        "message": "Image OCR analyzed and embedded successfully!",
        "resource_id": resource.id,
        "title": file.filename,
        "category": cat_name,
        "tags": tags,
        "status": "processed"
    }




@app.get("/api/stats")
def get_system_stats(db: Session = Depends(get_db)):
    # 1. Count Resources and Categories in PostgreSQL
    resource_count = db.query(models.Resource).count()
    category_count = db.query(models.Category).count()
    
    # 2. Count indexed chunks directly from Qdrant Vector DB
    try:
        chunk_count = qdrant_client.count(collection_name=COLLECTION_NAME).count
    except Exception:
        chunk_count = 0
        
    return {
        "resources": resource_count,
        "categories": category_count,
        "chunks": chunk_count
    }