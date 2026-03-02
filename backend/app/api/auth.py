from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from supabase import create_client, Client
from app.config import settings

router = APIRouter()

supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

class LoginRequest(BaseModel):
    email: str
    password: str

@router.post("/login")
def login(credentials: LoginRequest):
    try:
        response = supabase.auth.signInWithPassword({
            "email": credentials.email,
            "password": credentials.password
        })
        return {"access_token": response.session.access_token, "user": response.user}
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))
