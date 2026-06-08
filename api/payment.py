from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse, RedirectResponse
import requests
import json
import os
import re
import base64
from datetime import datetime
from firebase_admin import db as rtdb

router = APIRouter()

# -------------------------------------------------------------
# 토스페이먼츠 설정 로드
# -------------------------------------------------------------
TOSS_CLIENT_KEY = ""
TOSS_SECRET_KEY = ""

config_path = os.path.join(os.path.dirname(__file__), "..", "database", "tosspayment.json")
try:
    if os.path.exists(config_path):
        with open(config_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            TOSS_CLIENT_KEY = data.get("widget_client_key", "")
            TOSS_SECRET_KEY = data.get("widget_secret_key", "")
except Exception as e:
    print(f"🔥 토스페이먼츠 설정 로드 에러: {e}")

# -------------------------------------------------------------
# 헬퍼 함수: 이메일을 DB 키로 안전하게 변환 (. -> ,)
# -------------------------------------------------------------
def sanitize_email(email: str):
    return email.replace(".", ",")

@router.get("/config")
async def get_toss_config(request: Request):
    """
    프론트엔드(SDK)를 그릴 때 필요한 클라이언트 키를 안전하게 제공
    (하드코딩 방지)
    """
    if not request.session.get("is_wholesale"):
        raise HTTPException(status_code=403, detail="Unauthorized")
    return {"client_key": TOSS_CLIENT_KEY}

@router.post("/pending_order")
async def create_pending_order(request: Request):
    """
    고객이 결제 버튼을 눌렀을 때 토스 결제창을 띄우기 직전에 호출됨.
    장바구니와 배송지 정보를 Realtime DB에 계층 구조(ws_orders/email/orderId)로 가주문 저장함.
    """
    email = request.session.get("user_id")
    if not email:
        return JSONResponse(status_code=403, content={"status": "error", "message": "권한 없음"})
    
    try:
        body = await request.json()
        order_id = body.get("orderId")
        safe_email = sanitize_email(email)
        
        # RTDB에 계층형 가주문 저장
        ref = rtdb.reference(f'ws_orders/{safe_email}/{order_id}')
        ref.set({
            "orderId": order_id,
            "orderName": body.get("orderName"),
            "amount": body.get("amount"),
            "cart": body.get("cart", []),
            "customer": {
                "name": body.get("customerName"),
                "phone": body.get("customerPhone"),
                "email": email
            },
            "shipping": {
                "postcode": body.get("postcode"),
                "address": body.get("address"),
                "detailAddress": body.get("detailAddress")
            },
            "status": "결제대기",
            "createdAt": datetime.now().isoformat()
        })
        return {"status": "success"}
    except Exception as e:
        print(f"🔥 가주문 생성 에러: {e}")
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})

@router.get("/toss_success")
async def toss_success_callback(request: Request, paymentKey: str, orderId: str, amount: str):
    """
    토스페이먼츠 결제창에서 가승인 후 리다이렉트되어 돌아오는 콜백 주소 (GET).
    계층 구조 경로에서 주문 정보를 찾아 최종 승인 상태로 업데이트함.
    """
    email = request.session.get("user_id")
    if not email:
        return RedirectResponse(url="/login")
        
    try:
        safe_email = sanitize_email(email)
        auth_string = f"{TOSS_SECRET_KEY}:"
        auth_base64 = base64.b64encode(auth_string.encode('utf-8')).decode('utf-8')
        
        url = "https://api.tosspayments.com/v1/payments/confirm"
        headers = {
            "Authorization": f"Basic {auth_base64}",
            "Content-Type": "application/json"
        }
        payload = {
            "paymentKey": paymentKey,
            "orderId": orderId,
            "amount": amount
        }
        
        response = requests.post(url, headers=headers, json=payload)
        result = response.json()
        
        if response.status_code == 200:
            # 🏁 결제 최종 승인 완료!
            # 계층형 경로 업데이트 (ws_orders/email/orderId)
            ref = rtdb.reference(f'ws_orders/{safe_email}/{orderId}')
            ref.update({
                "status": "결제 완료",
                "paymentKey": paymentKey,
                "paidAt": datetime.now().isoformat()
            })
            
            redirect_response = RedirectResponse(url="/wholesale/success", status_code=303)
            redirect_response.delete_cookie(key="wholesale_cart", path="/")
            return redirect_response
        else:
            error_msg = result.get("message", "결제 승인 실패")
            print(f"🔥 토스 결제 승인 실패: {error_msg}")
            return RedirectResponse(url="/wholesale/cart", status_code=303)
            
    except Exception as e:
        print(f"🔥 결제 승인 통신 에러: {e}")
        return RedirectResponse(url="/wholesale/cart", status_code=303)

# -------------------------------------------------------------
# 텔레그램 설정 로드
# -------------------------------------------------------------
TELEGRAM_TOKEN = ""
CANCEL_CHAT_ID = ""

tg_path = os.path.join(os.path.dirname(__file__), "..", "database", "telegram.json")
try:
    if os.path.exists(tg_path):
        with open(tg_path, "r", encoding="utf-8") as f:
            tg_data = json.load(f)
            TELEGRAM_TOKEN = tg_data.get("bot_token", "")
            CANCEL_CHAT_ID = tg_data.get("user_cancel_id", "")
except Exception as e:
    print(f"🔥 텔레그램 설정 로드 에러: {e}")

def send_telegram_message(chat_id, text):
    if not TELEGRAM_TOKEN or not chat_id:
        return
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    try:
        requests.post(url, json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"})
    except Exception as e:
        print(f"🔥 텔레그램 발송 에러: {e}")

@router.get("/my_orders")
async def get_my_orders(request: Request):
    """
    현재 로그인한 도매 유저의 전체 주문 내역을 계층 구조에서 가져옴.
    """
    email = request.session.get("user_id")
    if not email:
        return JSONResponse(status_code=403, content={"status": "error", "message": "권한 없음"})
    
    try:
        safe_email = sanitize_email(email)
        ref = rtdb.reference(f'ws_orders/{safe_email}')
        orders_dict = ref.get() # 해당 유저의 모든 주문 노드 가져오기
        
        if not orders_dict:
            return []
            
        # 🏁 [필터링] '결제대기' 상태인 주문은 리스트에 포함하지 않음
        orders_list = [v for v in orders_dict.values() if v.get('status') != "결제대기"]
        
        # 최신순 정렬 (생성일자 기준 내림차순)
        orders_list.sort(key=lambda x: x.get('createdAt', ''), reverse=True)
        
        return orders_list
    except Exception as e:
        print(f"🔥 내 주문 목록 로드 에러: {e}")
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})

@router.post("/cancel_request")
async def request_order_cancel(request: Request):
    """
    도매 고객이 주문 취소를 요청했을 때 호출됨.
    관리자 텔레그램으로 정보를 전송함.
    """
    email = request.session.get("user_id")
    if not email:
        return JSONResponse(status_code=403, content={"status": "error", "message": "권한 없음"})

    try:
        body = await request.json()
        order_id = body.get("orderId")
        safe_email = sanitize_email(email)
        
        # RTDB에서 주문 정보 확인
        ref = rtdb.reference(f'ws_orders/{safe_email}/{order_id}')
        order_data = ref.get()
        
        if not order_data:
            return JSONResponse(status_code=404, content={"status": "error", "message": "주문을 찾을 수 없습니다."})

        # 텔레그램 메시지 구성
        customer = order_data.get("customer", {})
        message = (
            f"<b>🚨 도매 주문 취소 요청 알림</b>\n\n"
            f"<b>주문번호:</b> {order_id}\n"
            f"<b>주문명:</b> {order_data.get('orderName')}\n"
            f"<b>금액:</b> ₩{order_data.get('amount'):,}\n\n"
            f"<b>[취소 요청 고객 정보]</b>\n"
            f"<b>성함:</b> {customer.get('name')}\n"
            f"<b>연락처:</b> {customer.get('phone')}\n"
            f"<b>이메일:</b> {customer.get('email')}\n"
        )
        
        send_telegram_message(CANCEL_CHAT_ID, message)
        
        # [신규] DB 상태를 '취소 요청 완료'로 업데이트
        ref.update({"status": "취소 요청 완료"})
        
        return {"status": "success", "message": "취소 요청이 완료되었습니다. 관리자 확인 후 처리가 진행됩니다."}
    except Exception as e:
        print(f"🔥 취소 요청 처리 에러: {e}")
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})

@router.post("/exchange_request")
async def request_order_exchange(request: Request):
    """
    도매 고객이 주문 교환을 요청했을 때 호출됨.
    관리자 텔레그램으로 정보를 전송하고 상태를 업데이트함.
    """
    email = request.session.get("user_id")
    if not email:
        return JSONResponse(status_code=403, content={"status": "error", "message": "권한 없음"})

    try:
        body = await request.json()
        order_id = body.get("orderId")
        safe_email = sanitize_email(email)
        
        ref = rtdb.reference(f'ws_orders/{safe_email}/{order_id}')
        order_data = ref.get()
        
        if not order_data:
            return JSONResponse(status_code=404, content={"status": "error", "message": "주문을 찾을 수 없습니다."})

        customer = order_data.get("customer", {})
        message = (
            f"<b>🔄 도매 주문 교환 요청 알림</b>\n\n"
            f"<b>주문번호:</b> {order_id}\n"
            f"<b>주문명:</b> {order_data.get('orderName')}\n"
            f"<b>금액:</b> ₩{order_data.get('amount'):,}\n\n"
            f"<b>[교환 요청 고객 정보]</b>\n"
            f"<b>성함:</b> {customer.get('name')}\n"
            f"<b>연락처:</b> {customer.get('phone')}\n"
            f"<b>이메일:</b> {customer.get('email')}\n"
        )
        
        send_telegram_message(CANCEL_CHAT_ID, message)
        
        # DB 상태를 '교환 요청 완료'로 업데이트
        ref.update({"status": "교환 요청 완료"})
        
        return {"status": "success", "message": "교환 요청이 완료되었습니다. 관리자 확인 후 처리가 진행됩니다."}
    except Exception as e:
        print(f"🔥 교환 요청 처리 에러: {e}")
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})

def get_next_hour_slot(time_str: str) -> str:
    try:
        val = int(time_str)
        next_val = val + 100
        return f"{next_val:04d}"
    except Exception:
        return ""

@router.get("/check_active_booking")
async def check_active_booking(request: Request):
    """
    현재 로그인한 고객의 활성 예약("예약 완료" 상태)이 이미 존재하는지 검사합니다. (1인 1회 제한용)
    """
    email = request.session.get("user_id")
    if not email:
        return JSONResponse(status_code=403, content={"status": "error", "message": "로그인이 필요합니다."})
    
    try:
        safe_email = sanitize_email(email)
        ref = rtdb.reference(f'booking/{safe_email}')
        bookings_dict = ref.get()
        
        has_active = False
        if bookings_dict:
            for b in bookings_dict.values():
                if b.get("status") == "예약 완료":
                    has_active = True
                    break
                    
        return {"status": "success", "has_active": has_active}
    except Exception as e:
        print(f"🔥 중복 예약 체크 에러: {e}")
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})

@router.get("/visit_schedule")
async def get_visit_schedule(date: str):
    """
    특정 날짜(YYYY-MM-DD)의 본사 방문 피팅 예약 가능 시간 슬롯 현황을 RTDB에서 조회합니다.
    """
    try:
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", date):
            return JSONResponse(status_code=400, content={"status": "error", "message": "올바르지 않은 날짜 형식입니다."})
            
        ref = rtdb.reference(f'schedule/{date}')
        slots = ref.get()
        if not slots:
            slots = {}
            
        return {"status": "success", "schedule": slots}
    except Exception as e:
        print(f"🔥 방문 스케줄 조회 에러: {e}")
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})

# -------------------------------------------------------------
# 🏁 일반 매장 및 방문 피팅 예약 확정 API 엔진 탑재
# -------------------------------------------------------------
@router.post("/booking")
async def create_booking(request: Request):
    """
    일반 고객 또는 도매 고객의 오프라인 안경점 피팅 또는 본사 방문 피팅 예약을 최종 확정합니다.
    1인 1회 예약 제한 정책을 확인하고 중복 예약을 방어합니다.
    """
    email = request.session.get("user_id")
    user_role = request.session.get("user_role", "guest")
    if not email:
        return JSONResponse(status_code=403, content={"status": "error", "message": "권한 없음. 로그인이 필요합니다."})
    
    try:
        body = await request.json()
        items = body.get("items", [])
        booking_type = body.get("bookingType", "store") # "store" (안경점) 또는 "visit" (본사 방문)
        
        # 1. 1인 1회 예약 제한 정책 검증 (로그인 이메일 기준 활성 예약 조회)
        safe_email = sanitize_email(email)
        bookings_ref = rtdb.reference(f'booking/{safe_email}')
        existing_bookings = bookings_ref.get()
        if existing_bookings:
            for b in existing_bookings.values():
                if b.get("status") == "예약 완료":
                    return JSONResponse(status_code=400, content={"status": "error", "message": "이미 활성화된 피팅 예약 내역이 존재합니다. 예약은 1인당 1회만 가능합니다."})
        
        # 2. 필수 데이터 검증 및 분기 정보 세팅
        store_name = ""
        reserved_date = ""
        reserved_time = ""
        address = ""
        
        if booking_type == "visit":
            reserved_date = body.get("reservedDate", "")
            reserved_time = body.get("reservedTime", "")
            address = body.get("address", "")
            if not items or not reserved_date or not reserved_time or not address:
                return JSONResponse(status_code=400, content={"status": "error", "message": "필수 방문 예약 정보가 누락되었습니다."})
            
            # 당일 예약 및 과거 예약 금지 검증 추가
            try:
                booking_date_obj = datetime.strptime(reserved_date, "%Y-%m-%d").date()
                if booking_date_obj <= datetime.now().date():
                    return JSONResponse(status_code=400, content={"status": "error", "message": "당일 예약 또는 과거 날짜의 예약은 불가능합니다."})
            except ValueError:
                return JSONResponse(status_code=400, content={"status": "error", "message": "올바르지 않은 예약 날짜 형식입니다."})
        else:
            store_name = body.get("storeName", "")
            if not items or not store_name:
                return JSONResponse(status_code=400, content={"status": "error", "message": "필수 안경점 예약 정보가 누락되었습니다."})

        # 3. 고유 예약 ID 생성 (B + 년월일시분초 + 무작위 3자리)
        import random
        now = datetime.now()
        booking_id = f"B{now.strftime('%y%m%d%H%M%S')}{random.randint(100, 999)}"
        
        # 4. 본사 방문 피팅 예약인 경우: 실시간 스케줄 락(Locking) 설정 (연속 2시간)
        if booking_type == "visit":
            next_time = get_next_hour_slot(reserved_time)
            if not next_time:
                return JSONResponse(status_code=400, content={"status": "error", "message": "올바르지 않은 예약 시간입니다."})
            
            # RTDB에서 가용 여부 선행 검증 (동시 예약 충돌 방지)
            schedule_ref = rtdb.reference(f'schedule/{reserved_date}')
            slots = schedule_ref.get() or {}
            
            slot1_status = slots.get(reserved_time, {}).get("status", "available")
            slot2_status = slots.get(next_time, {}).get("status", "available")
            
            if slot1_status == "reserved" or slot2_status == "reserved":
                return JSONResponse(status_code=400, content={"status": "error", "message": "선택하신 시간대에 이미 다른 예약이 확정되었습니다. 다른 시간을 선택해 주세요."})
            
            # 2개 시간 슬롯 락 적용
            schedule_ref.child(reserved_time).update({"status": "reserved", "booking_id": booking_id})
            schedule_ref.child(next_time).update({"status": "reserved", "booking_id": booking_id})
            
        # 5. Firestore에서 예약자 실명 및 연락처 연동
        from firebase_admin import firestore
        db_fs = firestore.client()
        
        customer_name = "알 수 없음"
        customer_phone = "알 수 없음"
        
        if user_role == "general":
            user_doc = db_fs.collection("general_users").document(email).get()
            if user_doc.exists:
                ud = user_doc.to_dict()
                customer_name = ud.get("name", "일반 고객")
                customer_phone = ud.get("phoneNumber", "연락처 미등록")
        elif user_role == "wholesale":
            user_doc = db_fs.collection("wholesale_users").document(email).get()
            if user_doc.exists:
                ud = user_doc.to_dict()
                customer_name = ud.get("name", "도매 고객")
                customer_phone = ud.get("business_number", "사업자 회원")
                
        # 첫 번째 안경 아이템 이름을 백엔드에서 직접 조회하여 요약 생성
        first_item_name = "안경 상품"
        if len(items) > 0:
            try:
                item_doc = db_fs.collection("item").document(items[0]).get()
                if item_doc.exists:
                    first_item_name = item_doc.to_dict().get("name", "안경 상품")
            except Exception as ie:
                print(f"🔥 예약 상품 정보 연동 중 에러: {ie}")
                
        goods_summary = f"{first_item_name} 포함 총 {len(items)}개"
        
        # 6. Firebase RTDB 예약 노드 저장
        booking_data = {
            "bookingId": booking_id,
            "items": items,
            "bookingType": booking_type,
            "storeName": store_name,
            "reservedDate": reserved_date,
            "reservedTime": reserved_time,
            "address": address,
            "customerName": customer_name,
            "customerPhone": customer_phone,
            "customerEmail": email,
            "status": "예약 완료",
            "createdAt": now.isoformat()
        }
        bookings_ref.child(booking_id).set(booking_data)
        
        # 7. 텔레그램 user_request_id 채널로 접수 메시지 전송
        if booking_type == "visit":
            place_info = f"방문 피팅 장소: {address} ({reserved_date} {reserved_time[0:2]}:{reserved_time[2:4]} ~ 2시간)"
        else:
            place_info = f"예약매장: {store_name}"
            if address:
                place_info += f" ({address})"
        tg_message = (
            f"📅 <b>[신규 피팅 예약 접수]</b>\n\n"
            f"<b>예약번호:</b> {booking_id}\n"
            f"<b>예약유형:</b> {'1:1 안경 피팅' if booking_type == 'visit' else '안경점 매장 피팅'}\n"
            f"<b>예약고객:</b> {customer_name} ({email})\n"
            f"<b>연락처:</b> {customer_phone}\n"
            f"<b>{place_info}</b>\n"
            f"<b>예약상품:</b> {goods_summary}\n"
            f"<b>접수일시:</b> {now.strftime('%Y-%m-%d %H:%M:%S')}\n"
        )
        
        tg_path = os.path.join(os.path.dirname(__file__), "..", "database", "telegram.json")
        tg_request_chat_id = ""
        if os.path.exists(tg_path):
            with open(tg_path, "r", encoding="utf-8") as f:
                tg_data = json.load(f)
                tg_request_chat_id = tg_data.get("user_request_id", "")
                
        if tg_request_chat_id:
            send_telegram_message(tg_request_chat_id, tg_message)
            
        return {"status": "success", "bookingId": booking_id}
        
    except Exception as e:
        print(f"🔥 피팅 예약 처리 중 에러: {e}")
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})

# -------------------------------------------------------------
# 🏁 일반 매장 피팅 예약 조회 및 취소 API 엔진 탑재
# -------------------------------------------------------------
@router.get("/my_bookings")
async def get_my_bookings(request: Request):
    """
    현재 로그인한 고객의 오프라인 안경점 피팅 예약 내역 목록을 RTDB에서 조회합니다.
    """
    email = request.session.get("user_id")
    if not email:
        return JSONResponse(status_code=403, content={"status": "error", "message": "로그인이 필요합니다."})
        
    try:
        safe_email = sanitize_email(email)
        ref = rtdb.reference(f'booking/{safe_email}')
        bookings_dict = ref.get()
        
        if not bookings_dict:
            return []
            
        # 🏁 리스트로 전환 및 생성일시 기준 내림차순(최신순) 정렬
        bookings_list = list(bookings_dict.values())
        bookings_list.sort(key=lambda x: x.get('createdAt', ''), reverse=True)
        
        return bookings_list
    except Exception as e:
        print(f"🔥 내 예약 목록 로드 에러: {e}")
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})

@router.post("/booking/{booking_id}/cancel")
async def cancel_booking(request: Request, booking_id: str):
    """
    고객의 오프라인 안경점 피팅 예약을 취소합니다.
    1. RTDB의 예약 데이터 상태를 '예약 취소'로 업데이트합니다. (고객 이력 보존 목적)
    2. 텔레그램 bot_token 및 user_cancel_id 채널을 통해 취소 알림을 발송합니다.
    """
    email = request.session.get("user_id")
    if not email:
        return JSONResponse(status_code=403, content={"status": "error", "message": "로그인이 필요합니다."})
        
    try:
        safe_email = sanitize_email(email)
        
        # 🏁 RTDB에서 기존 예약 정보 조회
        ref = rtdb.reference(f'booking/{safe_email}/{booking_id}')
        booking_data = ref.get()
        
        if not booking_data:
            return JSONResponse(status_code=404, content={"status": "error", "message": "예약 내역을 찾을 수 없습니다."})
            
        # 🏁 [신규] 당일 취소 제한 및 과거 예약 취소 차단 로직 적용
        booking_type = booking_data.get("bookingType", "store")
        from datetime import timezone, timedelta
        kst = timezone(timedelta(hours=9))
        now_kst = datetime.now(kst)
        today_kst = now_kst.date()

        if booking_type == "visit":
            reserved_date_str = booking_data.get("reservedDate")
            if reserved_date_str:
                try:
                    reserved_date = datetime.strptime(reserved_date_str, "%Y-%m-%d").date()
                    if reserved_date <= today_kst:
                        return JSONResponse(
                            status_code=400,
                            content={
                                "status": "error",
                                "message": "방문 피팅 당일(또는 예약일 이후)에는 예약 취소가 불가능합니다. 취소는 예약 전날까지만 가능합니다."
                            }
                        )
                except Exception as date_err:
                    print(f"🔥 예약일 파싱 에러: {date_err}")
        elif booking_type == "store":
            created_at_str = booking_data.get("createdAt")
            if created_at_str:
                try:
                    created_at = datetime.fromisoformat(created_at_str)
                    if created_at.tzinfo is not None:
                        now_compare = datetime.now(timezone.utc)
                        time_diff = now_compare - created_at
                    else:
                        now_compare = datetime.now()
                        time_diff = now_compare - created_at
                    
                    if time_diff > timedelta(days=7):
                        return JSONResponse(
                            status_code=400,
                            content={
                                "status": "error",
                                "message": "안경점 매장 피팅 예약은 접수 후 7일 이내에만 취소할 수 있습니다."
                            }
                        )
                except Exception as date_err:
                    print(f"🔥 매장 접수일 파싱 에러: {date_err}")
        
        # 🏁 1. DB의 예약 상태를 '예약 취소'로 업데이트
        ref.update({
            "status": "예약 취소",
            "cancelledAt": datetime.now().isoformat()
        })
        
        # 🏁 1.5. 본사 방문 피팅 예약인 경우: 실시간 스케줄 락 해제 (연속 2시간)
        booking_type = booking_data.get("bookingType", "store")
        if booking_type == "visit":
            reserved_date = booking_data.get("reservedDate")
            reserved_time = booking_data.get("reservedTime")
            if reserved_date and reserved_time:
                next_time = get_next_hour_slot(reserved_time)
                if next_time:
                    schedule_ref = rtdb.reference(f'schedule/{reserved_date}')
                    schedule_ref.child(reserved_time).update({"status": "available", "booking_id": None})
                    schedule_ref.child(next_time).update({"status": "available", "booking_id": None})
        
        # 🏁 2. 텔레그램 user_cancel_id 채널로 취소 알림 발송
        customer_name = booking_data.get("customerName", "알 수 없음")
        customer_phone = booking_data.get("customerPhone", "알 수 없음")
        store_name = booking_data.get("storeName", "미선택 매장")
        
        # 첫 상품명 조회를 시도하여 요약 생성
        from firebase_admin import firestore
        db_fs = firestore.client()
        items = booking_data.get("items", [])
        first_item_name = "안경 상품"
        if len(items) > 0:
            try:
                item_doc = db_fs.collection("item").document(items[0]).get()
                if item_doc.exists:
                    first_item_name = item_doc.to_dict().get("name", "안경 상품")
            except Exception:
                pass
        goods_summary = f"{first_item_name} 포함 총 {len(items)}개"
        
        tg_message = (
            f"🚨 <b>[매장 피팅 예약 취소 알림]</b>\n\n"
            f"<b>예약번호:</b> {booking_id}\n"
            f"<b>예약고객:</b> {customer_name} ({email})\n"
            f"<b>연락처:</b> {customer_phone}\n"
            f"<b>예약매장:</b> {store_name}\n"
            f"<b>예약상품:</b> {goods_summary}\n"
            f"<b>취소일시:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
        )
        
        # database/telegram.json 로드하여 user_cancel_id 획득
        tg_cancel_chat_id = ""
        if os.path.exists(tg_path):
            with open(tg_path, "r", encoding="utf-8") as f:
                tg_data = json.load(f)
                tg_cancel_chat_id = tg_data.get("user_cancel_id", "")
                
        if tg_cancel_chat_id:
            send_telegram_message(tg_cancel_chat_id, tg_message)
            
        return {"status": "success", "message": "예약이 성공적으로 취소되었습니다."}
        
    except Exception as e:
        print(f"🔥 매장 피팅 예약 취소 에러: {e}")
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})


@router.get("/search_external_store")
async def search_external_store(request: Request, keyword: str):
    """
    사용자의 동/면 입력값을 받아 "{keyword} 안경원"으로 카카오 로컬 검색 API를 호출합니다.
    """
    email = request.session.get("user_id")
    if not email:
        return JSONResponse(status_code=403, content={"status": "error", "message": "권한 없음. 로그인이 필요합니다."})
    
    if not keyword or not keyword.strip():
        return JSONResponse(status_code=400, content={"status": "error", "message": "검색어를 입력해 주세요."})
        
    # 카카오 API 키 로드
    api_key = ""
    kakao_path = os.path.join(os.path.dirname(__file__), "..", "database", "kakao_api.json")
    try:
        if os.path.exists(kakao_path):
            with open(kakao_path, "r", encoding="utf-8") as f:
                kakao_data = json.load(f)
                api_key = kakao_data.get("client_id", "")
    except Exception as e:
        print(f"🔥 카카오 API 설정 로드 에러: {e}")
        return JSONResponse(status_code=500, content={"status": "error", "message": "카카오 API 설정을 불러올 수 없습니다."})
        
    if not api_key:
        return JSONResponse(status_code=500, content={"status": "error", "message": "카카오 API 키가 설정되지 않았습니다."})
        
    try:
        # "{입력값} 안경원" 검색어 조합
        query_str = f"{keyword.strip()} 안경원"
        url = "https://dapi.kakao.com/v2/local/search/keyword.json"
        headers = {
            "Authorization": f"KakaoAK {api_key}"
        }
        params = {
            "query": query_str,
            "size": 15 # 최대 15개 반환
        }
        
        response = requests.get(url, headers=headers, params=params)
        if response.status_code != 200:
            print(f"🔥 카카오 로컬 API 호출 에러: {response.text}")
            return JSONResponse(status_code=response.status_code, content={"status": "error", "message": "카카오 API 호출에 실패했습니다."})
            
        result = response.json()
        documents = result.get("documents", [])
        
        # 필요한 정보만 가공하여 리턴
        stores = []
        for doc in documents:
            stores.append({
                "id": doc.get("id"),
                "place_name": doc.get("place_name"),
                "address_name": doc.get("address_name"),
                "road_address_name": doc.get("road_address_name"),
                "phone": doc.get("phone"),
                "place_url": doc.get("place_url")
            })
            
        return {"status": "success", "stores": stores}
    except Exception as e:
        print(f"🔥 외부 매장 검색 에러: {e}")
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})



