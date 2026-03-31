from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter, Request, Response, HTTPException
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from pydantic import BaseModel, EmailStr
from typing import List, Optional
import os
import logging
import uuid
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from pathlib import Path
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

mongo_client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = mongo_client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

JWT_ALGORITHM = "HS256"


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "access"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=30), "type": "refresh"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def doc_to_dict(doc: dict) -> dict:
    if doc is None:
        return None
    result = {}
    for key, value in doc.items():
        if key == "_id":
            result["id"] = str(value)
        elif isinstance(value, ObjectId):
            result[key] = str(value)
        elif isinstance(value, datetime):
            result[key] = value.isoformat()
        else:
            result[key] = value
    return result


def to_oid(id_str: str) -> ObjectId:
    try:
        return ObjectId(id_str)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid ID: {id_str}")


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ===================== Request Models =====================

class RegisterRequest(BaseModel):
    email: EmailStr
    name: str
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class SubjectCreate(BaseModel):
    name: str
    color: str = "#F97316"
    description: str = ""


class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    description: Optional[str] = None


class TopicCreate(BaseModel):
    name: str
    description: str = ""
    notes: str = ""


class TopicUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    is_completed: Optional[bool] = None


class StudySessionCreate(BaseModel):
    subject_id: str
    topic_id: Optional[str] = None
    title: str
    scheduled_date: str
    scheduled_time: str = "09:00"
    duration_minutes: int = 60
    notes: str = ""


class StudySessionUpdate(BaseModel):
    subject_id: Optional[str] = None
    topic_id: Optional[str] = None
    title: Optional[str] = None
    scheduled_date: Optional[str] = None
    scheduled_time: Optional[str] = None
    duration_minutes: Optional[int] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class PomodoroLogCreate(BaseModel):
    subject_id: Optional[str] = None
    pomodoros_completed: int
    total_focus_minutes: int


class AIPlanRequest(BaseModel):
    goals: str
    subjects: List[str] = []
    study_hours_per_day: float = 2.0
    duration_weeks: int = 4
    additional_notes: str = ""


# ===================== Auth Routes =====================

@api_router.post("/auth/register")
async def register(request: RegisterRequest, response: Response):
    email = request.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed = hash_password(request.password)
    user_doc = {
        "email": email,
        "name": request.name,
        "password_hash": hashed,
        "role": "user",
        "streak_count": 0,
        "last_study_date": None,
        "total_study_minutes": 0,
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=2592000, path="/")
    return {"id": user_id, "email": email, "name": request.name, "role": "user", "streak_count": 0, "total_study_minutes": 0}


@api_router.post("/auth/login")
async def login(request: LoginRequest, response: Response, http_request: Request):
    email = request.email.lower()
    ip = http_request.client.host if http_request.client else "unknown"
    identifier = f"{ip}:{email}"
    lockout_time = datetime.now(timezone.utc) - timedelta(minutes=15)
    attempts = await db.login_attempts.count_documents({"identifier": identifier, "timestamp": {"$gte": lockout_time}})
    if attempts >= 5:
        raise HTTPException(status_code=429, detail="Too many login attempts. Please wait 15 minutes.")
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(request.password, user["password_hash"]):
        await db.login_attempts.insert_one({"identifier": identifier, "timestamp": datetime.now(timezone.utc)})
        raise HTTPException(status_code=401, detail="Invalid email or password")
    await db.login_attempts.delete_many({"identifier": identifier})
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=2592000, path="/")
    return {"id": user_id, "email": email, "name": user.get("name", ""), "role": user.get("role", "user"), "streak_count": user.get("streak_count", 0), "total_study_minutes": user.get("total_study_minutes", 0)}


@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Logged out"}


@api_router.get("/auth/me")
async def get_me(request: Request):
    return await get_current_user(request)


@api_router.post("/auth/refresh")
async def refresh_token_endpoint(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        new_access_token = create_access_token(str(user["_id"]), user["email"])
        response.set_cookie(key="access_token", value=new_access_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
        return {"message": "Token refreshed"}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")


# ===================== Subject Routes =====================

@api_router.get("/subjects")
async def get_subjects(request: Request):
    user = await get_current_user(request)
    subjects = await db.subjects.find({"user_id": user["_id"]}).to_list(1000)
    result = []
    for s in subjects:
        sid = str(s["_id"])
        topic_count = await db.topics.count_documents({"subject_id": sid})
        completed_count = await db.topics.count_documents({"subject_id": sid, "is_completed": True})
        d = doc_to_dict(s)
        d["topic_count"] = topic_count
        d["completed_topic_count"] = completed_count
        result.append(d)
    return result


@api_router.post("/subjects")
async def create_subject(request: Request, body: SubjectCreate):
    user = await get_current_user(request)
    doc = {"user_id": user["_id"], "name": body.name, "color": body.color, "description": body.description, "created_at": datetime.now(timezone.utc)}
    result = await db.subjects.insert_one(doc)
    doc["_id"] = result.inserted_id
    d = doc_to_dict(doc)
    d["topic_count"] = 0
    d["completed_topic_count"] = 0
    return d


@api_router.put("/subjects/{subject_id}")
async def update_subject(request: Request, subject_id: str, body: SubjectUpdate):
    user = await get_current_user(request)
    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data")
    result = await db.subjects.update_one({"_id": to_oid(subject_id), "user_id": user["_id"]}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Subject not found")
    subject = await db.subjects.find_one({"_id": to_oid(subject_id)})
    tc = await db.topics.count_documents({"subject_id": subject_id})
    cc = await db.topics.count_documents({"subject_id": subject_id, "is_completed": True})
    d = doc_to_dict(subject)
    d["topic_count"] = tc
    d["completed_topic_count"] = cc
    return d


@api_router.delete("/subjects/{subject_id}")
async def delete_subject(request: Request, subject_id: str):
    user = await get_current_user(request)
    result = await db.subjects.delete_one({"_id": to_oid(subject_id), "user_id": user["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Subject not found")
    await db.topics.delete_many({"subject_id": subject_id})
    return {"message": "Subject deleted"}


# ===================== Topic Routes =====================

@api_router.get("/subjects/{subject_id}/topics")
async def get_topics(request: Request, subject_id: str):
    user = await get_current_user(request)
    subject = await db.subjects.find_one({"_id": to_oid(subject_id), "user_id": user["_id"]})
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    topics = await db.topics.find({"subject_id": subject_id}).to_list(1000)
    return [doc_to_dict(t) for t in topics]


@api_router.post("/subjects/{subject_id}/topics")
async def create_topic(request: Request, subject_id: str, body: TopicCreate):
    user = await get_current_user(request)
    subject = await db.subjects.find_one({"_id": to_oid(subject_id), "user_id": user["_id"]})
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    doc = {"subject_id": subject_id, "user_id": user["_id"], "name": body.name, "description": body.description, "notes": body.notes, "is_completed": False, "created_at": datetime.now(timezone.utc)}
    result = await db.topics.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc_to_dict(doc)


@api_router.put("/topics/{topic_id}")
async def update_topic(request: Request, topic_id: str, body: TopicUpdate):
    user = await get_current_user(request)
    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data")
    result = await db.topics.update_one({"_id": to_oid(topic_id), "user_id": user["_id"]}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Topic not found")
    topic = await db.topics.find_one({"_id": to_oid(topic_id)})
    return doc_to_dict(topic)


@api_router.patch("/topics/{topic_id}/toggle")
async def toggle_topic(request: Request, topic_id: str):
    user = await get_current_user(request)
    topic = await db.topics.find_one({"_id": to_oid(topic_id), "user_id": user["_id"]})
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    new_status = not topic.get("is_completed", False)
    await db.topics.update_one({"_id": to_oid(topic_id)}, {"$set": {"is_completed": new_status}})
    topic["is_completed"] = new_status
    return doc_to_dict(topic)


@api_router.delete("/topics/{topic_id}")
async def delete_topic(request: Request, topic_id: str):
    user = await get_current_user(request)
    result = await db.topics.delete_one({"_id": to_oid(topic_id), "user_id": user["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Topic not found")
    return {"message": "Topic deleted"}


# ===================== Study Session Routes =====================

async def enrich_session(s):
    d = doc_to_dict(s)
    if s.get("subject_id"):
        try:
            subject = await db.subjects.find_one({"_id": to_oid(s["subject_id"])})
            d["subject_name"] = subject.get("name", "") if subject else ""
            d["subject_color"] = subject.get("color", "#F97316") if subject else "#F97316"
        except Exception:
            d["subject_name"] = ""
            d["subject_color"] = "#F97316"
    else:
        d["subject_name"] = ""
        d["subject_color"] = "#F97316"
    return d


@api_router.get("/sessions")
async def get_sessions(request: Request, date: Optional[str] = None, status: Optional[str] = None):
    user = await get_current_user(request)
    query = {"user_id": user["_id"]}
    if date:
        query["scheduled_date"] = date
    if status:
        query["status"] = status
    sessions = await db.study_sessions.find(query).sort("scheduled_date", 1).to_list(1000)
    return [await enrich_session(s) for s in sessions]


@api_router.post("/sessions")
async def create_session(request: Request, body: StudySessionCreate):
    user = await get_current_user(request)
    doc = {"user_id": user["_id"], "subject_id": body.subject_id, "topic_id": body.topic_id, "title": body.title, "scheduled_date": body.scheduled_date, "scheduled_time": body.scheduled_time, "duration_minutes": body.duration_minutes, "status": "scheduled", "notes": body.notes, "created_at": datetime.now(timezone.utc)}
    result = await db.study_sessions.insert_one(doc)
    doc["_id"] = result.inserted_id
    return await enrich_session(doc)


@api_router.put("/sessions/{session_id}")
async def update_session(request: Request, session_id: str, body: StudySessionUpdate):
    user = await get_current_user(request)
    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data")
    result = await db.study_sessions.update_one({"_id": to_oid(session_id), "user_id": user["_id"]}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    session = await db.study_sessions.find_one({"_id": to_oid(session_id)})
    return await enrich_session(session)


@api_router.patch("/sessions/{session_id}/complete")
async def complete_session(request: Request, session_id: str):
    user = await get_current_user(request)
    session = await db.study_sessions.find_one({"_id": to_oid(session_id), "user_id": user["_id"]})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await db.study_sessions.update_one({"_id": to_oid(session_id)}, {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc)}})
    await db.users.update_one({"_id": ObjectId(user["_id"])}, {"$inc": {"total_study_minutes": session.get("duration_minutes", 0)}})
    await update_user_streak(user["_id"])
    session["status"] = "completed"
    return await enrich_session(session)


@api_router.delete("/sessions/{session_id}")
async def delete_session(request: Request, session_id: str):
    user = await get_current_user(request)
    result = await db.study_sessions.delete_one({"_id": to_oid(session_id), "user_id": user["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"message": "Session deleted"}


# ===================== Pomodoro Routes =====================

@api_router.post("/pomodoro/log")
async def log_pomodoro(request: Request, body: PomodoroLogCreate):
    user = await get_current_user(request)
    today = datetime.now(timezone.utc).date().isoformat()
    doc = {"user_id": user["_id"], "subject_id": body.subject_id, "pomodoros_completed": body.pomodoros_completed, "total_focus_minutes": body.total_focus_minutes, "date": today, "created_at": datetime.now(timezone.utc)}
    result = await db.pomodoro_logs.insert_one(doc)
    doc["_id"] = result.inserted_id
    await db.users.update_one({"_id": ObjectId(user["_id"])}, {"$inc": {"total_study_minutes": body.total_focus_minutes}})
    await update_user_streak(user["_id"])
    return doc_to_dict(doc)


@api_router.get("/pomodoro/stats")
async def get_pomodoro_stats(request: Request):
    user = await get_current_user(request)
    today = datetime.now(timezone.utc).date().isoformat()
    seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).date().isoformat()
    today_logs = await db.pomodoro_logs.find({"user_id": user["_id"], "date": today}).to_list(100)
    recent_logs = await db.pomodoro_logs.find({"user_id": user["_id"], "date": {"$gte": seven_days_ago}}).sort("date", -1).to_list(100)
    return {
        "today_pomodoros": sum(l.get("pomodoros_completed", 0) for l in today_logs),
        "today_minutes": sum(l.get("total_focus_minutes", 0) for l in today_logs),
        "recent_logs": [doc_to_dict(l) for l in recent_logs]
    }


# ===================== AI Study Plan Routes =====================

@api_router.post("/ai/generate-plan")
async def generate_ai_plan(request: Request, body: AIPlanRequest):
    user = await get_current_user(request)
    subjects_list = ", ".join(body.subjects) if body.subjects else "No specific subjects provided"
    prompt = f"""Create a detailed, personalized study plan for a student:

Goals: {body.goals}
Subjects: {subjects_list}
Daily study time: {body.study_hours_per_day} hours
Duration: {body.duration_weeks} weeks
Additional notes: {body.additional_notes or "None"}

Create a comprehensive study plan with:
1. Weekly schedule breakdown
2. Daily study topics and tasks
3. Specific focus areas for each subject
4. Recommended breaks and review sessions
5. Tips for staying motivated
6. Milestones and checkpoints

Format with markdown (## headers, bullet points, numbered lists). Be specific and actionable."""

    chat = LlmChat(
        api_key=os.environ.get("EMERGENT_LLM_KEY"),
        session_id=f"study-plan-{user['_id']}-{uuid.uuid4()}",
        system_message="You are an expert academic study planner and coach. Create detailed, personalized, and actionable study plans for students. Use markdown formatting."
    ).with_model("gemini", "gemini-3-flash-preview")

    plan_content = await chat.send_message(UserMessage(text=prompt))
    title = f"Study Plan: {body.goals[:50]}{'...' if len(body.goals) > 50 else ''}"
    doc = {"user_id": user["_id"], "title": title, "goals": body.goals, "subjects": body.subjects, "study_hours_per_day": body.study_hours_per_day, "duration_weeks": body.duration_weeks, "plan_content": plan_content, "created_at": datetime.now(timezone.utc)}
    result = await db.ai_plans.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc_to_dict(doc)


@api_router.get("/ai/plans")
async def get_ai_plans(request: Request):
    user = await get_current_user(request)
    plans = await db.ai_plans.find({"user_id": user["_id"]}).sort("created_at", -1).to_list(50)
    return [doc_to_dict(p) for p in plans]


@api_router.delete("/ai/plans/{plan_id}")
async def delete_ai_plan(request: Request, plan_id: str):
    user = await get_current_user(request)
    result = await db.ai_plans.delete_one({"_id": to_oid(plan_id), "user_id": user["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Plan not found")
    return {"message": "Plan deleted"}


# ===================== Dashboard Route =====================

@api_router.get("/dashboard")
async def get_dashboard(request: Request):
    user = await get_current_user(request)
    user_id = user["_id"]
    today = datetime.now(timezone.utc).date().isoformat()
    next_week = (datetime.now(timezone.utc) + timedelta(days=7)).date().isoformat()

    today_sessions = await db.study_sessions.find({"user_id": user_id, "scheduled_date": today}).to_list(100)
    upcoming = await db.study_sessions.find({"user_id": user_id, "scheduled_date": {"$gte": today, "$lte": next_week}, "status": "scheduled"}).sort("scheduled_date", 1).to_list(20)

    subjects = await db.subjects.find({"user_id": user_id}).to_list(100)
    subjects_progress = []
    for s in subjects:
        sid = str(s["_id"])
        tc = await db.topics.count_documents({"subject_id": sid})
        cc = await db.topics.count_documents({"subject_id": sid, "is_completed": True})
        d = doc_to_dict(s)
        d["topic_count"] = tc
        d["completed_topic_count"] = cc
        d["progress"] = int((cc / tc * 100) if tc > 0 else 0)
        subjects_progress.append(d)

    weekly_stats = []
    for i in range(6, -1, -1):
        day = (datetime.now(timezone.utc) - timedelta(days=i)).date()
        day_str = day.isoformat()
        pomodoros = await db.pomodoro_logs.find({"user_id": user_id, "date": day_str}).to_list(100)
        completed_sess = await db.study_sessions.find({"user_id": user_id, "scheduled_date": day_str, "status": "completed"}).to_list(100)
        focus_mins = sum(p.get("total_focus_minutes", 0) for p in pomodoros)
        sess_mins = sum(s.get("duration_minutes", 0) for s in completed_sess)
        weekly_stats.append({"date": day_str, "day": day.strftime("%a"), "sessions": len(completed_sess), "focus_minutes": focus_mins + sess_mins})

    full_user = await db.users.find_one({"_id": ObjectId(user_id)})
    return {
        "streak_count": full_user.get("streak_count", 0),
        "total_study_minutes": full_user.get("total_study_minutes", 0),
        "today_sessions": [await enrich_session(s) for s in today_sessions],
        "upcoming_sessions": [await enrich_session(s) for s in upcoming],
        "subjects_progress": subjects_progress,
        "weekly_stats": weekly_stats
    }


# ===================== Helper Functions =====================

async def update_user_streak(user_id: str):
    today = datetime.now(timezone.utc).date().isoformat()
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).date().isoformat()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    last_study_date = user.get("last_study_date")
    current_streak = user.get("streak_count", 0)
    if last_study_date == today:
        return
    elif last_study_date == yesterday:
        new_streak = current_streak + 1
    else:
        new_streak = 1
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"streak_count": new_streak, "last_study_date": today}})


async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@smartplanner.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({"email": admin_email, "name": "Admin", "password_hash": hash_password(admin_password), "role": "admin", "streak_count": 0, "last_study_date": None, "total_study_minutes": 0, "created_at": datetime.now(timezone.utc)})
    elif not verify_password(admin_password, existing.get("password_hash", "")):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})

    # Write credentials
    creds_path = Path("/app/memory/test_credentials.md")
    creds_path.parent.mkdir(parents=True, exist_ok=True)
    creds_path.write_text(f"""# Test Credentials

## Admin Account
- Email: {admin_email}
- Password: {admin_password}
- Role: admin

## Test User
- Register a new account at /login (Register tab)
- Email: testuser@example.com
- Password: testpass123

## Auth Endpoints
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me
- POST /api/auth/refresh
""")


@app.on_event("startup")
async def startup_event():
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.study_sessions.create_index([("user_id", 1), ("scheduled_date", 1)])
    await db.topics.create_index("subject_id")
    await seed_admin()
    logger.info("Smart Study Planner API started successfully")


@app.on_event("shutdown")
async def shutdown_db_client():
    mongo_client.close()


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        os.environ.get("FRONTEND_URL", "http://localhost:3000"),
        "http://localhost:3000",
        "https://smart-learner-50.preview.emergentagent.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
