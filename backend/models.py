from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

# Join table linking Resources <-> Categories (Many-to-Many)
resource_categories = Table(
    "resource_categories",
    Base.metadata,
    Column("resource_id", Integer, ForeignKey("resources.id", ondelete="CASCADE"), primary_key=True),
    Column("category_id", Integer, ForeignKey("categories.id", ondelete="CASCADE"), primary_key=True),
)

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    description = Column(Text, nullable=True)

    resources = relationship(
        "Resource",
        secondary=resource_categories,
        back_populates="categories",
    )

class Resource(Base):
    __tablename__ = "resources"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    source_type = Column(String)  # e.g., 'pdf', 'url', 'image'
    status = Column(String, default="pending")  # e.g., 'pending', 'processed', 'failed'
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)  # Legacy primary fallback
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    categories = relationship(
        "Category",
        secondary=resource_categories,
        back_populates="resources",
    )

class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, default="New Chat")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, ForeignKey("chat_sessions.id", ondelete="CASCADE"), index=True)
    role = Column(String)  # 'user' or 'ai'
    content = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())