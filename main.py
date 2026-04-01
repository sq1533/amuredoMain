from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
import os
import firebase_admin
from firebase_admin import credentials, firestore

app = FastAPI()

# ---------------------------------------------------------
# Firebase Admin SDK 설정 및 DB 초기화
# ---------------------------------------------------------
cred_path = os.path.join(os.path.dirname(__file__), "database", "firebase.json")
try:
    if not firebase_admin._apps:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
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

@app.get("/sunglasses", response_class=HTMLResponse)
@app.get("/glasses", response_class=HTMLResponse)
@app.get("/goggles", response_class=HTMLResponse)
async def serve_category_page():
    """
    프론트엔드 카테고리 전용 페이지 서빙 (itemList.html 반환)
    어떤 메뉴를 누르든 동일한 스켈레톤을 반환하고 JS가 분기합니다.
    """
    item_list_path = os.path.join(static_dir, "itemList.html")
    if not os.path.exists(item_list_path):
        return "<h1>itemList.html 파일이 생성되지 않았습니다.</h1>"
        
    with open(item_list_path, "r", encoding="utf-8") as f:
        return f.read()

# 개별 상품 상세 화면 HTML 서빙용 프론트엔드 라우팅
@app.get("/item/{item_id}", response_class=HTMLResponse)
async def serve_item_detail_page(item_id: str):
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

# ---------------------------------------------------------
# 외부 데이터 통신용 API 엔드포인트
# ---------------------------------------------------------

@app.get("/api/banner")
async def get_banner_data():
    dummy_paths = [
        "https://via.placeholder.com/1024x614.png?text=amuredo+Banner+1",
        "https://via.placeholder.com/1024x614.png?text=amuredo+Banner+2",
        "https://via.placeholder.com/1024x614.png?text=amuredo+Banner+3"
    ]
    return {"paths": dummy_paths}


@app.get("/api/items/best")
async def get_best_items():
    if db is None:
        return {"items": [], "error": "Firebase 연동 불가"}
        
    try:
        best_docs = db.collection('item').where('event', '==', 'best').stream()
        
        real_items = []
        for doc in best_docs:
            data = doc.to_dict()
            paths = data.get("paths", [])
            image_url = paths[0] if (paths and len(paths) > 0) else "https://via.placeholder.com/600x600.png?text=No+Image"
            
            raw_price = data.get("price", "0")
            try:
                formatted_price = f"{int(float(raw_price)):,}"
            except (ValueError, TypeError):
                formatted_price = str(raw_price)

            real_items.append({
                "id": doc.id,
                "name": data.get("name", "이름 없음"),
                "price": formatted_price,
                "image_url": image_url
            })
            
        return {"items": real_items}
        
    except Exception as e:
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
            image_url = paths[0] if (paths and len(paths) > 0) else "https://via.placeholder.com/600x600.png?text=No+Image"
            
            # 가격(price) 필드에 회계 단위 쉼표(,) 추가 로직 적용
            raw_price = data.get("price", "0")
            try:
                formatted_price = f"{int(float(raw_price)):,}"
            except (ValueError, TypeError):
                formatted_price = str(raw_price)

            # 프론트엔드 모바일 UX 향상을 위한 이름, 가격 추가 전송
            real_items.append({
                "id": doc.id,
                "name": data.get("name", "이름 없음"),
                "price": formatted_price,
                "image_url": image_url
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
async def get_item_detail(item_id: str):
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
        paths = data.get("paths", [])
        
        # 만약 이미지가 아예 없다면 임시 이미지라도 할당
        if not paths:
            paths = ["https://via.placeholder.com/600x600.png?text=No+Image"]
            
        raw_price = data.get("price", "0")
        try:
            formatted_price = f"{int(float(raw_price)):,}"
        except (ValueError, TypeError):
            formatted_price = str(raw_price)
            
        return {
            "id": doc.id,
            "name": data.get("name", "이름 없음"),
            "price": formatted_price,
            "paths": paths,       
            "sort": data.get("sort", "unclassified"),
            # 사용자의 지시에 따라, DB 원본 형태(띄어쓰기 포함)를 그대로 보존하며 str 캐스팅만 수행
            "code": str(data.get("code", ""))
        }
        
    except Exception as e:
        print(f"🔥 상세 상품 조회 에러 발생: {e}")
        return {"error": str(e), "status": 500}




@app.post("/api/telegram")
async def send_telegram_msg():
    return {"status": "success", "message": "텔레그램 전송 API 뼈대입니다."}
