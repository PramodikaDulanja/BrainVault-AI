from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from dotenv import load_dotenv
import os
import shutil
import json
import platform
from datetime import datetime, timezone
from typing import List, Optional

from pydantic import BaseModel
import pytesseract
from pdf2image import convert_from_path
from pypdf import PdfReader
from PIL import Image

from llama_index.llms.groq import Groq
from llama_index.core import SimpleDirectoryReader, VectorStoreIndex, StorageContext, Settings, Document
from llama_index.core.memory import ChatMemoryBuffer
from llama_index.core.llms import ChatMessage as LlamaChatMessage, MessageRole
from llama_index.vector_stores.qdrant import QdrantVectorStore
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from qdrant_client.http import models as qdrant_models

import models
from database import engine, SessionLocal
import vector_db
from vector_db import qdrant_client, COLLECTION_NAME


app = FastAPI(title="BrainVault AI Backend")

# Allow Next.js to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. Dynamically set paths based on the Operating System
if platform.system() == "Windows":
    pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    POPPLER_PATH = r"C:\poppler-24.08.0\Library\bin"
else:
    POPPLER_PATH = None


# --- PYDANTIC SCHEMAS ---
class ChatRequest(BaseModel):
    query: str
    session_id: str = "default_session"


class LinkRequest(BaseModel):
    url: str


class CategoryCreate(BaseModel):
    name: str
    description: str = ""


class ResourceCategoriesUpdate(BaseModel):
    category_ids: List[int] = []
    new_category_name: Optional[str] = None


# Configure the embedding model globally
Settings.embed_model = HuggingFaceEmbedding(model_name="BAAI/bge-small-en-v1.5")

# Create the database tables in PostgreSQL
models.Base.metadata.create_all(bind=engine)


# Automatically migrate any existing single-category resources into the many-to-many table
def migrate_existing_categories():
    db = SessionLocal()
    try:
        resources = db.query(models.Resource).filter(models.Resource.category_id.isnot(None)).all()
        for res in resources:
            cat = db.query(models.Category).filter(models.Category.id == res.category_id).first()
            if cat and cat not in res.categories:
                res.categories.append(cat)
        db.commit()
    except Exception as e:
        print(f"Category migration notice: {e}")
    finally:
        db.close()


migrate_existing_categories()


def resolve_categories(db: Session, category_names: List[str], description: str = "") -> List[models.Category]:
    resolved = []
    seen = set()
    for raw_name in category_names:
        clean_name = str(raw_name).strip()
        if not clean_name or clean_name.lower() == "uncategorized" or clean_name.lower() in seen:
            continue
        seen.add(clean_name.lower())

        cat = db.query(models.Category).filter(models.Category.name.ilike(clean_name)).first()
        if not cat:
            cat = models.Category(name=clean_name, description=description)
            db.add(cat)
            db.commit()
            db.refresh(cat)
        resolved.append(cat)
    return resolved


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


# --- PDF UPLOAD & MULTI-CATEGORY FAST CLASSIFICATION ---
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
        sample_text = (
            f"{full_text[:1000]}\n...\n"
            f"{full_text[len(full_text)//2 - 500 : len(full_text)//2 + 500]}\n...\n"
            f"{full_text[-1000:]}"
        )
    else:
        sample_text = full_text

    # 2. Ask Groq to assign 1 to 3 related categories
    prompt = f"""
    Analyze this text sample and assign 1 to 3 relevant categories (from broad domains like "Education" to specific subjects like "Information Systems").
    Return strictly valid JSON:
    {{
        "title": "Doc Title",
        "topics": ["t1", "t2"],
        "categories": ["Primary Category", "Related Category"],
        "description": "Short summary"
    }}
    Text: {sample_text}
    """

    try:
        raw_response = str(llm.complete(prompt)).strip()
        clean_response = raw_response.replace("```json", "").replace("```", "").strip()
        ai_data = json.loads(clean_response)
        raw_cats = ai_data.get("categories") or (
            [ai_data["category"]] if ai_data.get("category") else []
        )
        cat_desc = ai_data.get("description", "Auto-categorized by AI")
    except Exception as e:
        print(f"AI JSON Error: {e}")
        ai_data = {}
        raw_cats, cat_desc = [], "Could not parse AI response"

    matched_categories = resolve_categories(db, raw_cats, description=cat_desc)

    # 3. Save to PostgreSQL as 'pending_processing'
    new_resource = models.Resource(
        title=ai_data.get("title", file.filename),
        source_type="pdf",
        status="pending_processing",
        category_id=matched_categories[0].id if matched_categories else None,
    )
    new_resource.categories = matched_categories
    db.add(new_resource)
    db.commit()
    db.refresh(new_resource)

    cat_names = [c.name for c in matched_categories]
    return {
        "message": "File uploaded and categorized instantly.",
        "resource_id": new_resource.id,
        "category": ", ".join(cat_names) if cat_names else "Uncategorized",
        "categories": cat_names,
        "status": new_resource.status,
    }


# --- DEEP PDF OCR & MULTI-CATEGORY VERIFICATION ---
@app.post("/api/resources/{resource_id}/process")
async def process_resource(resource_id: int, db: Session = Depends(get_db)):
    resource = db.query(models.Resource).filter(models.Resource.id == resource_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    file_location = f"uploads/{resource.title}"

    try:
        documents = []
        reader = PdfReader(file_location)

        # 1. Hybrid OCR loop
        for i, page in enumerate(reader.pages):
            text = page.extract_text()
            if not text or len(text.strip()) < 20 or "\x00" in text:
                images = convert_from_path(
                    file_location, first_page=i + 1, last_page=i + 1, poppler_path=POPPLER_PATH
                )
                text = pytesseract.image_to_string(images[0])

            documents.append(
                Document(text=text, metadata={"page_number": i + 1, "document_id": resource.id})
            )

        # 2. Deep Multi-Category Verification
        print("Running deep categorization to verify/update categories...")
        full_clean_text = "\n".join([doc.text for doc in documents])

        if len(full_clean_text) > 10000:
            deep_sample = f"{full_clean_text[:5000]}\n...\n{full_clean_text[-5000:]}"
        else:
            deep_sample = full_clean_text

        deep_prompt = f"""
        You are BrainVault AI's deep knowledge organizer.
        Read this fully extracted text and assign 1 to 3 relevant categories (from broad domains like "Education" to specific subjects like "Information Systems").
        Return strictly valid JSON:
        {{
            "categories": ["Primary Category", "Related Category"],
            "sub_category": "Sub Category",
            "tags": ["tag1", "tag2", "tag3"]
        }}
        Text: {deep_sample}
        """

        try:
            raw_response = str(llm.complete(deep_prompt)).strip()
            print(f"\n--- RAW AI RESPONSE ---\n{raw_response}\n-----------------------\n")
            clean_response = raw_response.replace("```json", "").replace("```", "").strip()
            deep_ai_data = json.loads(clean_response)

            raw_cats = deep_ai_data.get("categories") or (
                [deep_ai_data["primary_category"]] if deep_ai_data.get("primary_category") else []
            )
            final_sub_cat = deep_ai_data.get("sub_category", "")
            final_tags = deep_ai_data.get("tags", [])
        except Exception as e:
            print(f"Deep AI JSON Error: {e}")
            raw_cats, final_sub_cat, final_tags = [], "", []

        # 3. Update Many-to-Many Categories in PostgreSQL
        matched_categories = resolve_categories(db, raw_cats, description=final_sub_cat)
        if matched_categories:
            resource.categories = matched_categories
            resource.category_id = matched_categories[0].id
            db.commit()
        else:
            matched_categories = list(resource.categories)

        cat_names = [c.name for c in matched_categories] or ["Uncategorized"]

        # 4. Embed verified metadata into every chunk for Qdrant retrieval
        for doc in documents:
            doc.metadata["category_name"] = cat_names[0]
            doc.metadata["categories"] = cat_names
            doc.metadata["sub_category"] = final_sub_cat
            doc.metadata["tags"] = final_tags
            doc.metadata["source_name"] = resource.title

        # 5. Generate embeddings and save to Qdrant
        vector_store = QdrantVectorStore(client=qdrant_client, collection_name=COLLECTION_NAME)
        storage_context = StorageContext.from_defaults(vector_store=vector_store)
        VectorStoreIndex.from_documents(documents, storage_context=storage_context)

        # 6. Mark as complete
        resource.status = "processed"
        db.commit()

        return {
            "message": "Advanced extraction and deep categorization complete",
            "verified_category": ", ".join(cat_names),
            "categories": cat_names,
            "sub_category": final_sub_cat,
            "tags": final_tags,
            "status": resource.status,
        }

    except Exception as e:
        resource.status = "failed"
        db.commit()
        return {"error": str(e)}


# --- WEB LINK INGESTION ---
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

        for element in soup(["script", "style", "nav", "footer", "header"]):
            element.extract()

        text = soup.get_text(separator="\n")
        clean_text = "\n".join(line.strip() for line in text.splitlines() if line.strip())

        if not clean_text:
            return {"error": "No readable text found on this page."}

    except Exception as e:
        return {"error": f"Failed to read URL: {str(e)}"}

    # 2. Multi-Category Classification
    deep_prompt = f"""
    You are BrainVault AI. Read this web article and assign 1 to 3 relevant categories (from broad domains like "Education" to specific subjects like "Information Systems").
    Return strictly valid JSON:
    {{
        "categories": ["Primary Category", "Related Category"],
        "sub_category": "Sub Category",
        "tags": ["tag1", "tag2", "tag3"]
    }}
    Text: {clean_text[:5000]}
    """

    try:
        raw_response = str(llm.complete(deep_prompt)).strip()
        clean_response = raw_response.replace("```json", "").replace("```", "").strip()
        ai_data = json.loads(clean_response)

        raw_cats = ai_data.get("categories") or (
            [ai_data["primary_category"]] if ai_data.get("primary_category") else ["Web Article"]
        )
        sub_cat = ai_data.get("sub_category", "")
        tags = ai_data.get("tags", [])
    except Exception as e:
        print(f"Deep AI JSON Error: {e}")
        raw_cats, sub_cat, tags = ["Web Article"], "Uncategorized", []

    matched_categories = resolve_categories(db, raw_cats or ["Web Article"], description=sub_cat)

    # 3. Save to PostgreSQL
    resource = models.Resource(
        title=title[:255],
        source_type="url",
        status="processed",
        category_id=matched_categories[0].id if matched_categories else None,
    )
    resource.categories = matched_categories
    db.add(resource)
    db.commit()
    db.refresh(resource)

    cat_names = [c.name for c in matched_categories] or ["Web Article"]

    # 4. Embed directly into Qdrant
    doc = Document(
        text=clean_text,
        metadata={
            "document_id": resource.id,
            "source_name": req.url,
            "category_name": cat_names[0],
            "categories": cat_names,
            "tags": tags,
        },
    )

    vector_store = QdrantVectorStore(client=qdrant_client, collection_name=COLLECTION_NAME)
    storage_context = StorageContext.from_defaults(vector_store=vector_store)
    VectorStoreIndex.from_documents([doc], storage_context=storage_context)

    return {
        "message": "Web link ingested and embedded successfully!",
        "resource_id": resource.id,
        "title": title,
        "category": ", ".join(cat_names),
        "categories": cat_names,
        "tags": tags,
        "status": "processed",
    }


# --- IMAGE OCR INGESTION ---
@app.post("/api/resources/image")
async def upload_image(file: UploadFile = File(...), db: Session = Depends(get_db)):
    os.makedirs("uploads", exist_ok=True)
    file_location = f"uploads/{file.filename}"

    with open(file_location, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # 1. Extract text via local Tesseract OCR
    try:
        img = Image.open(file_location)
        extracted_text = pytesseract.image_to_string(img)

        if not extracted_text or len(extracted_text.strip()) < 5:
            return {"error": "No readable text found in this image."}

    except Exception as e:
        return {"error": f"OCR Engine failed to read image: {str(e)}"}

    # 2. Multi-Category Classification
    deep_prompt = f"""
    You are BrainVault AI. Read this extracted image text and assign 1 to 3 relevant categories (from broad domains like "Education" to specific subjects like "Information Systems").
    Return strictly valid JSON:
    {{
        "categories": ["Primary Category", "Related Category"],
        "sub_category": "Sub Category",
        "tags": ["tag1", "tag2", "tag3"]
    }}
    Text: {extracted_text[:4000]}
    """

    try:
        raw_response = str(llm.complete(deep_prompt)).strip()
        clean_response = raw_response.replace("```json", "").replace("```", "").strip()
        ai_data = json.loads(clean_response)

        raw_cats = ai_data.get("categories") or (
            [ai_data["primary_category"]] if ai_data.get("primary_category") else ["Image Asset"]
        )
        sub_cat = ai_data.get("sub_category", "")
        tags = ai_data.get("tags", [])
    except Exception as e:
        print(f"AI JSON Error: {e}")
        raw_cats, sub_cat, tags = ["Image Asset"], "Uncategorized", []

    matched_categories = resolve_categories(db, raw_cats or ["Image Asset"], description=sub_cat)

    # 3. Save to PostgreSQL
    resource = models.Resource(
        title=file.filename[:255],
        source_type="image",
        status="processed",
        category_id=matched_categories[0].id if matched_categories else None,
    )
    resource.categories = matched_categories
    db.add(resource)
    db.commit()
    db.refresh(resource)

    cat_names = [c.name for c in matched_categories] or ["Image Asset"]

    # 4. Embed extracted text to Qdrant
    doc = Document(
        text=extracted_text,
        metadata={
            "document_id": resource.id,
            "source_name": file.filename,
            "category_name": cat_names[0],
            "categories": cat_names,
            "tags": tags,
        },
    )

    vector_store = QdrantVectorStore(client=qdrant_client, collection_name=COLLECTION_NAME)
    storage_context = StorageContext.from_defaults(vector_store=vector_store)
    VectorStoreIndex.from_documents([doc], storage_context=storage_context)

    return {
        "message": "Image OCR analyzed and embedded successfully!",
        "resource_id": resource.id,
        "title": file.filename,
        "category": ", ".join(cat_names),
        "categories": cat_names,
        "tags": tags,
        "status": "processed",
    }


# --- KNOWLEDGE LIBRARY & MULTI-CATEGORY MANAGEMENT ---
@app.get("/api/resources")
def get_all_resources(db: Session = Depends(get_db)):
    resources = db.query(models.Resource).order_by(models.Resource.id.desc()).all()

    library = []
    for res in resources:
        cats = [{"id": c.id, "name": c.name} for c in res.categories]
        if not cats and res.category_id:
            legacy_cat = db.query(models.Category).filter(models.Category.id == res.category_id).first()
            if legacy_cat:
                cats = [{"id": legacy_cat.id, "name": legacy_cat.name}]

        primary_cat = res.categories[0] if res.categories else None
        library.append({
            "id": res.id,
            "title": res.title,
            "source_type": res.source_type,
            "status": res.status,
            "categories": cats,
            "category": cats[0]["name"] if cats else "Uncategorized",
            "sub_category": primary_cat.description if primary_cat else "",
        })

    return {"resources": library}


@app.put("/api/resources/{resource_id}/categories")
def update_resource_categories(
    resource_id: int, payload: ResourceCategoriesUpdate, db: Session = Depends(get_db)
):
    resource = db.query(models.Resource).filter(models.Resource.id == resource_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    selected_categories = []
    if payload.category_ids:
        selected_categories = (
            db.query(models.Category).filter(models.Category.id.in_(payload.category_ids)).all()
        )

    if payload.new_category_name and payload.new_category_name.strip():
        created = resolve_categories(db, [payload.new_category_name.strip()])
        for c in created:
            if c not in selected_categories:
                selected_categories.append(c)

    resource.categories = selected_categories
    resource.category_id = selected_categories[0].id if selected_categories else None
    db.commit()
    db.refresh(resource)

    updated_list = [{"id": c.id, "name": c.name} for c in resource.categories]
    category_names = [c["name"] for c in updated_list] or ["Uncategorized"]

    # Synchronize updated categories to Qdrant chunk metadata
    try:
        qdrant_client.set_payload(
            collection_name=COLLECTION_NAME,
            payload={
                "category_name": category_names[0],
                "categories": category_names,
            },
            points=qdrant_models.FilterSelector(
                filter=qdrant_models.Filter(
                    must=[
                        qdrant_models.FieldCondition(
                            key="document_id",
                            match=qdrant_models.MatchValue(value=resource_id),
                        )
                    ]
                )
            ),
        )
    except Exception as e:
        print(f"Warning: Could not sync Qdrant metadata for resource {resource_id}: {e}")

    return {
        "message": "Resource categories updated",
        "resource_id": resource.id,
        "categories": updated_list,
    }


@app.delete("/api/resources/{resource_id}")
def delete_resource(resource_id: int, db: Session = Depends(get_db)):
    resource = db.query(models.Resource).filter(models.Resource.id == resource_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    # 1. Delete matching vector chunks from Qdrant
    try:
        qdrant_client.delete(
            collection_name=COLLECTION_NAME,
            points_selector=qdrant_models.FilterSelector(
                filter=qdrant_models.Filter(
                    must=[
                        qdrant_models.FieldCondition(
                            key="document_id",
                            match=qdrant_models.MatchValue(value=resource_id),
                        )
                    ]
                )
            ),
        )
    except Exception as e:
        print(f"Warning: Qdrant vector cleanup failed for resource {resource_id}: {e}")

    # 2. Remove local file if applicable
    if resource.source_type in ["pdf", "image"]:
        file_path = os.path.join("uploads", resource.title)
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as e:
                print(f"Warning: Could not delete local file {file_path}: {e}")

    # 3. Delete record from PostgreSQL
    db.delete(resource)
    db.commit()

    return {"message": f"Resource '{resource.title}' deleted successfully", "id": resource_id}


# --- CATEGORIES ENDPOINTS ---
@app.get("/api/categories")
def get_all_categories(db: Session = Depends(get_db)):
    categories = db.query(models.Category).order_by(models.Category.name.asc()).all()
    all_resources = db.query(models.Resource).order_by(models.Resource.id.desc()).all()

    result = []
    for cat in categories:
        cat_resources = sorted(cat.resources, key=lambda r: r.id, reverse=True)
        result.append({
            "id": cat.id,
            "name": cat.name,
            "description": cat.description or "AI-organized knowledge collection",
            "resource_count": len(cat_resources),
            "breakdown": {
                "pdf": sum(1 for r in cat_resources if r.source_type == "pdf"),
                "url": sum(1 for r in cat_resources if r.source_type == "url"),
                "image": sum(1 for r in cat_resources if r.source_type == "image"),
            },
            "resources": [
                {
                    "id": r.id,
                    "title": r.title,
                    "source_type": r.source_type,
                    "status": r.status,
                }
                for r in cat_resources
            ],
        })

    uncategorized = [r for r in all_resources if len(r.categories) == 0]
    if uncategorized:
        result.append({
            "id": 0,
            "name": "Uncategorized",
            "description": "Resources awaiting category assignment",
            "resource_count": len(uncategorized),
            "breakdown": {
                "pdf": sum(1 for r in uncategorized if r.source_type == "pdf"),
                "url": sum(1 for r in uncategorized if r.source_type == "url"),
                "image": sum(1 for r in uncategorized if r.source_type == "image"),
            },
            "resources": [
                {
                    "id": r.id,
                    "title": r.title,
                    "source_type": r.source_type,
                    "status": r.status,
                }
                for r in uncategorized
            ],
        })

    return {"categories": result}


@app.post("/api/categories")
def create_category(req: CategoryCreate, db: Session = Depends(get_db)):
    clean_name = req.name.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Category name cannot be empty")

    existing = db.query(models.Category).filter(models.Category.name.ilike(clean_name)).first()
    if existing:
        raise HTTPException(status_code=400, detail="A category with this name already exists")

    new_cat = models.Category(name=clean_name, description=req.description.strip())
    db.add(new_cat)
    db.commit()
    db.refresh(new_cat)

    return {
        "message": "Category created",
        "category": {
            "id": new_cat.id,
            "name": new_cat.name,
            "description": new_cat.description,
        },
    }


@app.delete("/api/categories/{category_id}")
def delete_category(category_id: int, db: Session = Depends(get_db)):
    category = db.query(models.Category).filter(models.Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    # Safely detach this category from linked resources while keeping their other categories intact
    for res in list(category.resources):
        res.categories.remove(category)
        if res.category_id == category_id:
            res.category_id = res.categories[0].id if res.categories else None

    db.delete(category)
    db.commit()

    return {"message": f"Category '{category.name}' deleted", "id": category_id}


# --- PERSISTENT CHAT ASSISTANT ---
chat_engines = {}


@app.post("/api/chat")
async def chat_with_brain(request: ChatRequest, db: Session = Depends(get_db)):
    try:
        session = db.query(models.ChatSession).filter(models.ChatSession.id == request.session_id).first()
        short_title = request.query.strip()[:45] + ("..." if len(request.query.strip()) > 45 else "")

        if not session:
            session = models.ChatSession(id=request.session_id, title=short_title or "New Chat")
            db.add(session)
            db.commit()
            db.refresh(session)
        elif session.title in ["New Chat", "New Chat Session"]:
            session.title = short_title or session.title
            db.commit()

        if request.session_id not in chat_engines:
            vector_store = QdrantVectorStore(client=qdrant_client, collection_name=COLLECTION_NAME)
            index = VectorStoreIndex.from_vector_store(vector_store=vector_store)

            past_messages = (
                db.query(models.ChatMessage)
                .filter(models.ChatMessage.session_id == request.session_id)
                .order_by(models.ChatMessage.id.asc())
                .all()
            )
            chat_history = [
                LlamaChatMessage(
                    role=MessageRole.USER if m.role == "user" else MessageRole.ASSISTANT,
                    content=m.content,
                )
                for m in past_messages
            ]

            memory = ChatMemoryBuffer.from_defaults(token_limit=1500, chat_history=chat_history)
            chat_engines[request.session_id] = index.as_chat_engine(
                chat_mode="context",
                memory=memory,
                llm=llm,
                similarity_top_k=5,
                system_prompt="You are BrainVault AI, a helpful personal assistant. Answer questions based on the provided document context.",
            )

        user_record = models.ChatMessage(
            session_id=request.session_id,
            role="user",
            content=request.query,
        )
        db.add(user_record)
        db.commit()

        engine = chat_engines[request.session_id]
        response = engine.chat(request.query)
        ai_text = str(response)

        ai_record = models.ChatMessage(
            session_id=request.session_id,
            role="ai",
            content=ai_text,
        )
        db.add(ai_record)
        session.updated_at = datetime.now(timezone.utc)
        db.commit()

        return {
            "answer": ai_text,
            "session_id": request.session_id,
            "session_title": session.title,
        }

    except Exception as e:
        return {"error": str(e)}


@app.get("/api/chat/sessions")
def get_chat_sessions(db: Session = Depends(get_db)):
    sessions = (
        db.query(models.ChatSession)
        .order_by(models.ChatSession.updated_at.desc())
        .all()
    )
    return {
        "sessions": [
            {"id": s.id, "title": s.title, "updated_at": s.updated_at}
            for s in sessions
        ]
    }


@app.get("/api/chat/sessions/{session_id}")
def get_chat_history(session_id: str, db: Session = Depends(get_db)):
    messages = (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.session_id == session_id)
        .order_by(models.ChatMessage.id.asc())
        .all()
    )
    return {
        "session_id": session_id,
        "messages": [
            {"id": m.id, "role": m.role, "content": m.content}
            for m in messages
        ],
    }


@app.delete("/api/chat/sessions/{session_id}")
def delete_chat_session(session_id: str, db: Session = Depends(get_db)):
    session = db.query(models.ChatSession).filter(models.ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    db.query(models.ChatMessage).filter(models.ChatMessage.session_id == session_id).delete()
    db.delete(session)
    db.commit()

    chat_engines.pop(session_id, None)
    return {"message": "Chat session deleted", "session_id": session_id}


# --- SYSTEM STATS ---
@app.get("/api/stats")
def get_system_stats(db: Session = Depends(get_db)):
    resource_count = db.query(models.Resource).count()
    category_count = db.query(models.Category).count()

    try:
        chunk_count = qdrant_client.count(collection_name=COLLECTION_NAME).count
    except Exception:
        chunk_count = 0

    return {
        "resources": resource_count,
        "categories": category_count,
        "chunks": chunk_count,
    }