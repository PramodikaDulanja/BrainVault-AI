import os
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams
from dotenv import load_dotenv

load_dotenv()

# Connect to the Qdrant instance running in Docker
qdrant_client = QdrantClient(url=os.getenv("QDRANT_URL"))

COLLECTION_NAME = "brainvault_knowledge"

# Create the collection if it doesn't exist already
def init_qdrant():
    collections = qdrant_client.get_collections().collections
    exists = any(c.name == COLLECTION_NAME for c in collections)
    
    if not exists:
        qdrant_client.create_collection(
            collection_name=COLLECTION_NAME,
            # We are using 1024 as the vector size, standard for many embedding models
            # vectors_config=VectorParams(size=1024, distance=Distance.COSINE),
            vectors_config=VectorParams(size=384, distance=Distance.COSINE),
        )
        print(f"Created Qdrant collection: {COLLECTION_NAME}")
    else:
        print(f"Qdrant collection '{COLLECTION_NAME}' already exists.")


init_qdrant()