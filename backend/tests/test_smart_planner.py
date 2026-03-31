"""Backend tests for Smart Study Planner API"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Shared session with cookies
@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s

@pytest.fixture(scope="module")
def registered_user(session):
    """Register test user (or use existing)"""
    r = session.post(f"{BASE_URL}/api/auth/register", json={
        "email": "testuser@example.com",
        "name": "Test User",
        "password": "testpass123"
    })
    if r.status_code == 400 and "already registered" in r.text:
        # Login instead
        r2 = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "testuser@example.com",
            "password": "testpass123"
        })
        assert r2.status_code == 200, f"Login failed: {r2.text}"
        return r2.json()
    assert r.status_code == 200, f"Register failed: {r.text}"
    return r.json()

@pytest.fixture(scope="module")
def admin_session():
    """Admin session"""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@smartplanner.com",
        "password": "admin123"
    })
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    return s

# ===== Auth Tests =====

class TestAuth:
    """Auth endpoint tests"""

    def test_register_duplicate(self, session, registered_user):
        """Duplicate registration returns 400"""
        r = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": "testuser@example.com",
            "name": "Test User",
            "password": "testpass123"
        })
        assert r.status_code == 400

    def test_login_admin(self):
        """Admin can login"""
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@smartplanner.com",
            "password": "admin123"
        })
        assert r.status_code == 200
        data = r.json()
        assert "email" in data
        assert data["email"] == "admin@smartplanner.com"
        print(f"Admin login OK: {data['name']}")

    def test_login_invalid(self):
        """Invalid credentials returns 401"""
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpass"
        })
        assert r.status_code == 401

    def test_get_me(self, session, registered_user):
        """Authenticated user can get their profile"""
        r = session.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        data = r.json()
        assert "email" in data
        print(f"Get me: {data['email']}")

    def test_refresh_token(self, session, registered_user):
        """Token refresh works"""
        r = session.post(f"{BASE_URL}/api/auth/refresh")
        assert r.status_code == 200

# ===== Subject Tests =====

class TestSubjects:
    """Subject CRUD tests"""

    def test_create_subject(self, session, registered_user):
        r = session.post(f"{BASE_URL}/api/subjects", json={
            "name": "TEST_Mathematics",
            "color": "#F97316",
            "description": "Math subject"
        })
        assert r.status_code == 200
        data = r.json()
        assert data["name"] == "TEST_Mathematics"
        assert "id" in data
        print(f"Subject created: {data['id']}")
        return data["id"]

    def test_get_subjects(self, session, registered_user):
        r = session.get(f"{BASE_URL}/api/subjects")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        print(f"Subjects count: {len(data)}")

    def test_subject_has_topic_counts(self, session, registered_user):
        r = session.get(f"{BASE_URL}/api/subjects")
        assert r.status_code == 200
        if r.json():
            s = r.json()[0]
            assert "topic_count" in s
            assert "completed_topic_count" in s

# ===== Topics Tests =====

class TestTopics:
    """Topic CRUD tests"""

    @pytest.fixture(autouse=True)
    def subject_id(self, session, registered_user):
        r = session.post(f"{BASE_URL}/api/subjects", json={
            "name": "TEST_TopicSubject",
            "color": "#3B82F6"
        })
        assert r.status_code == 200
        self._subject_id = r.json()["id"]

    def test_create_topic(self, session, registered_user):
        r = session.post(f"{BASE_URL}/api/subjects/{self._subject_id}/topics", json={
            "name": "TEST_Algebra",
            "description": "Algebra basics"
        })
        assert r.status_code == 200
        data = r.json()
        assert data["name"] == "TEST_Algebra"
        assert data["is_completed"] == False

    def test_toggle_topic(self, session, registered_user):
        r = session.post(f"{BASE_URL}/api/subjects/{self._subject_id}/topics", json={
            "name": "TEST_Calculus"
        })
        topic_id = r.json()["id"]
        # Toggle on
        r2 = session.patch(f"{BASE_URL}/api/topics/{topic_id}/toggle")
        assert r2.status_code == 200
        assert r2.json()["is_completed"] == True
        # Toggle off
        r3 = session.patch(f"{BASE_URL}/api/topics/{topic_id}/toggle")
        assert r3.status_code == 200
        assert r3.json()["is_completed"] == False

# ===== Study Sessions Tests =====

class TestSessions:
    """Study session CRUD tests"""

    @pytest.fixture(autouse=True)
    def setup(self, session, registered_user):
        r = session.post(f"{BASE_URL}/api/subjects", json={"name": "TEST_SessionSubject", "color": "#10B981"})
        assert r.status_code == 200
        self._subject_id = r.json()["id"]

    def test_create_session(self, session, registered_user):
        r = session.post(f"{BASE_URL}/api/sessions", json={
            "subject_id": self._subject_id,
            "title": "TEST_Math Study",
            "scheduled_date": "2026-03-01",
            "scheduled_time": "10:00",
            "duration_minutes": 60
        })
        assert r.status_code == 200
        data = r.json()
        assert data["title"] == "TEST_Math Study"
        assert data["status"] == "scheduled"
        print(f"Session created: {data['id']}")

    def test_get_sessions(self, session, registered_user):
        r = session.get(f"{BASE_URL}/api/sessions")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_session_with_date_filter(self, session, registered_user):
        r = session.get(f"{BASE_URL}/api/sessions?date=2026-03-01")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

# ===== Dashboard Tests =====

class TestDashboard:
    """Dashboard endpoint"""

    def test_dashboard_structure(self, session, registered_user):
        r = session.get(f"{BASE_URL}/api/dashboard")
        assert r.status_code == 200
        data = r.json()
        assert "streak_count" in data
        assert "total_study_minutes" in data
        assert "today_sessions" in data
        assert "weekly_stats" in data
        assert "subjects_progress" in data
        assert len(data["weekly_stats"]) == 7
        print(f"Dashboard OK: streak={data['streak_count']}")

# ===== Pomodoro Tests =====

class TestPomodoro:
    """Pomodoro endpoints"""

    def test_log_pomodoro(self, session, registered_user):
        r = session.post(f"{BASE_URL}/api/pomodoro/log", json={
            "pomodoros_completed": 2,
            "total_focus_minutes": 50
        })
        assert r.status_code == 200
        data = r.json()
        assert data["pomodoros_completed"] == 2

    def test_get_pomodoro_stats(self, session, registered_user):
        r = session.get(f"{BASE_URL}/api/pomodoro/stats")
        assert r.status_code == 200
        data = r.json()
        assert "today_pomodoros" in data
        assert "today_minutes" in data
        assert "recent_logs" in data

# ===== Brute Force Lockout Test =====

class TestBruteForce:
    """Brute force lockout after 5 fails"""

    def test_lockout_after_5_fails(self):
        s = requests.Session()
        # We don't want to actually lockout real test users. Use a unique email
        for i in range(5):
            r = s.post(f"{BASE_URL}/api/auth/login", json={
                "email": "bruteforce_test@nonexistent.com",
                "password": f"wrongpass{i}"
            })
            assert r.status_code == 401, f"Expected 401, got {r.status_code}"
        # 6th attempt should be locked out
        r = s.post(f"{BASE_URL}/api/auth/login", json={
            "email": "bruteforce_test@nonexistent.com",
            "password": "wrongpass6"
        })
        assert r.status_code == 429, f"Expected 429 lockout, got {r.status_code}: {r.text}"
        print("Brute force lockout working correctly")

# ===== Logout Test =====

class TestLogout:
    def test_logout(self, session, registered_user):
        r = session.post(f"{BASE_URL}/api/auth/logout")
        assert r.status_code == 200
