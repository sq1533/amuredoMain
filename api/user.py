from fastapi import APIRouter, Request, Form, UploadFile, File, HTTPException, Response
from firebase_admin import firestore
import requests
import os
import re
import json
import bcrypt

router = APIRouter()

# 텔레그램 설정 로드 (database/telegram.json)
TELEGRAM_BOT_TOKEN = None
TELEGRAM_CHAT_ID = None

telegram_config_path = os.path.join(os.path.dirname(__file__), "..", "database", "telegram.json")
try:
    if os.path.exists(telegram_config_path):
        with open(telegram_config_path, "r", encoding="utf-8") as f:
            telegram_data = json.load(f)
            TELEGRAM_BOT_TOKEN = telegram_data.get("bot_token")
            TELEGRAM_CHAT_ID = telegram_data.get("user_request_id")
except Exception as e:
    print(f"🔥 텔레그램 설정 파일 로드 에러: {e}")

def get_password_hash(password: str) -> str:
    # bcrypt는 바이트 문자열을 사용하므로 인코딩 후 해싱, DB 저장을 위해 다시 디코딩합니다.
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

@router.post("/register")
async def register_wholesale(
    name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    business_number: str = Form(...),
    business_license: UploadFile = File(...)
):
    try:
        # 백엔드 보안 검증 1: 비밀번호 화이트리스트 및 길이 검사 (정규식)
        pwd_regex = r"^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*]{6,12}$"
        if not re.match(pwd_regex, password):
            return {"status": "error", "message": "비밀번호는 영문, 숫자가 포함된 6~12자리여야 하며, 특수문자는 !@#$%^&*만 허용됩니다."}

        # 백엔드 보안 검증 2: 사업자 등록 번호 10자리 숫자 검증
        if not re.match(r"^\d{10}$", business_number):
            return {"status": "error", "message": "사업자 등록 번호는 하이픈을 제외한 10자리 숫자여야 합니다."}

        # 백엔드 보안 검증 2: 파일 용량 검사 (5MB = 5 * 1024 * 1024)
        business_license.file.seek(0, 2) # 파일 끝으로 이동
        file_size = business_license.file.tell() # 현재 위치(크기) 얻기
        business_license.file.seek(0) # 다시 처음으로 이동
        if file_size > 5 * 1024 * 1024:
            return {"status": "error", "message": "5MB 이하의 이미지만 첨부 가능합니다."}

        # DB 호출 지연 (서버 초기화 완료 후 요청 시점에만 호출됨)
        db = firestore.client()
        
        # 1. 중복 이메일 체크
        user_ref = db.collection('wholesale_users').document(email)
        if user_ref.get().exists:
            return {"status": "error", "message": "이미 등록된 이메일입니다."}

        # 2. 유저 정보 저장 (status: pending)
        hashed_password = get_password_hash(password)
        user_data = {
            "name": name,
            "email": email,
            "password": hashed_password,
            "business_number": business_number,
            "status": "pending", # 승인 대기 상태
            "created_at": firestore.SERVER_TIMESTAMP
        }
        user_ref.set(user_data)

        # 3. 텔레그램 관리자 알림 전송
        message = (
            f"🔔 [도매 가입 신청 알림]\n\n"
            f"👤 대표자명: {name}\n"
            f"📧 이메일: {email}\n"
            f"🏢 사업자번호: {business_number}\n\n"
            f"위 정보를 확인 후 관리자 페이지에서 승인 처리를 진행해 주세요."
        )
        
        # 텍스트 메시지 전송
        requests.post(
            f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
            json={"chat_id": TELEGRAM_CHAT_ID, "text": message}
        )

        # 사업자 등록증 이미지 전송
        files = {"photo": (business_license.filename, await business_license.read(), business_license.content_type)}
        requests.post(
            f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendPhoto",
            data={"chat_id": TELEGRAM_CHAT_ID},
            files=files
        )

        return {"status": "success", "message": "가입 신청이 완료되었습니다. 관리자 승인 후 이용 가능합니다."}

    except Exception as e:
        print(f"🔥 도매 회원가입 중 에러: {e}")
        return {"status": "error", "message": str(e)}

@router.get("/status")
async def check_wholesale_status(request: Request):
    """
    모든 페이지에서 비동기로 로그인 상태를 확인하기 위한 가벼운 API
    (DB 통신 없이 세션 쿠키만 복호화하므로 서버 부하 제로)
    """
    user_role = request.session.get("user_role", "guest")
    is_wholesale = (user_role == "wholesale")
    user_name = request.session.get("user_name", "")
    user_email = request.session.get("user_id", "")
    return {
        "user_role": user_role,
        "is_wholesale": is_wholesale,
        "user_name": user_name,
        "user_email": user_email
    }

@router.post("/login")
async def login_wholesale(
    request: Request,
    response: Response,
    email: str = Form(...),
    password: str = Form(...)
):
    try:
        # DB 호출 지연
        db = firestore.client()
        
        user_ref = db.collection('wholesale_users').document(email)
        user_doc = user_ref.get()

        if not user_doc.exists:
            return {"status": "error", "message": "가입되지 않은 이메일입니다."}

        user_data = user_doc.to_dict()

        # 1. 승인 여부 및 상태별 메시지 처리
        user_status = user_data.get("status")
        if user_status == "pending":
            return {"status": "error", "message": "관리자 승인 대기중입니다."}
        elif user_status == "rejected":
            return {"status": "error", "message": "관리자가 가입을 거절했습니다. 이메일을 확인해주세요."}
        elif user_status != "approved":
            # 만약 알 수 없는 상태값이 들어있을 경우의 방어 로직
            return {"status": "error", "message": "현재 계정을 사용할 수 없는 상태입니다."}

        # 2. 비밀번호 체크 (순수 bcrypt 사용)
        db_password = user_data.get("password", "")
        # 입력된 비밀번호와 DB의 해시를 바이트로 변환하여 비교
        if not bcrypt.checkpw(password.encode('utf-8'), db_password.encode('utf-8')):
            return {"status": "error", "message": "비밀번호가 일치하지 않습니다."}

        # 3. 세션 기록
        request.session["user_id"] = email
        request.session["user_name"] = user_data.get("name")
        request.session["user_role"] = "wholesale"
        request.session["is_wholesale"] = True

        # 하이브리드 캐싱을 위한 비보안 등급 식별 쿠키 굽기 (유효기간 30일)
        response.set_cookie(key="amuredo_role", value="wholesale", path="/", max_age=2592000)

        return {"status": "success", "message": f"{user_data.get('name')}님, 환영합니다."}

    except Exception as e:
        print(f"🔥 도매 로그인 중 에러: {e}")
        return {"status": "error", "message": str(e)}

@router.get("/logout")
async def logout_wholesale(request: Request, response: Response):
    request.session.clear()
    response.delete_cookie(key="amuredo_role", path="/")
    return {"status": "success", "message": "로그아웃 되었습니다."}

# 회원 정보 조회 (마이페이지용)
@router.get("/me")
async def get_my_info(request: Request):
    try:
        email = request.session.get("user_id")
        if not email or not request.session.get("is_wholesale"):
            return {"status": "error", "message": "로그인이 필요합니다."}
            
        db = firestore.client()
        user_doc = db.collection('wholesale_users').document(email).get()
        if not user_doc.exists:
            return {"status": "error", "message": "사용자 정보를 찾을 수 없습니다."}
            
        user_data = user_doc.to_dict()
        return {
            "status": "success", 
            "user": {
                "name": user_data.get("name"),
                "email": user_data.get("email"),
                "business_number": user_data.get("business_number")
            }
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

# 비밀번호 변경 API
@router.post("/change_password")
async def change_password(
    request: Request,
    current_password: str = Form(...),
    new_password: str = Form(...)
):
    try:
        email = request.session.get("user_id")
        if not email or not request.session.get("is_wholesale"):
            return {"status": "error", "message": "로그인이 필요합니다."}

        db = firestore.client()
        user_ref = db.collection('wholesale_users').document(email)
        user_doc = user_ref.get()
        if not user_doc.exists:
            return {"status": "error", "message": "사용자 정보를 찾을 수 없습니다."}
            
        user_data = user_doc.to_dict()
        db_password = user_data.get("password", "")

        # 1. 현재 비밀번호 검증
        if not bcrypt.checkpw(current_password.encode('utf-8'), db_password.encode('utf-8')):
            return {"status": "error", "message": "현재 비밀번호가 일치하지 않습니다."}

        # 2. 새 비밀번호 화이트리스트 검증
        pwd_regex = r"^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*]{6,12}$"
        if not re.match(pwd_regex, new_password):
            return {"status": "error", "message": "새 비밀번호 규칙을 확인해 주세요."}

        # 3. 새 비밀번호 해싱 후 업데이트
        hashed_new_pwd = get_password_hash(new_password)
        user_ref.update({"password": hashed_new_pwd})
        
        return {"status": "success", "message": "비밀번호가 성공적으로 변경되었습니다."}
        
    except Exception as e:
        return {"status": "error", "message": str(e)}
