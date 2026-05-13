from fastapi import FastAPI
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
import os
import firebase_admin
from firebase_admin import credentials, firestore
import requests
import re
import json
from fastapi import File, UploadFile, Form, Request
from typing import List
from email_validator import validate_email, EmailNotValidError
from starlette.middleware.sessions import SessionMiddleware
from api.user import router as user_router
from api.payment import router as payment_router

app = FastAPI()

# 🏁 세션 미들웨어 설정 및 보안 키 동적 로드
import secrets

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

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/", response_class=HTMLResponse)
async def serve_frontend():
    index_path = os.path.join(static_dir, "index.html")
    if not os.path.exists(index_path):
        return "<h1>index.html 파일이 아직 생성되지 않았습니다.</h1>"
        
    with open(index_path, "r", encoding="utf-8") as f:
        return f.read()

@app.get("/wholesale/mypage", response_class=HTMLResponse)
async def serve_wholesale_mypage(request: Request):
    if not request.session.get("is_wholesale"):
        return RedirectResponse(url="/wholesale/login")
    detail_path = os.path.join(static_dir, "wholesale_mypage.html")
    if os.path.exists(detail_path):
        with open(detail_path, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse(content="<h1>준비 중입니다.</h1>", status_code=404)

@app.get("/wholesale/cart", response_class=HTMLResponse)
async def serve_wholesale_cart(request: Request):
    if not request.session.get("is_wholesale"):
        return RedirectResponse(url="/wholesale/login")
    detail_path = os.path.join(static_dir, "wholesale_cart.html")
    if os.path.exists(detail_path):
        with open(detail_path, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse(content="<h1>장바구니 화면을 찾을 수 없습니다.</h1>", status_code=404)

@app.get("/wholesale/order", response_class=HTMLResponse)
async def serve_wholesale_order(request: Request):
    if not request.session.get("is_wholesale"):
        return RedirectResponse(url="/wholesale/login")
    detail_path = os.path.join(static_dir, "wholesale_order.html")
    if os.path.exists(detail_path):
        with open(detail_path, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse(content="<h1>주문/결제 화면을 찾을 수 없습니다.</h1>", status_code=404)

@app.get("/wholesale/success", response_class=HTMLResponse)
async def serve_wholesale_success(request: Request):
    if not request.session.get("is_wholesale"):
        return RedirectResponse(url="/wholesale/login")
    detail_path = os.path.join(static_dir, "wholesale_success.html")
    if os.path.exists(detail_path):
        with open(detail_path, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse(content="<h1>결제 완료 화면을 찾을 수 없습니다.</h1>", status_code=404)

@app.get("/wholesale/orders", response_class=HTMLResponse)
async def serve_wholesale_orders(request: Request):
    if not request.session.get("is_wholesale"):
        return RedirectResponse(url="/wholesale/login")
    detail_path = os.path.join(static_dir, "wholesale_orders.html")
    if os.path.exists(detail_path):
        with open(detail_path, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse(content="<h1>주문 현황 화면을 찾을 수 없습니다.</h1>", status_code=404)

@app.get("/sunglasses", response_class=HTMLResponse)
@app.get("/glasses", response_class=HTMLResponse)
@app.get("/antioch", response_class=HTMLResponse)
@app.get("/goggles", response_class=HTMLResponse)
async def serve_category_page(request: Request):
    """
    프론트엔드 카테고리 전용 페이지 서빙 (itemList.html 반환)
    어떤 메뉴를 누르든 동일한 스켈레톤을 반환하고 JS가 분기합니다.
    """
    item_list_path = os.path.join(static_dir, "itemList.html")
    if not os.path.exists(item_list_path):
        return "<h1>itemList.html 파일이 생성되지 않았습니다.</h1>"
        
    with open(item_list_path, "r", encoding="utf-8") as f:
        return f.read()

# 도매 전용 상품 상세 화면 HTML 서빙용 라우팅 (보안 게이트 작동)
@app.get("/antioch/{item_id}", response_class=HTMLResponse)
async def serve_antioch_detail_page(request: Request, item_id: str):
    # (참고) 이전에는 여기서 서버 사이드 강제 리다이렉트를 했으나,
    # 이제 프론트엔드 itemDetail.js의 예쁜 커스텀 팝업(403)을 보여주기 위해 HTML을 먼저 정상 서빙합니다.
    # 데이터 탈취 보안은 API 단(/api/items/{item_id})에서 완벽히 방어 중입니다.
    
    detail_path = os.path.join(static_dir, "antioch_detail.html")
    if os.path.exists(detail_path):
        with open(detail_path, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse(content="<h1>도매 상세 화면(antioch_detail.html)을 찾을 수 없습니다.</h1>", status_code=404)

# 개별 상품 상세 화면 HTML 서빙용 프론트엔드 라우팅
@app.get("/item/{item_id}", response_class=HTMLResponse)
async def serve_item_detail_page(request: Request, item_id: str):
    # 도매 회원이 로그인 상태로 일반 상품을 클릭했을 경우, 강제로 도매 전용 뷰로 리다이렉트
    if request.session.get("is_wholesale"):
        return RedirectResponse(url=f"/antioch/{item_id}")

    detail_path = os.path.join(static_dir, "item_detail.html")
    if os.path.exists(detail_path):
        with open(detail_path, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse(content="<h1>상세 화면 템플릿(item_detail.html)을 찾을 수 없습니다.</h1>", status_code=404)

# 브랜드 정보(About) 화면 HTML 서빙용 프론트엔드 라우팅
@app.get("/about", response_class=HTMLResponse)
async def serve_about_page():
    about_path = os.path.join(static_dir, "about.html")
    if os.path.exists(about_path):
        with open(about_path, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse(content="<h1>About 템플릿(about.html)을 찾을 수 없습니다.</h1>", status_code=404)

# 문의하기(Contact) 화면 HTML 서빙용 프론트엔드 라우팅
@app.get("/contact", response_class=HTMLResponse)
async def serve_contact_page():
    contact_path = os.path.join(static_dir, "contact.html")
    if os.path.exists(contact_path):
        with open(contact_path, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse(content="<h1>Contact 템플릿(contact.html)을 찾을 수 없습니다.</h1>", status_code=404)

# 🏁 도매 전용 페이지 라우팅
@app.get("/wholesale/register", response_class=HTMLResponse)
async def serve_wholesale_register():
    path = os.path.join(static_dir, "wholesale_register.html")
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse(content="<h1>페이지를 찾을 수 없습니다.</h1>", status_code=404)

@app.get("/wholesale/login", response_class=HTMLResponse)
async def serve_wholesale_login():
    path = os.path.join(static_dir, "wholesale_login.html")
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse(content="<h1>페이지를 찾을 수 없습니다.</h1>", status_code=404)

# ---------------------------------------------------------
# 외부 데이터 통신용 API 엔드포인트
# ---------------------------------------------------------



@app.get("/api/items/best/{event_type}")
async def get_best_items(event_type: str):
    """
    메인 페이지의 'Productive Line-up' 섹션에 들어갈 아이템 리스트를 이벤트 타입별로 조회합니다.
    event_type: focus, meeting, drive, holiday 등
    """
    if db is None:
        return {"items": [], "error": "Firebase 연동 불가"}
        
    try:
        # 요청된 event_type 필드와 일치하는 문서들만 조회
        docs = db.collection('item').where('event', '==', event_type).stream()
        
        real_items = []
        for doc in docs:
            data = doc.to_dict()
            paths = data.get("paths", [])
            image_url = paths[0] if (paths and len(paths) > 0) else "/static/img/ready.webp"
            
            raw_price = data.get("price", "0")
            try:
                formatted_price = f"{int(float(raw_price)):,}"
            except (ValueError, TypeError):
                formatted_price = str(raw_price)

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

@app.get("/api/items")
async def get_items_by_category(category: str):
    """
    카테고리(sort) 전용 조회 엔드포인트
    특정 sort 값(sunglasses 등)과 내부 파싱(paths[0]), 그리고 하단 미니멀 텍스트를 위한 name, price 전송
    """
    if db is None:
        return {"items": [], "error": "Firebase DB가 연결되지 않았습니다."}
        
    try:
        # sort 필드값이 요쳥된 카테고리와 일치하는 문서들만 조회
        docs = db.collection('item').where('sort', '==', category).stream()
        
        real_items = []
        for doc in docs:
            data = doc.to_dict()
            paths = data.get("paths", [])
            # 사진이 없어도 안전하게 처리
            image_url = paths[0] if (paths and len(paths) > 0) else "/static/img/ready.webp"
            
            # 가격(price) 필드에 회계 단위 쉼표(,) 추가 로직 적용
            raw_price = data.get("price", "0")
            try:
                formatted_price = f"{int(float(raw_price)):,}"
            except (ValueError, TypeError):
                formatted_price = str(raw_price)

            # 프론트엔드 모바일 UX 향상을 위한 이름, 가격 및 필터링용 카테고리 추가 전송
            real_items.append({
                "id": doc.id,
                "name": data.get("name", "이름 없음"),
                "price": formatted_price,
                "image_url": image_url,
                "category": str(data.get("category", "")), # 🏁 신규: 프론트엔드 Set 필터 연동용 데이터
                "sort": data.get("sort", "") # 🏁 신규: 안티오크 상품 분기 처리를 위한 데이터
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
async def get_item_detail(request: Request, item_id: str):
    """
    개별 상품 정보(상세 이미지 전체 리스트 포함) 조회 엔드포인트
    """
    if db is None:
        return {"error": "Firebase DB가 연결되지 않았습니다."}
        
    try:
        # 단일 문서 직접 포인팅 조회
        doc_ref = db.collection('item').document(item_id)
        doc = doc_ref.get()
        
        if not doc.exists:
            return {"error": "해당 상품을 찾을 수 없습니다.", "status": 404}
            
        data = doc.to_dict()
        
        # 🔒 강력한 백엔드 보안: 해당 상품이 'antioch' 도매용이고, 사용자가 도매 로그인을 안 했다면 데이터 탈취 차단
        if data.get("sort") == "antioch" and not request.session.get("is_wholesale"):
            return {"error": "도매 권한이 필요한 상품입니다. 로그인을 먼저 진행해 주세요.", "status": 403}

        paths = data.get("paths", [])
        
        # 만약 이미지가 아예 없다면 임시 이미지라도 할당
        if not paths:
            paths = ["/static/img/ready.webp"]
            
        raw_price = data.get("price", "0")
        try:
            formatted_price = f"{int(float(raw_price)):,}"
        except (ValueError, TypeError):
            formatted_price = str(raw_price)
            
        # 사용자가 아직 'desc'를 DB에 넣지 않은 상태를 대비한 고급스러운 대체 텍스트
        fallback_desc = "amuredo만의 시그니처 감성이 돋보이는 모던 프리미엄 컬렉션입니다.\n미니멀하면서도 감각적인 디테일이 당신의 일상에 특별하고 세련된 포인트를 더해줍니다."
        
        code_val = str(data.get("code", ""))
        models = []
        
        # 1. 일차적으로 개별 아이템(item) 컬렉션에 등록된 기존 desc를 가져옵니다.
        final_desc = str(data.get("desc", ""))
        
        if code_val:
            try:
                code_doc = db.collection('code').document(code_val).get()
                if code_doc.exists:
                    code_data = code_doc.to_dict()
                    # 룩북용 사진 배열 추출
                    models = code_data.get("path", [])
                    
                    # 🏁 신규 로직: code 컬렉션 서랍장에 공통 desc가 작성되어 있다면 이것을 '상품 코멘트'로 덮어씌웁니다.
                    if "desc" in code_data and str(code_data["desc"]).strip():
                        final_desc = str(code_data["desc"])
                        
            except Exception as code_db_err:
                print(f"🔥 모델(룩북) 및 코멘트 컬렉션 연동 에러 발생: {code_db_err}")

        # 2. item, code 두 서랍장 모두 desc가 아예 비어있다면 대비용 텍스트를 할당합니다.
        if not final_desc.strip():
            final_desc = fallback_desc

        return {
            "id": doc.id,
            "name": data.get("name", "이름 없음"),
            "price": formatted_price,
            "paths": paths,       
            "sort": data.get("sort", "unclassified"),
            "code": code_val,      
            # 상세 페이지 룩북 전용 모델 배열
            "models": models,      
            # 네이버 구매 링크 파싱 (없을 경우 빈 문자열)
            "naver": str(data.get("naver", "")),
            # 🏁 업데이트: code 기반 통일화된 코멘트 출력
            "desc": final_desc
        }
        
    except Exception as e:
        print(f"🔥 상세 페이지 조회 에러 발생: {e}")
        return {"error": str(e), "status": 500}

@app.get("/api/about")
async def get_about_info():
    """
    브랜드 소셜 채널 및 스토어 URL 정보를 각각의 문서에서 조회합니다.
    Firebase: 'about' collection -> 각 문서(naverStore, blog, instargram)의 'url' 필드
    """
    if db is None:
        return {"naverStore": "", "blog": "", "instargram": ""}
        
    try:
        # 각 문서를 병렬적으로 조회 (또는 순차 조회)
        naver_doc = db.collection('about').document('naverStore').get()
        blog_doc = db.collection('about').document('blog').get()
        insta_doc = db.collection('about').document('instargram').get()
        
        return {
            "naverStore": naver_doc.to_dict().get("url", "") if naver_doc.exists else "",
            "blog": blog_doc.to_dict().get("url", "") if blog_doc.exists else "",
            "instargram": insta_doc.to_dict().get("url", "") if insta_doc.exists else ""
        }
        
    except Exception as e:
        print(f"🔥 About 정보 상세 조회 에러: {e}")
        return {"naverStore": "", "blog": "", "instargram": ""}
@app.get("/api/items/{item_id}/related")
async def get_related_items(item_id: str):
    """
    현재 아이템과 동일한 code 값을 공유하는 연관 상품(Related Items) 조회.
    자기 자신(self)은 추천 배열에서 제외합니다.
    최소한의 트래픽을 위해 id, 첫 번째 이미지(path), 이름(name)만 반환합니다.
    """
    if db is None:
        return {"items": [], "error": "Firebase 연결 안됨"}
        
    try:
        # 1. 현재 타겟팅된 아이템의 원본 문서를 찾아 code 값 파악
        target_doc = db.collection('item').document(item_id).get()
        if not target_doc.exists:
            return {"items": [], "error": "원본 상품이 존재하지 않습니다."}
            
        target_data = target_doc.to_dict()
        target_code = target_data.get("code")
        
        # 코드가 아예 배정되지 않은 경우 빠른 패스
        if not target_code:
            return {"items": []}
            
        # 2. 동일한 코드를 가진 컬렉션 전체 스캔 (서버단 필터링)
        matched_docs = db.collection('item').where('code', '==', target_code).stream()
        
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

@app.post("/api/telegram")
async def send_telegram_msg():
    return {"status": "success", "message": "텔레그램 전송 API 뼈대입니다."}

@app.get("/api/promotions")
async def get_promotions():
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
async def promo_redirect(promo_code: str):
    """
    프로모션(code)의 상세보기 클릭 시, item 컬렉션에서 해당 code를 가진 가장 첫 번째 상품 ID를 찾아
    상세 페이지로 강제 다이렉트(Redirect)시켜주는 징검다리 API 입니다.
    """
    if db is None:
        return {"error": "Firebase 연결 안됨"}
        
    try:
        # DB 부하 최소화를 위해 매칭되는 상품 중 제일 첫 1개(limit)만 뽑아옵니다.
        matched_items = db.collection('item').where('code', '==', promo_code).limit(1).stream()
        
        target_item_id = None
        for doc in matched_items:
            target_item_id = doc.id
            break # 1개만 필요하므로 즉시 탈출
            
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

    # 5. 텔레그램 메시지 구성
    text_content = f"📩 [amuredo] 신규 문의 접수\n\n- 이메일: {email}\n- 문의내용:\n{message}"

    try:
        # 텔레그램 봇으로 텍스트 전송
        tg_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        requests.post(tg_url, data={"chat_id": TELEGRAM_CHAT_ID, "text": text_content})

        # 텔레그램 봇으로 이미지 전송 (이미지가 있을 때)
        if validated_images:
            if len(validated_images) == 1:
                # 1장일 땐 단일 전송
                img_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendPhoto"
                requests.post(img_url, data={"chat_id": TELEGRAM_CHAT_ID}, files={"photo": validated_images[0][1]})
            else:
                # 여러 장일 땐 MediaGroup 전송 (순차적으로 혹은 MediaGroup API 사용 가능)
                # 여기서는 가장 안정적인 개별 순차 발송 방식을 제안합니다.
                img_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendPhoto"
                for name, content in validated_images:
                    requests.post(img_url, data={"chat_id": TELEGRAM_CHAT_ID}, files={"photo": content})

        print(f"✅ 텔레그램 발송 완료: {email}의 문의사항을 전달했습니다.")
        return {"status": "success", "message": "문의가 성공적으로 전달되었습니다."}

    except Exception as e:
        print(f"🔥 텔레그램 발송 중 오류 발생: {e}")
        return {"status": "error", "message": "서버 통신 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."}
