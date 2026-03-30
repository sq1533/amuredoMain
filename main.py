from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
import os

app = FastAPI()

# 정적 파일(HTML, CSS, JS, 이미지 등)을 서비스하기 위한 경로 마운트
static_dir = os.path.join(os.path.dirname(__file__), "static")
if not os.path.exists(static_dir):
    os.makedirs(static_dir)

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/", response_class=HTMLResponse)
async def serve_frontend():
    """
    프론트엔드 메인 페이지 서빙 (루트 경로 접속 시 index.html 반환)
    """
    index_path = os.path.join(static_dir, "index.html")
    # 파일이 실제로 존재하지 않으면 임시 안내 메시지 반환
    if not os.path.exists(index_path):
        return "<h1>index.html 파일이 아직 생성되지 않았습니다.</h1>"
        
    with open(index_path, "r", encoding="utf-8") as f:
        return f.read()

@app.get("/api/banner")
async def get_banner_data():
    """
    Firebase Store 'vanner > vanner > paths' 구조에서
    이미지 리스트를 읽어오는 API (현재는 더미 데이터 제공)
    
    [실제 개발 시 필요 사항]
    - firebase-admin 패키지 설정
    - 서비스 계정 키(JSON) 연동 및 Firestore 클라이언트 활용
    """
    # 프론트엔드 캐러셀 배너 기능 테스트용 더미 이미지 URL 파싱
    dummy_paths = [
        "https://via.placeholder.com/1024x614.png?text=amuredo+Banner+1",
        "https://via.placeholder.com/1024x614.png?text=amuredo+Banner+2",
        "https://via.placeholder.com/1024x614.png?text=amuredo+Banner+3"
    ]
    return {"paths": dummy_paths}

@app.post("/api/telegram")
async def send_telegram_msg():
    """
    Telegram Bot API로 메세지를 전송하기 위한 백엔드 엔드포인트 뼈대.
    - 실제 연동 시 requests 또는 aiohttp 모듈로 https://api.telegram.org/bot<TOKEN>/sendMessage 호출
    """
    return {"status": "success", "message": "텔레그램 전송 API가 호출되었습니다."}

@app.get("/api/items/best")
async def get_best_items():
    """
    Firebase Store 'items > [id]' 에서
    조건문(event == 'best') 필터를 거친 아이템 목록만 반환하는 API (현재 더미 데이터 제공)
    
    [실제 개발 시 필요한 백엔드 Firebase 로직]
    - firebase_admin 모듈의 firestore 클라이언트를 이용해
      db.collection("items").where("event", "==", "best").stream() 처럼 구성.
    """
    dummy_best_items = [
        {
            "id": "item_1955",
            "name": "레티놀 세럼 30ml 미니",
            "price": "52,000 원",
            "image_url": "https://via.placeholder.com/600x600.png?text=Best+Item+1"
        },
        {
            "id": "item_1956",
            "name": "아쿠아 수딩 토너 200ml",
            "price": "34,000 원",
            "image_url": "https://via.placeholder.com/600x600.png?text=Best+Item+2"
        },
        {
            "id": "item_1957",
            "name": "시그니처 바디 워시 플로럴",
            "price": "28,500 원",
            "image_url": "https://via.placeholder.com/600x600.png?text=Best+Item+3"
        },
        {
            "id": "item_1958",
            "name": "모이스처라이징 핸드 크림",
            "price": "19,000 원",
            "image_url": "https://via.placeholder.com/600x600.png?text=Best+Item+4"
        },
        {
            "id": "item_1959",
            "name": "매트 피니쉬 선블록 SPF50",
            "price": "24,000 원",
            "image_url": "https://via.placeholder.com/600x600.png?text=Best+Item+5"
        }
    ]
    return {"items": dummy_best_items}
