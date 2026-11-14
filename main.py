import sys
import warnings
warnings.filterwarnings("ignore", category=FutureWarning)
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

import json
import os
import secrets
from typing import List

import firebase_admin
import requests
from email_validator import EmailNotValidError, validate_email
from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from firebase_admin import credentials, firestore
from starlette.concurrency import run_in_threadpool
from starlette.middleware.sessions import SessionMiddleware

from api.payment import router as payment_router
from api.user import router as user_router

app = FastAPI()

# 🏁 세션 미들웨어 설정 및 보안 키 동적 로드

session_config_path = os.path.join(os.path.dirname(__file__), "database", "session.json")
try:
    # 세션 키 파일이 없으면 강력한 무작위 키를 생성하여 저장 (서버 재시작 시 로그인 유지 목적)
    if not os.path.exists(session_config_path):
        os.makedirs(os.path.dirname(session_config_path), exist_ok=True)
        with open(session_config_path, "w", encoding="utf-8") as f:
            json.dump({"secret_key": secrets.token_hex(32)}, f, indent=4)
            
    with open(session_config_path, "r", encoding="utf-8") as f:
        session_data = json.load(f)
        session_secret = session_data.get("secret_key", secrets.token_hex(32))
except Exception as e:
    print(f"🔥 세션 키 로드 실패, 1회용 임시 키를 사용합니다 (재부팅 시 로그아웃 됨): {e}")
    session_secret = secrets.token_hex(32)

app.add_middleware(SessionMiddleware, secret_key=session_secret, https_only=True)

# 🏁 API 라우터 등록
app.include_router(user_router, prefix="/api/user", tags=["wholesale_user"])
app.include_router(payment_router, prefix="/api/payment", tags=["wholesale_payment"])

# ---------------------------------------------------------
# Firebase Admin SDK 설정 및 DB 초기화
# ---------------------------------------------------------
cred_path = os.path.join(os.path.dirname(__file__), "database", "firebase.json")
config_path = os.path.join(os.path.dirname(__file__), "database", "firebase_config.json")
try:
    if not firebase_admin._apps:
        cred = credentials.Certificate(cred_path)
        
        # RTDB URL 설정 파일 로드
        db_options = {}
        if os.path.exists(config_path):
            with open(config_path, "r", encoding="utf-8") as cf:
                db_options = json.load(cf)
                
        firebase_admin.initialize_app(cred, db_options)
    db = firestore.client()
except Exception as e:
    print(f"🔥 Firebase 인증 파일 초기화 실패: {e}")
    db = None

# ---------------------------------------------------------
# 정적 파일 및 프론트엔드 연결
# ---------------------------------------------------------
static_dir = os.path.join(os.path.dirname(__file__), "static")
if not os.path.exists(static_dir):
    os.makedirs(static_dir)

app.mount("/static", StaticFiles(directory=static_dir), name="static")

def _serve_static_html(filename: str, fallback_msg: str = "<h1>페이지를 찾을 수 없습니다.</h1>", status_code: int = 404) -> HTMLResponse:
    """정적 HTML 템플릿을 읽어 반환하는 공통 헬퍼"""
    file_path = os.path.join(static_dir, filename)
    if os.path.exists(file_path):
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse(content=fallback_msg, status_code=status_code)

def _format_item_price(data: dict, is_wholesale: bool) -> str:
    """도매/일반 여부에 따라 가격을 회계 단위 쉼표(,) 문자열로 변환하는 공통 헬퍼"""
    raw_price = data.get("wsPrice", data.get("price", "0")) if (is_wholesale and "wsPrice" in data) else data.get("price", "0")
    try:
        return f"{int(float(raw_price)):,}"
    except (ValueError, TypeError):
        return str(raw_price)

@app.get("/", response_class=HTMLResponse)
def serve_frontend():
    return _serve_static_html("index.html", "<h1>index.html 파일이 아직 생성되지 않았습니다.</h1>", 200)

@app.get("/wholesale/mypage", response_class=HTMLResponse)
def serve_wholesale_mypage(request: Request):
    if not request.session.get("is_wholesale"):
        return RedirectResponse(url="/login")
    return _serve_static_html("wholesale_mypage.html", "<h1>준비 중입니다.</h1>")

@app.get("/general/cart", response_class=HTMLResponse)
def serve_general_cart(request: Request):
    if request.session.get("user_role", "guest") == "guest":
        return RedirectResponse(url="/login")
    return _serve_static_html("general_cart.html", "<h1>장바구니 화면을 찾을 수 없습니다.</h1>")

@app.get("/wholesale/cart", response_class=HTMLResponse)
def serve_wholesale_cart(request: Request):
    if not request.session.get("is_wholesale"):
        return RedirectResponse(url="/login")
    return _serve_static_html("wholesale_cart.html", "<h1>장바구니 화면을 찾을 수 없습니다.</h1>")

@app.get("/wholesale/order", response_class=HTMLResponse)
def serve_wholesale_order(request: Request):
    if not request.session.get("is_wholesale"):
        return RedirectResponse(url="/login")
    return _serve_static_html("wholesale_order.html", "<h1>주문/결제 화면을 찾을 수 없습니다.</h1>")

@app.get("/wholesale/success", response_class=HTMLResponse)
def serve_wholesale_success(request: Request):
    if not request.session.get("is_wholesale"):
        return RedirectResponse(url="/login")
    return _serve_static_html("wholesale_success.html", "<h1>결제 완료 화면을 찾을 수 없습니다.</h1>")

@app.get("/wholesale/orders", response_class=HTMLResponse)
def serve_wholesale_orders(request: Request):
    if not request.session.get("is_wholesale"):
        return RedirectResponse(url="/login")
    return _serve_static_html("wholesale_orders.html", "<h1>주문 현황 화면을 찾을 수 없습니다.</h1>")

@app.get("/glasses")
@app.get("/sunglasses")
@app.get("/antioch")
def redirect_to_home():
    return RedirectResponse(url="/")

@app.get("/ready", response_class=HTMLResponse)
def serve_ready_page():
    return _serve_static_html("ready.html", "<h1>상품 준비중입니다.</h1>", 200)

@app.get("/trench", response_class=HTMLResponse)
@app.get("/ascot", response_class=HTMLResponse)
@app.get("/uncon", response_class=HTMLResponse)
@app.get("/bolero", response_class=HTMLResponse)
@app.get("/dublin", response_class=HTMLResponse)
@app.get("/oxford", response_class=HTMLResponse)
@app.get("/denim", response_class=HTMLResponse)
@app.get("/linen", response_class=HTMLResponse)
def serve_category_page(request: Request):
    """
    프론트엔드 카테고리 전용 페이지 서빙
    Firebase Firestore에 해당 카테고리(sort) 상품이 존재하면 itemList.html을 반환하고,
    상품이 하나도 없으면 별도 안내 페이지(ready.html)를 노출합니다.
    """
    category = request.url.path.strip("/").split("/")[0].lower()
    has_items = False

    if db is not None and category:
        try:
            target_collection = 'item' if category in {"oxford", "denim", "linen"} else 'item_ato'
            docs = list(db.collection(target_collection).where('sort', '==', category).limit(1).stream())
            has_items = len(docs) > 0
        except Exception as e:
            print(f"🔥 카테고리 상품 존재 여부 확인 중 에러 발생 ({category}): {e}")
            has_items = True

    if not has_items:
        return _serve_static_html("ready.html", "<h1>상품 준비중입니다.</h1>", 200)

    return _serve_static_html("itemList.html", "<h1>itemList.html 파일이 생성되지 않았습니다.</h1>", 200)

@app.get("/antioch/{item_id}", response_class=HTMLResponse)
def serve_antioch_detail_page(request: Request, item_id: str):
    if not request.session.get("is_wholesale"):
        return RedirectResponse(url=f"/item/{item_id}")
    return _serve_static_html("antioch_detail.html", "<h1>도매 상세 화면(antioch_detail.html)을 찾을 수 없습니다.</h1>")

@app.get("/item/{item_id}", response_class=HTMLResponse)
def serve_item_detail_page(request: Request, item_id: str):
    if request.session.get("is_wholesale"):
        return RedirectResponse(url=f"/antioch/{item_id}")
    return _serve_static_html("item_detail.html", "<h1>상세 화면 템플릿(item_detail.html)을 찾을 수 없습니다.</h1>")

@app.get("/about", response_class=HTMLResponse)
def serve_about_page():
    return _serve_static_html("about.html", "<h1>About 템플릿(about.html)을 찾을 수 없습니다.</h1>")

@app.get("/wholesale/event", response_class=HTMLResponse)
@app.get("/event.html", response_class=HTMLResponse)
@app.get("/event", response_class=HTMLResponse)
def serve_wholesale_event_page():
    return _serve_static_html("event.html", "<h1>이벤트 템플릿(event.html)을 찾을 수 없습니다.</h1>")

@app.get("/search", response_class=HTMLResponse)
def serve_search_page():
    return _serve_static_html("search.html", "<h1>검색 템플릿(search.html)을 찾을 수 없습니다.</h1>")

@app.get("/contact", response_class=HTMLResponse)
def serve_contact_page():
    return _serve_static_html("contact.html", "<h1>Contact 템플릿(contact.html)을 찾을 수 없습니다.</h1>")

@app.get("/partners", response_class=HTMLResponse)
def serve_partners_page():
    return _serve_static_html("partners.html", "<h1>Partners 템플릿(partners.html)을 찾을 수 없습니다.</h1>")

@app.get("/general/reserve", response_class=HTMLResponse)
def serve_reserve_page():
    return _serve_static_html("reserve.html", "<h1>예약하기 템플릿(reserve.html)을 찾을 수 없습니다.</h1>")

@app.get("/general/booking_success", response_class=HTMLResponse)
def serve_booking_success_page():
    return _serve_static_html("booking_success.html", "<h1>예약 완료 템플릿(booking_success.html)을 찾을 수 없습니다.</h1>")

@app.get("/general/bookings", response_class=HTMLResponse)
def serve_bookings_page(request: Request):
    if not request.session.get("user_id"):
        return RedirectResponse(url="/login")
    return _serve_static_html("bookings.html", "<h1>예약 확인 템플릿(bookings.html)을 찾을 수 없습니다.</h1>")

@app.get("/general/select_store", response_class=HTMLResponse)
def serve_select_store_page(request: Request):
    if not request.session.get("user_id"):
        return RedirectResponse(url="/login")
    return _serve_static_html("select_store.html", "<h1>매장 선택 템플릿(select_store.html)을 찾을 수 없습니다.</h1>")

@app.get("/general/mypage", response_class=HTMLResponse)
def serve_general_mypage_page(request: Request):
    if not request.session.get("user_id"):
        return RedirectResponse(url="/login")
    return _serve_static_html("general_mypage.html", "<h1>마이페이지 템플릿(general_mypage.html)을 찾을 수 없습니다.</h1>")

@app.get("/general/booking_checkout", response_class=HTMLResponse)
def serve_booking_checkout_page(request: Request):
    if not request.session.get("user_id"):
        return RedirectResponse(url="/login")
    return _serve_static_html("booking_checkout.html", "<h1>결제 템플릿(booking_checkout.html)을 찾을 수 없습니다.</h1>")

@app.get("/general/payment_success", response_class=HTMLResponse)
def serve_payment_success_page(request: Request):
    if not request.session.get("user_id"):
        return RedirectResponse(url="/login")
    return _serve_static_html("payment_success.html", "<h1>결제 완료 템플릿(payment_success.html)을 찾을 수 없습니다.</h1>")

@app.get("/register", response_class=HTMLResponse)
def serve_register():
    return _serve_static_html("register.html")

@app.get("/login", response_class=HTMLResponse)
def serve_login():
    return _serve_static_html("login.html")

# ---------------------------------------------------------
# 외부 데이터 통신용 API 엔드포인트
# ---------------------------------------------------------

@app.get("/api/items/best/{event_type}")
def get_best_items(request: Request, event_type: str):
    """
    메인 페이지의 'Productive Line-up' 섹션에 들어갈 아이템 리스트를 이벤트 타입별로 조회합니다.
    event_type: focus, meeting, drive, holiday 등
    """
    if db is None:
        return {"items": [], "error": "Firebase 연동 불가"}
        
    try:
        # 요청된 event_type 필드와 일치하는 문서들만 조회
        docs = db.collection('item_ato').where('event', '==', event_type).stream()
        
        is_wholesale = request.session.get("is_wholesale", False)
        
        real_items = []
        for doc in docs:
            data = doc.to_dict()
            paths = data.get("paths", [])
            image_url = paths[0] if (paths and len(paths) > 0) else "/static/img/ready.webp"
            
            formatted_price = _format_item_price(data, is_wholesale)

            real_items.append({
                "id": doc.id,
                "name": data.get("name", "이름 없음"),
                "price": formatted_price,
                "image_url": image_url,
                "category": data.get("category", "") # 소재/특징 태그용
            })
            
        return {"items": real_items}
        
    except Exception as e:
        print(f"🔥 Best 아이템({event_type}) 조회 에러: {e}")
        return {"items": [], "error": str(e)}

@app.get("/api/items/search")
def search_items(request: Request, q: str = ""):
    """
    상품 name 기준 검색어가 포함된 상품 리스트 조회 (대소문자 무시)
    아무래도('item') 및 안티오크('item_ato') 컬렉션을 모두 조회합니다.
    """
    if db is None:
        return {"items": [], "error": "Firebase DB가 연결되지 않았습니다."}
    
    try:
        q_clean = q.strip()
        if not q_clean:
            return {"items": []}
            
        is_wholesale = request.session.get("is_wholesale", False)
        q_lower = q_clean.lower()
        real_items = []
        seen_ids = set()
        
        for collection_name in ('item', 'item_ato'):
            docs = db.collection(collection_name).stream()
            for doc in docs:
                if doc.id in seen_ids:
                    continue
                data = doc.to_dict() or {}
                name = str(data.get("name", ""))
                
                if q_lower not in name.lower():
                    continue
                    
                seen_ids.add(doc.id)
                paths = data.get("paths", [])
                image_url = paths[0] if (paths and len(paths) > 0) else "/static/img/ready.webp"
                
                formatted_price = _format_item_price(data, is_wholesale)
                    
                real_items.append({
                    "id": doc.id,
                    "name": name,
                    "price": formatted_price,
                    "image_url": image_url,
                    "category": str(data.get("category", ""))
                })
            
        print(f"🔍 검색 완료: 키워드 '{q_clean}'로 {len(real_items)}개 상품 매칭됨 (item + item_ato).")
        return {"items": real_items}
        
    except Exception as e:
        print(f"🔥 상품 검색 중 에러 발생: {e}")
        return {"items": [], "error": str(e)}

@app.get("/api/items")
def get_items_by_category(request: Request, category: str):
    """
    카테고리(sort) 전용 조회 엔드포인트
    특정 sort 값(sunglasses 등)과 내부 파싱(paths[0]), 그리고 하단 미니멀 텍스트를 위한 name, price 전송
    """
    if db is None:
        return {"items": [], "error": "Firebase DB가 연결되지 않았습니다."}
        
    try:
        # 아무래도 시리즈(oxford, denim, linen)는 'item' 컬렉션, 안티오크 시리즈는 'item_ato' 컬렉션 조회
        target_collection = 'item' if category in {"oxford", "denim", "linen"} else 'item_ato'
        docs = db.collection(target_collection).where('sort', '==', category).stream()
        
        is_wholesale = request.session.get("is_wholesale", False)
        
        real_items = []
        for doc in docs:
            data = doc.to_dict()
            paths = data.get("paths", [])
            # 사진이 없어도 안전하게 처리
            image_url = paths[0] if (paths and len(paths) > 0) else "/static/img/ready.webp"
            
            formatted_price = _format_item_price(data, is_wholesale)

            # 프론트엔드 모바일 UX 향상을 위한 이름, 가격, 컬러 및 출시일(created_at) 추가 전송
            real_items.append({
                "id": doc.id,
                "name": data.get("name", "이름 없음"),
                "price": formatted_price,
                "image_url": image_url,
                "category": str(data.get("category", "")),
                "color": str(data.get("color", "")),
                "created_at": str(data.get("created_at", "")).strip()
            })
            
        print(f"✅ Firebase 조회 완료: '{category}' 카테고리의 하단 텍스트형 {len(real_items)}개 아이템 전달.")
        return {"items": real_items}
        
    except Exception as e:
        print(f"🔥 카테고리 데이터 파싱 중 에러 발생: {e}")
        return {"items": [], "error": str(e)}

# -------------------------------------------------------------
# 5. 아이템 상세 데이터(Item Detail) API
# -------------------------------------------------------------
@app.get("/api/items/{item_id}")
def get_item_detail(request: Request, item_id: str):
    """
    개별 상품 정보(상세 이미지 전체 리스트 포함) 조회 엔드포인트
    """
    if db is None:
        return {"error": "Firebase DB가 연결되지 않았습니다."}
        
    try:
        # 단일 문서 직접 포인팅 조회 (item_ato 우선 확인 후 없으면 item 컬렉션 확인)
        doc_ref = db.collection('item_ato').document(item_id)
        doc = doc_ref.get()
        if not doc.exists:
            doc = db.collection('item').document(item_id).get()
        
        if not doc.exists:
            return {"error": "해당 상품을 찾을 수 없습니다.", "status": 404}
            
        data = doc.to_dict()
        

        paths = data.get("paths", [])
        
        # 만약 이미지가 아예 없다면 임시 이미지라도 할당
        if not paths:
            paths = ["/static/img/ready.webp"]
            
        is_wholesale = request.session.get("is_wholesale", False)
        formatted_price = _format_item_price(data, is_wholesale)
            
        # 사용자가 아직 'desc'를 DB에 넣지 않은 상태를 대비한 고급스러운 대체 텍스트
        fallback_desc = "amuredo만의 시그니처 감성이 돋보이는 모던 프리미엄 컬렉션입니다.\n미니멀하면서도 감각적인 디테일이 당신의 일상에 특별하고 세련된 포인트를 더해줍니다."
        
        code_val = str(data.get("code", ""))
        models = []
        size_val = {}
        manufacturer_val = ""
        country_val = ""
        material_val = ""
        
        # 1. 일차적으로 개별 아이템(item) 컬렉션에 등록된 기존 desc를 가져옵니다.
        final_desc = str(data.get("desc", ""))
        
        if code_val:
            try:
                code_doc = db.collection('code').document(code_val).get()
                if code_doc.exists:
                    code_data = code_doc.to_dict()
                    # 룩북용 사진 배열 추출 (models 우선, 없으면 path)
                    models = code_data.get("models", code_data.get("path", []))
                    # 🏁 신규 추가: size(프레임, 렌즈가로, 렌즈세로, 브릿지, 안경다리 스펙) 데이터 추출
                    size_val = code_data.get("size", {})
                    # 🏁 신규 추가: 제조사, 제조국, 원료 데이터 추출
                    manufacturer_val = code_data.get("manufacturer", "")
                    country_val = code_data.get("country", "")
                    material_val = code_data.get("material", "")
                    
                    # 🏁 신규 로직: code 컬렉션 서랍장에 공통 desc가 작성되어 있다면 이것을 '상품 코멘트'로 덮어씌웁니다.
                    if "desc" in code_data and str(code_data["desc"]).strip():
                        final_desc = str(code_data["desc"])
                        
            except Exception as code_db_err:
                print(f"🔥 모델(룩북) 및 코멘트 컬렉션 연동 에러 발생: {code_db_err}")

        # 2. item, code 두 서랍장 모두 desc가 아예 비어있다면 대비용 텍스트를 할당합니다.
        if not final_desc.strip():
            final_desc = fallback_desc

        # 3. sort 컬렉션 조건부 이미지 배열 조회 (item_ato.{itemID}.sort == sort.{sort})
        sort_val = str(data.get("sort", "")).strip()
        sort_urls = []
        if sort_val:
            try:
                sort_doc = db.collection('sort').document(sort_val).get()
                if sort_doc.exists:
                    sort_data = sort_doc.to_dict() or {}
                    raw_urls = sort_data.get("url", [])
                    if isinstance(raw_urls, list):
                        sort_urls = [str(u).strip() for u in raw_urls if u and str(u).strip()]
                    elif isinstance(raw_urls, str) and raw_urls.strip():
                        sort_urls = [raw_urls.strip()]
            except Exception as sort_db_err:
                print(f"🔥 sort 컬렉션 이미지 연동 에러 발생: {sort_db_err}")

        return {
            "id": doc.id,
            "name": data.get("name", "이름 없음"),
            "price": formatted_price,
            "paths": paths,       
            "sort": data.get("sort", "unclassified"),
            "sort_urls": sort_urls,
            "code": code_val,      
            # 상세 페이지 룩북 전용 모델 배열
            "models": models,      
            # 상세 이미지 데이터 추가
            "details": data.get("details", ""),
            # 🏁 신규 추가: code 컬렉션의 size 데이터 연동
            "size": size_val,
            # 🏁 신규 추가: 제조사, 제조국, 원료 데이터 연동
            "manufacturer": manufacturer_val,
            "country": country_val,
            "material": material_val,
            # 🏁 업데이트: code 기반 통일화된 코멘트 출력
            "desc": final_desc
        }
        
    except Exception as e:
        print(f"🔥 상세 페이지 조회 에러 발생: {e}")
        return {"error": str(e), "status": 500}

@app.get("/api/about")
def get_about_info():
    """
    브랜드 소셜 채널 및 스토어 URL 정보를 각각의 문서에서 조회합니다.
    Firebase: 'about' collection -> 각 문서(naverStore, blog, instargram)의 'url' 필드
    """
    if db is None:
        return {"naverStore": "", "blog": "", "instargram": ""}
        
    try:
        keys = ("naverStore", "blog", "instargram")
        refs = [db.collection('about').document(k) for k in keys]
        result = {k: "" for k in keys}
        for snap in db.get_all(refs):
            if snap.exists:
                result[snap.id] = (snap.to_dict() or {}).get("url", "")
        return result
        
    except Exception as e:
        print(f"🔥 About 정보 상세 조회 에러: {e}")
        return {"naverStore": "", "blog": "", "instargram": ""}
@app.get("/api/items/{item_id}/related")
def get_related_items(item_id: str):
    """
    현재 아이템과 동일한 code 값을 공유하는 연관 상품(Related Items) 조회.
    자기 자신(self)은 추천 배열에서 제외합니다.
    최소한의 트래픽을 위해 id, 첫 번째 이미지(path), 이름(name)만 반환합니다.
    """
    if db is None:
        return {"items": [], "error": "Firebase 연결 안됨"}
        
    try:
        # 1. 현재 타겟팅된 아이템의 원본 문서를 찾아 code 값 파악 (item_ato 우선, 없으면 item)
        source_collection = 'item_ato'
        target_doc = db.collection('item_ato').document(item_id).get()
        if not target_doc.exists:
            source_collection = 'item'
            target_doc = db.collection('item').document(item_id).get()
        if not target_doc.exists:
            return {"items": [], "error": "원본 상품이 존재하지 않습니다."}
            
        target_data = target_doc.to_dict()
        target_code = target_data.get("code")
        
        # 코드가 아예 배정되지 않은 경우 빠른 패스
        if not target_code:
            return {"items": []}
            
        # 2. 동일한 코드를 가진 컬렉션 전체 스캔 (서버단 필터링)
        matched_docs = db.collection(source_collection).where('code', '==', target_code).stream()
        
        related_items = []
        for doc in matched_docs:
            if doc.id == item_id:
                continue # 자기 자신은 연관 상품에서 탈락(스킵)시킵니다.
                
            data = doc.to_dict()
            paths = data.get("paths", [])
            first_image = paths[0] if paths else "/static/img/ready.webp"
            
            related_items.append({
                "id": doc.id,
                "name": data.get("name", "이름 없음"),
                "path": first_image
            })
            
        return {"items": related_items}
        
    except Exception as e:
        print(f"🔥 연관 상품 조회 에러 발생: {e}")
        return {"items": [], "error": str(e)}

@app.get("/api/promotions")
def get_promotions():
    """
    메인 페이지 하단(1:2 가로비율) 프로모션(code) 컨테이너 전용 엔드포인트
    'code' 컬렉션에 들어있는 문서의 image_path 와 info 필드를 가져옵니다.
    """
    if db is None:
        return {"items": [], "error": "Firebase 연결 안됨"}
        
    try:
        promo_docs = db.collection('code').stream()
        results = []
        for doc in promo_docs:
            data = doc.to_dict()
            results.append({
                "id": doc.id,
                "path": data.get("path", "https://via.placeholder.com/600x600.png?text=No+Image"),
                "info": data.get("info", "상품 코드 프로모션 정보가 없습니다.")
            })
        return {"items": results}
    except Exception as e:
        print(f"🔥 프로모션 데이터 호출 에러: {e}")
        return {"items": [], "error": str(e)}

@app.get("/api/promo-redirect/{promo_code}")
def promo_redirect(promo_code: str):
    """
    프로모션(code)의 상세보기 클릭 시, item 컬렉션에서 해당 code를 가진 가장 첫 번째 상품 ID를 찾아
    상세 페이지로 강제 다이렉트(Redirect)시켜주는 징검다리 API 입니다.
    """
    if db is None:
        return {"error": "Firebase 연결 안됨"}
        
    try:
        # DB 부하 최소화를 위해 매칭되는 상품 중 제일 첫 1개(limit)만 뽑아옵니다 (item 및 item_ato 모두 확인).
        target_item_id = None
        for col_name in ('item', 'item_ato'):
            matched_items = db.collection(col_name).where('code', '==', promo_code).limit(1).stream()
            for doc in matched_items:
                target_item_id = doc.id
                break
            if target_item_id:
                break
            
        if target_item_id:
            # 찾은 실제 아이템의 ID를 라우팅 주소로 조합해 브라우저를 이동시킵니다
            return RedirectResponse(url=f"/item/{target_item_id}")
        else:
            return HTMLResponse("<h1>해당 프로모션과 연결된 상품을 찾을 수 없습니다.</h1>", status_code=404)
            
    except Exception as e:
        print(f"🔥 프로모션 리다이렉트 에러: {e}")
        return HTMLResponse(f"<h1>서버 에러 발생: {e}</h1>", status_code=500)
# -------------------------------------------------------------
# 6. 문의하기(Contact) 및 텔레그램 연동 API
# -------------------------------------------------------------

# 텔레그램 보안 설정 로드 (database/telegram.json)
tg_config_path = os.path.join(os.path.dirname(__file__), "database", "telegram.json")
try:
    with open(tg_config_path, "r", encoding="utf-8") as f:
        tg_data = json.load(f)
        TELEGRAM_BOT_TOKEN = tg_data.get("bot_token")
        TELEGRAM_CHAT_ID = tg_data.get("user_request_id")
    print("✅ Telegram 봇 정보 로드 완료")
except Exception as e:
    print(f"🔥 Telegram 설정 파일 로드 실패: {e}")
    TELEGRAM_BOT_TOKEN = None
    TELEGRAM_CHAT_ID = None

@app.post("/api/contact")
async def handle_contact_form(
    email: str = Form(...),
    message: str = Form(...),
    consent: bool = Form(...),
    images: List[UploadFile] = File(None)
):
    """
    문의사항을 접수하고 유효성 검사 후 텔레그램 봇으로 전송합니다.
    """
    # 1. 이메일 유효성 검사
    try:
        validate_email(email)
    except EmailNotValidError as e:
        return {"status": "error", "message": f"이메일 형식이 올바르지 않습니다: {str(e)}"}

    # 2. 개인정보 동의 여부 확인
    if not consent:
        return {"status": "error", "message": "개인정보 수집 및 이용에 동의해야 합니다."}

    # 3. 특수문자 화이트리스트 필터링 (정규식 사용)
    # 허용: 한글, 영문, 숫자, 공백 및 지정된 특수문자
    # 화이트리스트: . , ! ? ( ) [ ] { } - _ : / @ ~ & + = *
    allowed_pattern = r'^[a-zA-Z0-9가-힣\s\.,!\?\(\)\[\]\{\}\-_:/@~&\+\=\*]+$'
    if not re.match(allowed_pattern, message):
        return {"status": "error", "message": "허용되지 않은 특수문자가 포함되어 있습니다."}

    # 4. 이미지 검증 (최대 5장, 각 2MB 이하, 확장자 체크)
    validated_images = []
    if images:
        if len(images) > 5:
            return {"status": "error", "message": "이미지는 최대 5개까지만 첨부할 수 있습니다."}
        
        allowed_extensions = {".jpg", ".jpeg", ".png", ".webp"}
        for img in images:
            # 파일이 비어있는지 체크 (FastAPI 특성상 빈 값도 리스트에 들어올 수 있음)
            if not img.filename:
                continue
                
            # 확장자 체크
            ext = os.path.splitext(img.filename)[1].lower()
            if ext not in allowed_extensions:
                return {"status": "error", "message": f"허용되지 않은 파일 형식입니다: {img.filename}"}
            
            # 크기 체크 (2MB = 2 * 1024 * 1024 bytes)
            content = await img.read()
            if len(content) > 2 * 1024 * 1024:
                return {"status": "error", "message": f"파일 크기가 2MB를 초과합니다: {img.filename}"}
            
            # 이미지 저장을 위해 포인터 리셋 후 리스트에 보관하거나 바이너리 유지
            validated_images.append((img.filename, content))

    # 5. 텔레그램 메시지 구성 및 스레드풀 비동기 발송 (타임아웃 10초 적용으로 이벤트 루프 블로킹/무한대기 원천 차단)
    text_content = f"📩 [amuredo] 신규 문의 접수\n\n- 이메일: {email}\n- 문의내용:\n{message}"

    def _send_contact_to_telegram():
        tg_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        requests.post(tg_url, data={"chat_id": TELEGRAM_CHAT_ID, "text": text_content}, timeout=10)

        if validated_images:
            img_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendPhoto"
            for _, content in validated_images:
                requests.post(img_url, data={"chat_id": TELEGRAM_CHAT_ID}, files={"photo": content}, timeout=10)

    try:
        await run_in_threadpool(_send_contact_to_telegram)
        print(f"✅ 텔레그램 발송 완료: {email}의 문의사항을 전달했습니다.")
        return {"status": "success", "message": "문의가 성공적으로 전달되었습니다."}

    except Exception as e:
        print(f"🔥 텔레그램 발송 중 오류 발생: {e}")
        return {"status": "error", "message": "서버 통신 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."}
