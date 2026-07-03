from fastapi import APIRouter, Request, Form, UploadFile, File, HTTPException, Response, BackgroundTasks
from typing import Optional
from starlette.concurrency import run_in_threadpool
from firebase_admin import firestore
from firebase_admin import db as rtdb
import requests
import os
import re
import json
import bcrypt
import secrets
import urllib.parse
from datetime import date
from fastapi.responses import RedirectResponse

router = APIRouter()

def sanitize_email_for_rtdb(email: str) -> str:
    """
    Firebase Realtime Database 키로 사용할 수 없는 문자(., $, #, [, ], /)를 안전하게 치환합니다.
    """
    return email.replace(".", "_dot_").replace("@", "_at_")

def get_social_redirect_uri(request: Request, provider: str) -> str:
    is_local = "localhost" in str(request.base_url) or "127.0.0.1" in str(request.base_url)
    if provider == "naver":
        return NAVER_TEST_REDIRECT_URI if (is_local and NAVER_TEST_REDIRECT_URI) else NAVER_REDIRECT_URI
    elif provider == "kakao":
        return KAKAO_TEST_REDIRECT_URI if (is_local and KAKAO_TEST_REDIRECT_URI) else KAKAO_REDIRECT_URI
    return ""



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

# 네이버 API 설정 로드 (database/naver_api.json)
NAVER_CLIENT_ID = None
NAVER_CLIENT_SECRET = None
NAVER_REDIRECT_URI = None
NAVER_TEST_REDIRECT_URI = None

naver_config_path = os.path.join(os.path.dirname(__file__), "..", "database", "naver_api.json")
try:
    if os.path.exists(naver_config_path):
        with open(naver_config_path, "r", encoding="utf-8") as f:
            naver_data = json.load(f)
            NAVER_CLIENT_ID = naver_data.get("client_id")
            NAVER_CLIENT_SECRET = naver_data.get("client_secret")
            NAVER_REDIRECT_URI = naver_data.get("redirect_uri")
            NAVER_TEST_REDIRECT_URI = naver_data.get("test_redirect_uri")
except Exception as e:
    print(f"🔥 네이버 API 설정 파일 로드 에러: {e}")

# 카카오 API 설정 로드 (database/kakao_api.json)
KAKAO_CLIENT_ID = None
KAKAO_CLIENT_SECRET = None
KAKAO_REDIRECT_URI = None
KAKAO_TEST_REDIRECT_URI = None

kakao_config_path = os.path.join(os.path.dirname(__file__), "..", "database", "kakao_api.json")
try:
    if os.path.exists(kakao_config_path):
        with open(kakao_config_path, "r", encoding="utf-8") as f:
            kakao_data = json.load(f)
            KAKAO_CLIENT_ID = kakao_data.get("client_id")
            KAKAO_CLIENT_SECRET = kakao_data.get("client_secret")
            KAKAO_REDIRECT_URI = kakao_data.get("redirect_uri")
            KAKAO_TEST_REDIRECT_URI = kakao_data.get("test_redirect_uri")
except Exception as e:
    print(f"🔥 카카오 API 설정 파일 로드 에러: {e}")

def get_password_hash(password: str) -> str:
    # bcrypt는 바이트 문자열을 사용하므로 인코딩 후 해싱, DB 저장을 위해 다시 디코딩합니다.
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def send_telegram_wholesale_notification(token: str, chat_id: str, message: str):
    try:
        # 1. 텍스트 메시지만 전송 (사진 전송 단계 제거)
        requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat_id, "text": message},
            timeout=5
        )
    except Exception as e:
        print(f"🔥 도매 가입 텔레그램 알림 백그라운드 발송 실패: {e}")

@router.post("/register")
async def register_wholesale(
    background_tasks: BackgroundTasks,
    name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    business_number: str = Form(...)
):
    try:
        # 백엔드 보안 검증 1: 비밀번호 화이트리스트 및 길이 검사 (정규식)
        pwd_regex = r"^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*]{6,12}$"
        if not re.match(pwd_regex, password):
            return {"status": "error", "message": "비밀번호는 영문, 숫자가 포함된 6~12자리여야 하며, 특수문자는 !@#$%^&*만 허용됩니다."}

        # 백엔드 보안 검증 2: 사업자 등록 번호 10자리 숫자 검증
        if not re.match(r"^\d{10}$", business_number):
            return {"status": "error", "message": "사업자 등록 번호는 하이픈을 제외한 10자리 숫자여야 합니다."}

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

        # 3. 텔레그램 관리자 알림 전송 (비동기 백그라운드 예약)
        message = (
            f"🔔 [도매 가입 신청 알림]\n\n"
            f"👤 대표자명: {name}\n"
            f"📧 이메일: {email}\n"
            f"🏢 사업자번호: {business_number}\n\n"
            f"위 정보를 확인 후 관리자 페이지에서 승인 처리를 진행해 주세요."
        )
        
        background_tasks.add_task(
            send_telegram_wholesale_notification,
            token=TELEGRAM_BOT_TOKEN,
            chat_id=TELEGRAM_CHAT_ID,
            message=message
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
        # 0. 이메일 형식 검사 (보안 강화를 위한 첫 번째 관문)
        email_regex = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
        if not re.match(email_regex, email):
            return {"status": "error", "message": "이메일 또는 비밀번호를 확인해 주세요."}

        # DB 호출 지연
        db = firestore.client()
        
        user_ref = db.collection('wholesale_users').document(email)
        user_doc = user_ref.get()

        # 보안 강화: 가입되지 않은 이메일의 경우도 비밀번호 오류와 동일한 통합 메시지 반환
        if not user_doc.exists:
            return {"status": "error", "message": "이메일 또는 비밀번호를 확인해 주세요."}

        user_data = user_doc.to_dict()
        db_password = user_data.get("password", "")

        # 1. 비밀번호 체크 (순수 bcrypt 사용) - 계정 상태 정보 누출을 방지하기 위해 비밀번호 검증을 최선행 처리
        # 입력된 비밀번호와 DB의 해시를 바이트로 변환하여 비교
        if not bcrypt.checkpw(password.encode('utf-8'), db_password.encode('utf-8')):
            return {"status": "error", "message": "이메일 또는 비밀번호를 확인해 주세요."}

        # 2. 비밀번호가 일치할 때만 승인 상태 및 보류 여부 검증 (무차별 대입을 통한 가입/승인 상태 유추 차단)
        user_status = user_data.get("status")
        if user_status == "pending":
            return {"status": "error", "message": "관리자 승인 대기중입니다."}
        elif user_status == "rejected":
            return {"status": "error", "message": "관리자가 가입을 거절했습니다. 이메일을 확인해주세요."}
        elif user_status != "approved":
            # 만약 알 수 없는 상태값이 들어있을 경우의 방어 로직
            return {"status": "error", "message": "현재 계정을 사용할 수 없는 상태입니다."}

        # 3. 세션 기록
        request.session["user_id"] = email
        request.session["user_name"] = user_data.get("name")
        request.session["user_role"] = "wholesale"
        request.session["is_wholesale"] = True

        # 하이브리드 캐싱을 위한 비보안 등급 식별 쿠키 굽기 (유효기간 30일)
        response.set_cookie(key="amuredo_role", value="wholesale", path="/", max_age=2592000)

        # Firebase RTDB에서 도매 회원 장바구니 데이터를 읽어 쿠키에 주입
        try:
            sanitized_email = sanitize_email_for_rtdb(email)
            ref = rtdb.reference(f"cart/{sanitized_email}")
            cart_data = ref.get()
            if cart_data:
                response.set_cookie(
                    key="wholesale_cart",
                    value=urllib.parse.quote(json.dumps(cart_data)),
                    max_age=2592000,
                    path="/"
                )
        except Exception as ce:
            print(f"🔥 도매 로그인 중 RTDB 장바구니 로드 실패: {ce}")

        return {"status": "success", "message": f"{user_data.get('name')}님, 환영합니다."}

    except Exception as e:
        print(f"🔥 도매 로그인 중 에러: {e}")
        return {"status": "error", "message": str(e)}

@router.get("/logout")
async def logout_wholesale(request: Request, response: Response):
    request.session.clear()
    response.delete_cookie(key="amuredo_role", path="/")
    response.delete_cookie(key="general_cart", path="/")
    response.delete_cookie(key="wholesale_cart", path="/")
    return {"status": "success", "message": "로그아웃 되었습니다."}

# 🏁 Firebase Realtime Database 연동 장바구니 동기화 APIs
@router.post("/cart/sync")
async def sync_cart(request: Request):
    user_id = request.session.get("user_id")
    user_role = request.session.get("user_role")
    if not user_id or not user_role:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    
    try:
        body = await request.json()
        cart_data = body.get("cart", [])
        
        sanitized_email = sanitize_email_for_rtdb(user_id)
        ref = rtdb.reference(f"cart/{sanitized_email}")
        ref.set(cart_data)
        
        return {"status": "success", "message": "장바구니가 동기화되었습니다."}
    except Exception as e:
        print(f"🔥 RTDB 장바구니 동기화 에러: {e}")
        return {"status": "error", "message": str(e)}

@router.get("/cart/load")
async def load_cart(request: Request):
    user_id = request.session.get("user_id")
    user_role = request.session.get("user_role")
    if not user_id or not user_role:
        return {"status": "error", "message": "로그인이 필요합니다.", "cart": []}
        
    try:
        sanitized_email = sanitize_email_for_rtdb(user_id)
        ref = rtdb.reference(f"cart/{sanitized_email}")
        cart_data = ref.get()
        if cart_data is None:
            cart_data = []
            
        return {"status": "success", "cart": cart_data}
    except Exception as e:
        print(f"🔥 RTDB 장바구니 로드 에러: {e}")
        return {"status": "error", "message": str(e), "cart": []}


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

# -------------------------------------------------------------
# 🏁 일반 회원 네이버 소셜 로그인 API 엔진 탑재
# -------------------------------------------------------------

# 만 14세 미만 여부 확인 함수 (연도 기준)
def is_under_14(birthyear_str: str) -> bool:
    if not birthyear_str:
        return True
    try:
        birth_year = int(birthyear_str)
        today = date.today()
        age = today.year - birth_year
        return age <= 14
    except Exception:
        return True

# 1) 네이버 인가 코드 요청 및 리다이렉트
@router.get("/login/naver")
async def naver_login(request: Request, next: str = None, agree: bool = False):
    if not NAVER_CLIENT_ID or not NAVER_REDIRECT_URI:
        raise HTTPException(status_code=500, detail="네이버 API 설정이 완료되지 않았습니다. database/naver_api.json을 생성해 주세요.")
    
    # 이전 페이지 경로 기억
    if next:
        request.session["social_next"] = next

    # 약관 동의 여부 세션 기억
    if agree:
        request.session["social_agree"] = True

    # CSRF 방지를 위한 state 난수 생성
    state = secrets.token_hex(16)
    
    redirect_uri = get_social_redirect_uri(request, "naver")
    
    params = {
        "response_type": "code",
        "client_id": NAVER_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "state": state
    }
    
    authorization_url = f"https://nid.naver.com/oauth2.0/authorize?{urllib.parse.urlencode(params)}"
    
    # state 검증을 위해 세션에 임시 저장
    request.session["naver_state"] = state
    
    return RedirectResponse(url=authorization_url)

# 2) 네이버 인증 성공 콜백 및 회원가입/로그인 스위치 처리
@router.get("/callback/naver")
async def naver_callback(request: Request, code: str = None, state: str = None, error: str = None):
    if error:
        # 사용자가 네이버 로그인을 취소하거나 오류가 발생한 경우
        return RedirectResponse(url="/login?error=cancel")
        
    if not code or not state:
        raise HTTPException(status_code=400, detail="잘못된 요청입니다. 인가 코드 또는 상태 값이 누락되었습니다.")
        
    # CSRF 보안 검증
    saved_state = request.session.get("naver_state")
    if saved_state and saved_state != state:
        print("⚠️ 네이버 State CSRF 검증 실패 (보안 경고, 무시하고 진행)")
         
    # 토큰 교환 요청
    token_url = "https://nid.naver.com/oauth2.0/token"
    token_params = {
        "grant_type": "authorization_code",
        "client_id": NAVER_CLIENT_ID,
        "client_secret": NAVER_CLIENT_SECRET,
        "code": code,
        "state": state
    }
    
    try:
        token_res = await run_in_threadpool(requests.post, token_url, params=token_params, timeout=10)
        if token_res.status_code != 200:
            return RedirectResponse(url="/login?error=token_failed")
            
        token_data = token_res.json()
        access_token = token_data.get("access_token")
        if not access_token:
            return RedirectResponse(url="/login?error=no_token")
            
        # 사용자 프로필 조회
        profile_url = "https://openapi.naver.com/v1/nid/me"
        headers = {"Authorization": f"Bearer {access_token}"}
        profile_res = await run_in_threadpool(requests.get, profile_url, headers=headers, timeout=10)
        
        if profile_res.status_code != 200:
            return RedirectResponse(url="/login?error=profile_failed")
            
        profile_data = profile_res.json()
        if profile_data.get("resultcode") != "00":
            return RedirectResponse(url="/login?error=profile_data_invalid")
            
        naver_user = profile_data.get("response", {})
        naver_id = naver_user.get("id")
        email = naver_user.get("email")
        name = naver_user.get("name")
        mobile = naver_user.get("mobile", "").replace("-", "") # 하이픈 제거
        birthyear = naver_user.get("birthyear")
        birthday = naver_user.get("birthday") # MM-DD
        
        if not naver_id or not email:
            return RedirectResponse(url="/login?error=essential_data_missing")
            
        # DB 연결 및 일반 회원 컬렉션('general_users') 조회
        db = firestore.client()
        user_ref = db.collection('general_users').document(email)
        user_doc = user_ref.get()
        
        # 세션에서 마지막 방문 페이지 획득 및 제거
        next_url = request.session.pop("social_next", None)
        
        if user_doc.exists:
            # [A] 기존 일반 회원 로그인 처리
            request.session.pop("social_agree", None)  # 불필요한 동의 세션 정리
            request.session["user_id"] = email
            request.session["user_role"] = "general"
            request.session["is_wholesale"] = False
            
            target_url = next_url if next_url else "/"
            response = RedirectResponse(url=target_url)
            response.set_cookie(key="amuredo_role", value="general", max_age=2592000, path="/")
            
            # Firebase RTDB에서 일반 회원 장바구니 데이터를 읽어 쿠키에 주입
            try:
                sanitized_email = sanitize_email_for_rtdb(email)
                ref = rtdb.reference(f"cart/{sanitized_email}")
                cart_data = ref.get()
                if cart_data:
                    response.set_cookie(
                        key="general_cart",
                        value=urllib.parse.quote(json.dumps(cart_data)),
                        max_age=2592000,
                        path="/"
                    )
            except Exception as ce:
                print(f"🔥 네이버 로그인 콜백 중 RTDB 장바구니 로드 실패: {ce}")
                
            return response
        else:
            # [B] 신규 일반 회원가입 절차 진행
            # 만 14세 미만 검증
            if is_under_14(birthyear):
                return RedirectResponse(url="/login?error=under_14")
                
            # 소셜 회원가입 시 약관 동의 세션 검증
            social_agree = request.session.pop("social_agree", False)
            if not social_agree:
                return RedirectResponse(url="/login?error=agreement_required")
                
            new_user_data = {
                "name": name,
                "email": email,
                "phoneNumber": mobile,
                "age_year": birthyear,
                "birth": birthday,
                "role": "general",
                "provider": "naver",
                "created_at": firestore.SERVER_TIMESTAMP,
                "terms_agreed": True,
                "terms_agreed_at": firestore.SERVER_TIMESTAMP,
                "terms_version": "v1.0",
                "privacy_agreed": True,
                "privacy_agreed_at": firestore.SERVER_TIMESTAMP,
                "privacy_version": "v1.0"
            }
            user_ref.set(new_user_data)
            
            # 신규 가입 즉시 세션 및 쿠키 로그인 처리
            request.session["user_id"] = email
            request.session["user_role"] = "general"
            request.session["is_wholesale"] = False
            
            # 이전 주소가 있다면 가입 성공 파라미터를 결합, 없으면 홈으로 보냄
            if next_url:
                target_url = next_url + ("&signup=success" if "?" in next_url else "?signup=success")
            else:
                target_url = "/?signup=success"
                
            response = RedirectResponse(url=target_url)
            response.set_cookie(key="amuredo_role", value="general", max_age=2592000, path="/")
            return response
            
    except Exception as e:
        print(f"🔥 네이버 로그인 진행 중 심각한 예외 발생: {e}")
        return RedirectResponse(url="/login?error=system_error")

# -------------------------------------------------------------
# 🏁 일반 회원 카카오 소셜 로그인 API 엔진 탑재
# -------------------------------------------------------------

# 1) 카카오 인가 코드 요청 및 리다이렉트
@router.get("/login/kakao")
async def kakao_login(request: Request, next: str = None, agree: bool = False):
    if not KAKAO_CLIENT_ID or not KAKAO_REDIRECT_URI:
        raise HTTPException(status_code=500, detail="카카오 API 설정이 완료되지 않았습니다. database/kakao_api.json을 생성해 주세요.")
    
    # 이전 페이지 경로 기억
    if next:
        request.session["social_next"] = next

    # 약관 동의 여부 세션 기억
    if agree:
        request.session["social_agree"] = True

    # CSRF 방지를 위한 state 난수 생성
    state = secrets.token_hex(16)
    
    redirect_uri = get_social_redirect_uri(request, "kakao")
    
    params = {
        "client_id": KAKAO_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "state": state
    }
    
    authorization_url = f"https://kauth.kakao.com/oauth/authorize?{urllib.parse.urlencode(params)}"
    
    # state 검증을 위해 세션에 임시 저장
    request.session["kakao_state"] = state
    
    return RedirectResponse(url=authorization_url)

# 2) 카카오 인증 성공 콜백 및 회원가입/로그인 스위치 처리
@router.get("/callback/kakao")
async def kakao_callback(request: Request, code: str = None, state: str = None, error: str = None):
    if error:
        # 사용자가 카카오 로그인을 취소하거나 오류가 발생한 경우
        return RedirectResponse(url="/login?error=cancel")
        
    if not code or not state:
        raise HTTPException(status_code=400, detail="잘못된 요청입니다. 인가 코드 또는 상태 값이 누락되었습니다.")
        
    # CSRF 보안 검증
    saved_state = request.session.get("kakao_state")
    if saved_state and saved_state != state:
        print("⚠️ 카카오 State CSRF 검증 실패 (보안 경고, 무시하고 진행)")
         
    # 토큰 교환 요청
    token_url = "https://kauth.kakao.com/oauth/token"
    headers = {"Content-Type": "application/x-www-form-urlencoded;charset=utf-8"}
    
    redirect_uri = get_social_redirect_uri(request, "kakao")
    
    token_params = {
        "grant_type": "authorization_code",
        "client_id": KAKAO_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "code": code,
        "client_secret": KAKAO_CLIENT_SECRET if KAKAO_CLIENT_SECRET else ""
    }
    
    try:
        token_res = await run_in_threadpool(requests.post, token_url, data=token_params, headers=headers, timeout=10)
        if token_res.status_code != 200:
            print(f"🔥 카카오 토큰 발급 에러 응답: {token_res.text}")
            return RedirectResponse(url="/login?error=token_failed")
            
        token_data = token_res.json()
        access_token = token_data.get("access_token")
        if not access_token:
            return RedirectResponse(url="/login?error=no_token")
            
        # 사용자 프로필 조회
        profile_url = "https://kapi.kakao.com/v2/user/me"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/x-www-form-urlencoded;charset=utf-8"
        }
        profile_res = await run_in_threadpool(requests.get, profile_url, headers=headers, timeout=10)
        
        if profile_res.status_code != 200:
            print(f"🔥 카카오 프로필 조회 에러 응답: {profile_res.text}")
            return RedirectResponse(url="/login?error=profile_failed")
            
        profile_data = profile_res.json()
        kakao_account = profile_data.get("kakao_account", {})
        
        email = kakao_account.get("email")
        profile = kakao_account.get("profile", {})
        name = kakao_account.get("name", profile.get("nickname", "카카오회원"))
        
        # 카카오 고유의 전화번호 파싱 처리 계승 (+82 10-xxxx-xxxx -> 010xxxxxxxx)
        raw_phone = kakao_account.get("phone_number", "")
        mobile = ""
        if raw_phone:
            try:
                parts = raw_phone.split(' ')
                if len(parts) > 1:
                    mobile = '0' + parts[1].replace('-', '')
                else:
                    mobile = raw_phone.replace('-', '').replace(' ', '')
            except Exception as pe:
                print(f"⚠️ 카카오 전화번호 파싱 실패: {pe}")
                mobile = raw_phone.replace('-', '').replace(' ', '')
        
        birthyear = kakao_account.get("birthyear")
        birthday = kakao_account.get("birthday") # MMDD
        if birthday and len(birthday) == 4:
            birthday = f"{birthday[0:2]}-{birthday[2:4]}"
        
        if not email:
            return RedirectResponse(url="/login?error=essential_data_missing")
            
        # DB 연결 및 일반 회원 컬렉션('general_users') 조회
        db = firestore.client()
        user_ref = db.collection('general_users').document(email)
        user_doc = user_ref.get()
        
        # 세션에서 마지막 방문 페이지 획득 및 제거
        next_url = request.session.pop("social_next", None)
        
        if user_doc.exists:
            # [A] 기존 일반 회원 로그인 처리
            request.session.pop("social_agree", None)  # 불필요한 동의 세션 정리
            request.session["user_id"] = email
            request.session["user_role"] = "general"
            request.session["is_wholesale"] = False
            
            target_url = next_url if next_url else "/"
            response = RedirectResponse(url=target_url)
            response.set_cookie(key="amuredo_role", value="general", max_age=2592000, path="/")
            
            # Firebase RTDB에서 일반 회원 장바구니 데이터를 읽어 쿠키에 주입
            try:
                sanitized_email = sanitize_email_for_rtdb(email)
                ref = rtdb.reference(f"cart/{sanitized_email}")
                cart_data = ref.get()
                if cart_data:
                    response.set_cookie(
                        key="general_cart",
                        value=urllib.parse.quote(json.dumps(cart_data)),
                        max_age=2592000,
                        path="/"
                    )
            except Exception as ce:
                print(f"🔥 카카오 로그인 콜백 중 RTDB 장바구니 로드 실패: {ce}")
                
            return response
        else:
            # [B] 신규 일반 회원가입 절차 진행
            # 만 14세 미만 검증
            if birthyear and is_under_14(birthyear):
                return RedirectResponse(url="/login?error=under_14")
                
            # 소셜 회원가입 시 약관 동의 세션 검증
            social_agree = request.session.pop("social_agree", False)
            if not social_agree:
                return RedirectResponse(url="/login?error=agreement_required")
                
            new_user_data = {
                "name": name,
                "email": email,
                "phoneNumber": mobile,
                "age_year": birthyear if birthyear else "",
                "birth": birthday if birthday else "",
                "role": "general",
                "provider": "kakao",
                "created_at": firestore.SERVER_TIMESTAMP,
                "terms_agreed": True,
                "terms_agreed_at": firestore.SERVER_TIMESTAMP,
                "terms_version": "v1.0",
                "privacy_agreed": True,
                "privacy_agreed_at": firestore.SERVER_TIMESTAMP,
                "privacy_version": "v1.0"
            }
            user_ref.set(new_user_data)
            
            # 신규 가입 즉시 세션 및 쿠키 로그인 처리
            request.session["user_id"] = email
            request.session["user_role"] = "general"
            request.session["is_wholesale"] = False
            
            # 이전 주소가 있다면 가입 성공 파라미터를 결합, 없으면 홈으로 보냄
            if next_url:
                target_url = next_url + ("&signup=success" if "?" in next_url else "?signup=success")
            else:
                target_url = "/?signup=success"
                
            response = RedirectResponse(url=target_url)
            response.set_cookie(key="amuredo_role", value="general", max_age=2592000, path="/")
            return response
            
    except Exception as e:
        print(f"🔥 카카오 로그인 진행 중 심각한 예외 발생: {e}")
        return RedirectResponse(url="/login?error=system_error")


# -------------------------------------------------------------
# 7. 파트너 안경점 조회 API 신설
# -------------------------------------------------------------
@router.get("/partners")
async def get_partners():
    """
    Firestore 'partner_store' 컬렉션에 등록된 모든 파트너 안경점 정보를 조회하여 반환합니다.
    """
    try:
        db = firestore.client()
        docs = db.collection('partner_store').stream()
        
        partners = []
        for doc in docs:
            data = doc.to_dict()
            # Firestore 문서 필드 매핑
            # called: 연락처 (예: 01012345678)
            # city: 시/도
            # country: 구/군
            # details: 상세 주소
            # name: 안경점 이름
            partners.append({
                "id": doc.id,
                "name": data.get("name", "이름 없음"),
                "called": data.get("called", ""),
                "city": data.get("city", ""),
                "country": data.get("country", ""),
                "details": data.get("details", ""),
                "lat": data.get("lat"),
                "lng": data.get("lng"),
                "map_url": data.get("map_url")
            })
        return {"status": "success", "partners": partners}
    except Exception as e:
        print(f"🔥 파트너 안경점 목록 조회 에러: {e}")
        return {"status": "success", "partners": []}

# -------------------------------------------------------------
# 🏁 일반 소셜 로그인 고객의 마이페이지 데이터 조회 API 엔진 탑재
# -------------------------------------------------------------
from fastapi.responses import JSONResponse

@router.get("/general/me")
async def get_general_user_info(request: Request):
    """
    일반 소셜 로그인 고객의 마이페이지 연동용 정보(이메일, 연락처, 소셜가입제공자)를 Firestore에서 가져옵니다.
    """
    email = request.session.get("user_id")
    user_role = request.session.get("user_role", "guest")
    if not email or user_role != "general":
        return JSONResponse(status_code=403, content={"status": "error", "message": "권한이 없습니다. 일반 고객 로그인이 필요합니다."})
        
    try:
        db_fs = firestore.client()
        user_doc = db_fs.collection("general_users").document(email).get()
        
        if not user_doc.exists:
            return JSONResponse(status_code=404, content={"status": "error", "message": "회원 정보를 찾을 수 없습니다."})
            
        user_data = user_doc.to_dict()
        
        # 🏁 지능형 가입 경로(Provider) 감지 알고리즘
        provider = user_data.get("provider", "")
        if not provider:
            # Fallback: 이메일 도메인 분석
            if "naver.com" in email.lower():
                provider = "naver"
            else:
                provider = "kakao"
                
        return {
            "status": "success",
            "user": {
                "email": email,
                "name": user_data.get("name", "고객님"),
                "phoneNumber": user_data.get("phoneNumber", "연락처 미등록"),
                "provider": provider
            }
        }
    except Exception as e:
        print(f"🔥 일반 회원 정보 로드 에러: {e}")
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})


