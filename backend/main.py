from fastapi import FastAPI
from dotenv import load_dotenv
import os
from llama_index.llms.groq import Groq
import models
from database import engine

# Create the database tables in PostgreSQL
models.Base.metadata.create_all(bind=engine)

load_dotenv()

app = FastAPI(title="BrainVault AI Backend")

# Initialize the Groq LLM
llm = Groq(model="openai/gpt-oss-20b", api_key=os.getenv("GROQ_API_KEY"))

@app.get("/")
def read_root():
    return {"message": "BrainVault AI Backend is running!"}

@app.get("/test-llm")
def test_llm():
    # A simple test to ensure the LLM is connected
    response = llm.complete("who is the president in shri lanka")
    return {"llm_response": str(response)}