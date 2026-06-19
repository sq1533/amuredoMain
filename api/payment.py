from fastapi import APIRouter, Request, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse, RedirectResponse, HTMLResponse
from starlette.concurrency import run_in_threadpool
from typing import Optional
import requests
import json
import os
import re
import base64
from datetime import datetime
from firebase_admin import db as rtdb
from firebase_admin import firestore

router = APIRouter()

def get_base_url(request: Request) -> str:
    is_local = "localhost" in request.url.netloc or "127.0.0.1" in request.url.netloc
    scheme = "http" if is_local else "https"
    return f"{scheme}://{request.url.netloc}"


# -------------------------------------------------------------
# 다날 결제 설정 로드
# -------------------------------------------------------------
DANAL_CLIENT_KEY = ""
DANAL_MERCHANT_ID = ""
DANAL_SECRET_KEY = ""
DANAL_API_URL = "https://one-api.danalpay.com"

danal_config_path = os.path.join(os.path.dirname(__file__), "..", "database", "danal_api.json")
try:
    if os.path.exists(danal_config_path):
        with open(danal_config_path, "r", encoding="utf-8") as f:
            danal_data = json.load(f)
            DANAL_CLIENT_KEY = danal_data.get("client_key", "")
            DANAL_MERCHANT_ID = danal_data.get("merchant_id", "")
            DANAL_SECRET_KEY = danal_data.get("secret_key", "")
            DANAL_API_URL = danal_data.get("api_url", "https://api.danalpay.com")
except Exception as e:
    print(f"🔥 다날 설정 로드 에러: {e}")

# -------------------------------------------------------------
# 카카오페이 & 토스페이 설정 로드
# -------------------------------------------------------------
KAKAOPAY_CID = ""
KAKAOPAY_SECRET_KEY = ""
KAKAOPAY_APPROVAL_URL = ""
KAKAOPAY_CANCEL_URL = ""
KAKAOPAY_FAIL_URL = ""

TOSSPAY_API_KEY = ""
TOSSPAY_RET_URL = ""
TOSSPAY_RET_CANCEL_URL = ""

pay_config_path = os.path.join(os.path.dirname(__file__), "..", "database", "pay_api.json")
try:
    if os.path.exists(pay_config_path):
        with open(pay_config_path, "r", encoding="utf-8") as f:
            pay_data = json.load(f)
            
            kp_data = pay_data.get("kakaopay", {})
            KAKAOPAY_CID = kp_data.get("cid", "")
            KAKAOPAY_SECRET_KEY = kp_data.get("secret_key", "")
            KAKAOPAY_APPROVAL_URL = kp_data.get("approval_url", "")
            KAKAOPAY_CANCEL_URL = kp_data.get("cancel_url", "")
            KAKAOPAY_FAIL_URL = kp_data.get("fail_url", "")
            
            tp_data = pay_data.get("tosspay", {})
            TOSSPAY_API_KEY = tp_data.get("api_key", "")
            TOSSPAY_RET_URL = tp_data.get("retUrl", "")
            TOSSPAY_RET_CANCEL_URL = tp_data.get("retCancelUrl", "")
except Exception as e:
    print(f"🔥 카카오페이/토스페이 설정 로드 에러: {e}")

def confirm_danal_payment(method: str, transaction_id: str, merchant_id: str, amount: int, order_id: str) -> dict:
    """
    다날 승인 API 호출 헬퍼
    """
    auth_str = f"{DANAL_SECRET_KEY}:"
    auth_bytes = auth_str.encode('utf-8')
    auth_b64 = base64.b64encode(auth_bytes).decode('utf-8')
    
    headers = {
        "Authorization": f"Basic {auth_b64}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "method": method,
        "transactionId": transaction_id,
        "merchantId": merchant_id,
        "amount": amount,
        "orderId": order_id
    }
    
    confirm_url = f"{DANAL_API_URL.rstrip('/')}/payments/confirm"
    
    try:
        response = requests.post(confirm_url, json=payload, headers=headers, timeout=10)
        print(f"Danal Confirm Request Payload: {payload}")
        print(f"Danal Confirm Response: {response.status_code} - {response.text}")
        if response.status_code == 200:
            return response.json()
        else:
            try:
                err_data = response.json()
                return err_data
            except Exception:
                return {"code": "HTTP_ERROR", "message": f"HTTP {response.status_code}: {response.text}"}
    except Exception as e:
        print(f"🔥 다날 승인 API 호출 에러: {e}")
        return {"code": "EXCEPTION", "message": str(e)}

# -------------------------------------------------------------
# 헬퍼 함수: 이메일을 DB 키로 안전하게 변환 (. -> ,)
# -------------------------------------------------------------
def sanitize_email(email: str):
    return email.replace(".", ",")

def send_virtual_account_email(to_email: str, customer_name: str, order_id: str, order_name: str, amount: int, va_info: dict):
    # 이메일 주소 유효성 검사
    if not to_email or "@" not in to_email:
        print(f"⚠️ 이메일 발송 스킵: 유효하지 않은 이메일 주소 ({to_email})")
        return

    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    
    email_config_path = os.path.join(os.path.dirname(__file__), "..", "database", "email.json")
    if not os.path.exists(email_config_path):
        print("⚠️ 이메일 설정 파일(email.json)이 존재하지 않아 메일을 발송하지 못했습니다.")
        return
        
    try:
        with open(email_config_path, "r", encoding="utf-8") as f:
            config = json.load(f)
            
        smtp_server = config.get("smtp_server")
        smtp_port = config.get("smtp_port", 587)
        sender_email = config.get("sender_email")
        sender_password = config.get("sender_password")
    except Exception as e:
        print(f"🔥 이메일 설정 로딩 실패: {e}")
        return

    # 다날 입금 기한 포맷팅
    raw_expire = va_info.get("expireDateTime", "-")
    formatted_expire = raw_expire
    if raw_expire and len(raw_expire) == 14:  # YYYYMMDDHHmmss
        try:
            dt = datetime.strptime(raw_expire, "%Y%m%d%H%M%S")
            formatted_expire = dt.strftime("%Y-%m-%d %H:%M:%S")
        except Exception:
            pass
    elif "T" in raw_expire:
        try:
            dt_str = raw_expire.split("+")[0]
            dt = datetime.fromisoformat(dt_str)
            formatted_expire = dt.strftime("%Y-%m-%d %H:%M:%S")
        except Exception:
            pass

    # HTML 템플릿 구성
    html_content = f"""
    <div style="max-width: 600px; margin: 0 auto; padding: 30px; font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; border: 1px solid #eaeaea; border-radius: 12px; background: #ffffff;">
        <h2 style="color: #0e3a5b; border-bottom: 2px solid #0e3a5b; padding-bottom: 15px; margin-top: 0;">🏦 가상계좌 입금 안내 [아무래도 안경]</h2>
        <p style="font-size: 1rem; color: #333; line-height: 1.6;">
            안녕하세요, <strong>{customer_name}</strong> 고객님.<br>
            요청하신 주문의 가상계좌가 정상적으로 발급되었습니다. 아래의 정보를 확인하시어 기한 내에 입금해 주시기 바랍니다.
        </p>
        <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 25px 0; border: 1px solid #f0f0f0;">
            <table style="width: 100%; border-collapse: collapse; font-size: 0.95rem;">
                <tr>
                    <td style="padding: 10px 0; color: #666; font-weight: bold; width: 30%; border-bottom: 1px solid #eee;">주문번호</td>
                    <td style="padding: 10px 0; color: #333; border-bottom: 1px solid #eee;">{order_id}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; color: #666; font-weight: bold; border-bottom: 1px solid #eee;">상품명</td>
                    <td style="padding: 10px 0; color: #333; border-bottom: 1px solid #eee;">{order_name}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; color: #666; font-weight: bold; border-bottom: 1px solid #eee;">입금은행</td>
                    <td style="padding: 10px 0; color: #0e3a5b; font-weight: bold; border-bottom: 1px solid #eee;">{va_info.get('bankName')}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; color: #666; font-weight: bold; border-bottom: 1px solid #eee;">계좌번호</td>
                    <td style="padding: 10px 0; color: #d32f2f; font-weight: bold; font-size: 1.1rem; border-bottom: 1px solid #eee;">{va_info.get('accountNumber')}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; color: #666; font-weight: bold; border-bottom: 1px solid #eee;">예금주</td>
                    <td style="padding: 10px 0; color: #333; border-bottom: 1px solid #eee;">주식회사 키제이</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; color: #666; font-weight: bold; border-bottom: 1px solid #eee;">입금금액</td>
                    <td style="padding: 10px 0; color: #d32f2f; font-weight: bold; border-bottom: 1px solid #eee;">₩{amount:,}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 0; color: #666; font-weight: bold; border-bottom: 1px solid #eee;">입금기한</td>
                    <td style="padding: 10px 0; color: #e53935; font-weight: bold; border-bottom: 1px solid #eee;">{formatted_expire} 까지</td>
                </tr>
            </table>
        </div>
        <p style="font-size: 0.85rem; color: #666; line-height: 1.6; border-top: 1px dashed #eaeaea; padding-top: 15px; margin-bottom: 0;">
            ※ 입금 금액이 일치하지 않거나 입금 기한이 경과할 경우 입금 처리가 불가능합니다.<br>
            ※ 가상계좌 입금이 완료되면 자동으로 주문이 접수되며 알림톡/메시지가 발송됩니다.<br>
            ※ 문의사항은 고객센터 또는 이메일로 연락 바랍니다.
        </p>
    </div>
    """
    
    msg = MIMEMultipart()
    msg['From'] = sender_email
    msg['To'] = to_email
    msg['Subject'] = f"[아무래도 안경] 가상계좌 입금 안내 - {order_name}"
    msg.attach(MIMEText(html_content, 'html', 'utf-8'))
    
    try:
        server = smtplib.SMTP(smtp_server, smtp_port, timeout=10)
        server.starttls()
        server.login(sender_email, sender_password)
        server.sendmail(sender_email, [to_email], msg.as_string())
        server.quit()
        print(f"📧 이메일 발송 완료: {to_email}")
    except Exception as e:
        print(f"🔥 이메일 발송 실패: {e}")




@router.get("/config")
async def get_payment_config(request: Request):
    """
    프론트엔드(SDK)를 그릴 때 필요한 다날 클라이언트 키 및 가맹점 ID 및 24시간 가상계좌 기한을 안전하게 제공
    """
    if not request.session.get("user_id"):
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    from datetime import datetime, timedelta, timezone
    kst = timezone(timedelta(hours=9))
    expire_time = datetime.now(kst) + timedelta(hours=24)
    expire_datetime_str = expire_time.strftime("%Y%m%d%H%M%S")
    expire_date_str = expire_time.strftime("%Y%m%d")
    expire_time_str = expire_time.strftime("%H%M")
    
    return {
        "client_key": DANAL_CLIENT_KEY,
        "merchant_id": DANAL_MERCHANT_ID,
        "expire_datetime": expire_datetime_str,
        "expire_date": expire_date_str,
        "expire_time": expire_time_str
    }

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



# -------------------------------------------------------------
# 텔레그램 설정 로드
# -------------------------------------------------------------
TELEGRAM_TOKEN = ""
CANCEL_CHAT_ID = ""
REQUEST_CHAT_ID = ""

tg_path = os.path.join(os.path.dirname(__file__), "..", "database", "telegram.json")
try:
    if os.path.exists(tg_path):
        with open(tg_path, "r", encoding="utf-8") as f:
            tg_data = json.load(f)
            TELEGRAM_TOKEN = tg_data.get("bot_token", "")
            CANCEL_CHAT_ID = tg_data.get("user_cancel_id", "")
            REQUEST_CHAT_ID = tg_data.get("user_request_id", "")
except Exception as e:
    print(f"🔥 텔레그램 설정 로드 에러: {e}")

def send_telegram_message(chat_id, text):
    if not TELEGRAM_TOKEN or not chat_id:
        return
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    try:
        requests.post(url, json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"}, timeout=3)
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
async def request_order_cancel(request: Request, background_tasks: BackgroundTasks):
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
        
        background_tasks.add_task(send_telegram_message, CANCEL_CHAT_ID, message)
        
        # [신규] DB 상태를 '취소 요청 완료'로 업데이트
        ref.update({"status": "취소 요청 완료"})
        
        return {"status": "success", "message": "취소 요청이 완료되었습니다. 관리자 확인 후 처리가 진행됩니다."}
    except Exception as e:
        print(f"🔥 취소 요청 처리 에러: {e}")
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})

@router.post("/exchange_request")
async def request_order_exchange(request: Request, background_tasks: BackgroundTasks):
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
        
        background_tasks.add_task(send_telegram_message, CANCEL_CHAT_ID, message)
        
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
async def create_booking(request: Request, background_tasks: BackgroundTasks):
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
        
        if REQUEST_CHAT_ID:
            background_tasks.add_task(send_telegram_message, REQUEST_CHAT_ID, tg_message)
            
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
async def cancel_booking(request: Request, booking_id: str, background_tasks: BackgroundTasks):
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
        
        if CANCEL_CHAT_ID:
            background_tasks.add_task(send_telegram_message, CANCEL_CHAT_ID, tg_message)
            
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
        
        response = await run_in_threadpool(requests.get, url, headers=headers, params=params)
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


# -------------------------------------------------------------
# 🏁 피팅 완료 상품 선택 결제 신규 API 엔지니어링 탑재
# -------------------------------------------------------------
@router.get("/booking_checkout_details/{booking_id}")
async def get_booking_checkout_details(request: Request, booking_id: str):
    """
    고객의 피팅 완료된 예약건의 상세 내역 및 상품 목록을 조회합니다.
    도매가(wsPrice)는 절대 참조하지 않고 일반 소비자 가격(price)만 강제 적용합니다.
    """
    email = request.session.get("user_id")
    if not email:
        return JSONResponse(status_code=403, content={"status": "error", "message": "로그인이 필요합니다."})
        
    try:
        safe_email = sanitize_email(email)
        
        # 1. 예약 정보 조회
        ref = rtdb.reference(f'booking/{safe_email}/{booking_id}')
        booking_data = ref.get()
        if not booking_data:
            return JSONResponse(status_code=404, content={"status": "error", "message": "예약 내역을 찾을 수 없습니다."})
            
        # 2. 예약 상태 검증 (이용 완료 또는 결제 완료일 때만 접근 가능)
        if booking_data.get("status") not in ["이용 완료", "결제 완료"]:
            return JSONResponse(status_code=400, content={"status": "error", "message": "피팅이 완료되지 않은 예약건은 결제할 수 없습니다."})
            
        # 3. 예약된 안경 아이템들의 정보 및 일반 소비자 가격 조회
        db_fs = firestore.client()
        
        items_list = []
        items_arr = booking_data.get("items", [])
        for item_id in items_arr:
            try:
                item_doc = db_fs.collection("item").document(item_id).get()
                if item_doc.exists:
                    idata = item_doc.to_dict()
                    # 오직 일반 소비자 가격(price)만 획득 (wsPrice 무시)
                    price_val = idata.get("price", 0)
                    items_list.append({
                        "id": item_id,
                        "name": idata.get("name", "안경 상품"),
                        "image": (idata.get("paths") and idata.get("paths")[0]) or "/static/img/ready.webp",
                        "category": idata.get("category", ""),
                        "price": price_val
                    })
                else:
                    items_list.append({
                        "id": item_id,
                        "name": f"안경 상품 ({item_id})",
                        "image": "/static/img/ready.webp",
                        "category": "",
                        "price": 0
                    })
            except Exception as ie:
                print(f"🔥 아이템 정보 연동 중 에러: {ie}")
                
        # 4. 이미 결제 완료된 내역이 존재하는지 확인
        payment_ref = rtdb.reference(f'booking_payments/{booking_id}')
        payment_data = payment_ref.get() or {}
        
        paid_items = []
        for p_order in payment_data.values():
            if p_order.get("status") == "결제 완료":
                paid_items.extend(p_order.get("paidItems", []))

        return {
            "status": "success", 
            "booking": booking_data, 
            "items": items_list,
            "paidItems": paid_items
        }
    except Exception as e:
        print(f"🔥 결제 상세 조회 에러: {e}")
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})


@router.post("/pending_booking_order")
async def create_pending_booking_order(request: Request):
    """
    피팅 상품 결제를 위해 토스페이먼츠창을 띄우기 전 가주문을 임시 생성합니다.
    클라이언트가 전달한 금액을 신뢰하지 않고 서버에서 직접 소비자 가격 기준으로 총액을 계산하여 검증합니다.
    """
    email = request.session.get("user_id")
    if not email:
        return JSONResponse(status_code=403, content={"status": "error", "message": "로그인이 필요합니다."})
        
    try:
        body = await request.json()
        booking_id = body.get("bookingId")
        selected_item_ids = body.get("items", [])
        
        if not booking_id or not selected_item_ids:
            return JSONResponse(status_code=400, content={"status": "error", "message": "필수 결제 요청 정보가 누락되었습니다."})
            
        safe_email = sanitize_email(email)
        
        # 1. 예약 건 정보 조회
        booking_ref = rtdb.reference(f'booking/{safe_email}/{booking_id}')
        booking_data = booking_ref.get()
        if not booking_data:
            return JSONResponse(status_code=404, content={"status": "error", "message": "예약 내역을 찾을 수 없습니다."})
            
        # 2. 서버 측 소비자 가격 합산 연산 (변조 방지)
        db_fs = firestore.client()
        
        total_amount = 0
        for item_id in selected_item_ids:
            if item_id not in booking_data.get("items", []):
                return JSONResponse(status_code=400, content={"status": "error", "message": "예약 내역에 포함되지 않은 상품이 선택되었습니다."})
                
            item_doc = db_fs.collection("item").document(item_id).get()
            if item_doc.exists:
                idata = item_doc.to_dict()
                total_amount += int(idata.get("price", 0))
                
        if total_amount <= 0:
            return JSONResponse(status_code=400, content={"status": "error", "message": "결제 금액이 올바르지 않습니다."})
            
        # 3. 고유 가주문 ID 생성
        import random
        now = datetime.now()
        order_id = f"BKORD{now.strftime('%y%m%d%H%M%S')}{random.randint(100, 999)}"
        
        # 4. booking_orders 노드에 가결제 정보 기록
        ref = rtdb.reference(f'booking_orders/{order_id}')
        ref.set({
            "orderId": order_id,
            "bookingId": booking_id,
            "amount": total_amount,
            "items": selected_item_ids,
            "customer": {
                "name": booking_data.get("customerName", "고객"),
                "phone": booking_data.get("customerPhone", ""),
                "email": email
            },
            "status": "결제대기",
            "createdAt": now.isoformat()
        })
        
        return {"status": "success", "orderId": order_id, "amount": total_amount}
    except Exception as e:
        print(f"🔥 피팅 가주문 생성 에러: {e}")
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})




# -------------------------------------------------------------
# 🏁 다날 결제 전용 성공/실패 콜백 엔드포인트
# -------------------------------------------------------------
from fastapi import Form, Query

async def process_wholesale_success(
    request: Request,
    background_tasks: BackgroundTasks,
    orderId: Optional[str] = None,
    orderNo: Optional[str] = None,
    pg_token: Optional[str] = None,
    code: Optional[str] = None,
    message: Optional[str] = None,
    transactionId: Optional[str] = None,
    method: Optional[str] = None,
    amount: Optional[int] = None
):
    final_order_id = orderId or orderNo
    if not final_order_id:
        return RedirectResponse(url="/wholesale/cart", status_code=303)
        
    email = request.session.get("user_id")
    if not email:
        return RedirectResponse(url="/login")

    # 1. 결제수단 판별
    # pg_token이 전달된 경우 -> 카카오페이
    if pg_token:
        ref = rtdb.reference(f"payment_temp/{final_order_id}")
        temp_data = ref.get()
        if not temp_data:
            return await process_payment_fail(request, code="SESSION_NOT_FOUND", message="가결제 세션 정보를 찾을 수 없습니다.", orderId=final_order_id)
        
        tid = temp_data.get("tid")
        approve_amount = temp_data.get("amount")
        customer_email = temp_data.get("email")
        
        url = "https://open-api.kakaopay.com/online/v1/payment/approve"
        headers = {
            "Authorization": f"SECRET_KEY {KAKAOPAY_SECRET_KEY}",
            "Content-Type": "application/json"
        }
        payload = {
            "cid": KAKAOPAY_CID,
            "tid": tid,
            "partner_order_id": final_order_id,
            "partner_user_id": final_order_id,
            "pg_token": pg_token
        }
        response = await run_in_threadpool(requests.post, url, headers=headers, json=payload, timeout=10)
        res_json = response.json()
        if response.status_code != 200:
            err_msg = res_json.get("msg", "카카오페이 승인 실패")
            return await process_payment_fail(request, code="APPROVE_ERROR", message=err_msg, orderId=final_order_id)
            
        ref.delete()
        
        safe_email = sanitize_email(customer_email)
        ws_order_ref = rtdb.reference(f"ws_orders/{safe_email}/{final_order_id}")
        ws_order_ref.update({
            "status": "결제 완료",
            "transactionId": tid,
            "paidAt": datetime.now().isoformat(),
            "method": "KAKAOPAY",
            "pgProvider": "kakaopay"
        })
        
        redirect_response = RedirectResponse(url=f"/wholesale/success?orderId={final_order_id}", status_code=303)
        redirect_response.delete_cookie(key="wholesale_cart", path="/")
        return redirect_response

    # code와 transactionId가 전달된 경우 -> 다날
    elif code and transactionId:
        if code != "SUCCESS":
            return RedirectResponse(url=f"/wholesale/order?status=fail&message={message}", status_code=303)
            
        safe_email = sanitize_email(email)
        ref = rtdb.reference(f'ws_orders/{safe_email}/{final_order_id}')
        order_data = ref.get()
        if not order_data:
            return RedirectResponse(url="/wholesale/cart", status_code=303)
            
        if amount is not None and int(amount) != int(order_data.get("amount", 0)):
            return RedirectResponse(url="/wholesale/cart", status_code=303)
            
        confirm_res = await run_in_threadpool(
            confirm_danal_payment,
            method=method or "DANAL",
            transaction_id=transactionId,
            merchant_id=DANAL_MERCHANT_ID,
            amount=int(amount) if amount is not None else int(order_data.get("amount", 0)),
            order_id=final_order_id
        )
        if confirm_res.get("code") != "SUCCESS":
            err_msg = confirm_res.get("message", "결제 승인 실패")
            return RedirectResponse(url=f"/wholesale/order?status=fail&message={err_msg}", status_code=303)
            
        confirm_method = confirm_res.get("method") or method or "DANAL"
        is_vaccount = confirm_method.upper() == "VACCOUNT"
        status_text = "입금 대기" if is_vaccount else "결제 완료"
        
        update_payload = {
            "status": status_text,
            "transactionId": transactionId,
            "method": confirm_method,
            "pgProvider": "danal"
        }
        
        if not is_vaccount:
            update_payload["paidAt"] = datetime.now().isoformat()
        else:
            va_info = confirm_res.get("virtualAccount")
            if isinstance(va_info, dict):
                update_payload["virtualAccount"] = {
                    "accountNumber": va_info.get("accountNumber"),
                    "bankCode": va_info.get("bankCode"),
                    "bankName": va_info.get("bankName"),
                    "expireDateTime": va_info.get("expireDateTime")
                }
            else:
                update_payload["virtualAccount"] = {
                    "accountNumber": confirm_res.get("accountNumber") or confirm_res.get("virtualAccountNumber"),
                    "bankCode": confirm_res.get("bankCode"),
                    "bankName": confirm_res.get("bankName"),
                    "expireDateTime": confirm_res.get("expireDateTime") or confirm_res.get("expireDate")
                }
                
        ref.update(update_payload)
        
        if is_vaccount:
            background_tasks.add_task(
                send_virtual_account_email,
                to_email=email,
                customer_name=order_data.get("customer", {}).get("name", "가맹점주"),
                order_id=final_order_id,
                order_name=order_data.get("orderName", "도매 상품"),
                amount=int(order_data.get("amount", 0)),
                va_info=update_payload["virtualAccount"]
            )
        
        redirect_response = RedirectResponse(url=f"/wholesale/success?orderId={final_order_id}", status_code=303)
        redirect_response.delete_cookie(key="wholesale_cart", path="/")
        return redirect_response

    # 그 외의 경우 -> 토스페이
    else:
        ref = rtdb.reference(f"payment_temp/{final_order_id}")
        temp_data = ref.get()
        if not temp_data:
            return await process_payment_fail(request, code="SESSION_NOT_FOUND", message="가결제 세션 정보를 찾을 수 없습니다.", orderId=final_order_id)
            
        pay_token = temp_data.get("payToken")
        customer_email = temp_data.get("email")
        
        url = "https://pay.toss.im/api/v2/execute"
        headers = {"Content-Type": "application/json"}
        payload = {
            "apiKey": TOSSPAY_API_KEY,
            "payToken": pay_token,
            "orderNo": final_order_id
        }
        response = await run_in_threadpool(requests.post, url, headers=headers, json=payload, timeout=10)
        res_json = response.json()
        if response.status_code != 200 or res_json.get("code") != 0:
            err_msg = res_json.get("msg", "토스페이 승인 실패")
            return await process_payment_fail(request, code="EXECUTE_ERROR", message=err_msg, orderId=final_order_id)
            
        ref.delete()
        
        safe_email = sanitize_email(customer_email)
        ws_order_ref = rtdb.reference(f"ws_orders/{safe_email}/{final_order_id}")
        ws_order_ref.update({
            "status": "결제 완료",
            "transactionId": pay_token,
            "paidAt": datetime.now().isoformat(),
            "method": "TOSSPAY",
            "pgProvider": "tosspay"
        })
        
        redirect_response = RedirectResponse(url=f"/wholesale/success?orderId={final_order_id}", status_code=303)
        redirect_response.delete_cookie(key="wholesale_cart", path="/")
        return redirect_response

async def process_booking_success(
    request: Request,
    background_tasks: BackgroundTasks,
    orderId: Optional[str] = None,
    orderNo: Optional[str] = None,
    pg_token: Optional[str] = None,
    code: Optional[str] = None,
    message: Optional[str] = None,
    transactionId: Optional[str] = None,
    method: Optional[str] = None,
    amount: Optional[int] = None
):
    final_order_id = orderId or orderNo
    if not final_order_id:
        return HTMLResponse(content="<h1>잘못된 결제 성공 요청입니다.</h1>", status_code=400)
        
    email = request.session.get("user_id")
    if not email:
        return RedirectResponse(url="/login")

    selected_method = ""
    pg_provider = ""
    resolved_transaction_id = ""
    resolved_amount = 0
    customer_email = ""
    
    # 1. 결제수단 판별 & 승인 처리
    if pg_token:
        # 카카오페이 승인
        ref = rtdb.reference(f"payment_temp/{final_order_id}")
        temp_data = ref.get()
        if not temp_data:
            return HTMLResponse(content="<h1>가결제 세션 정보를 찾을 수 없습니다.</h1>", status_code=404)
            
        tid = temp_data.get("tid")
        resolved_amount = temp_data.get("amount")
        customer_email = temp_data.get("email")
        
        url = "https://open-api.kakaopay.com/online/v1/payment/approve"
        headers = {
            "Authorization": f"SECRET_KEY {KAKAOPAY_SECRET_KEY}",
            "Content-Type": "application/json"
        }
        payload = {
            "cid": KAKAOPAY_CID,
            "tid": tid,
            "partner_order_id": final_order_id,
            "partner_user_id": final_order_id,
            "pg_token": pg_token
        }
        response = await run_in_threadpool(requests.post, url, headers=headers, json=payload, timeout=10)
        res_json = response.json()
        if response.status_code != 200:
            err_msg = res_json.get("msg", "카카오페이 승인 실패")
            return await process_payment_fail(request, code="APPROVE_ERROR", message=err_msg, orderId=final_order_id)
            
        ref.delete()
        selected_method = "KAKAOPAY"
        pg_provider = "kakaopay"
        resolved_transaction_id = tid

    elif code and transactionId:
        # 다날 승인
        if code != "SUCCESS":
            safe_msg = json.dumps(f"결제 인증 실패: {message}")
            return HTMLResponse(content=f"<script>alert({safe_msg}); window.location.href='/general/bookings';</script>", status_code=200)
            
        order_ref = rtdb.reference(f'booking_orders/{final_order_id}')
        order_data = order_ref.get()
        if not order_data:
            return HTMLResponse(content="<h1>가주문 정보를 찾을 수 없습니다.</h1>", status_code=404)
            
        customer_email = order_data.get("customer", {}).get("email")
        resolved_amount = order_data.get("amount", 0)
        
        if amount is not None and int(amount) != int(resolved_amount):
            return HTMLResponse(content="<h1>결제 승인 금액이 위조되었습니다.</h1>", status_code=400)
            
        confirm_res = await run_in_threadpool(
            confirm_danal_payment,
            method=method or "DANAL",
            transaction_id=transactionId,
            merchant_id=DANAL_MERCHANT_ID,
            amount=int(resolved_amount),
            order_id=final_order_id
        )
        if confirm_res.get("code") != "SUCCESS":
            err_msg = confirm_res.get("message", "결제 승인 실패")
            safe_msg = json.dumps(f"결제 승인 실패: {err_msg}")
            return HTMLResponse(content=f"<script>alert({safe_msg}); window.location.href='/general/bookings';</script>", status_code=200)
            
        selected_method = confirm_res.get("method") or method or "DANAL"
        pg_provider = "danal"
        resolved_transaction_id = transactionId

    else:
        # 토스페이 승인
        ref = rtdb.reference(f"payment_temp/{final_order_id}")
        temp_data = ref.get()
        if not temp_data:
            return HTMLResponse(content="<h1>가결제 세션 정보를 찾을 수 없습니다.</h1>", status_code=404)
            
        pay_token = temp_data.get("payToken")
        resolved_amount = temp_data.get("amount")
        customer_email = temp_data.get("email")
        
        url = "https://pay.toss.im/api/v2/execute"
        headers = {"Content-Type": "application/json"}
        payload = {
            "apiKey": TOSSPAY_API_KEY,
            "payToken": pay_token,
            "orderNo": final_order_id
        }
        response = await run_in_threadpool(requests.post, url, headers=headers, json=payload, timeout=10)
        res_json = response.json()
        if response.status_code != 200 or res_json.get("code") != 0:
            err_msg = res_json.get("msg", "토스페이 승인 실패")
            return await process_payment_fail(request, code="EXECUTE_ERROR", message=err_msg, orderId=final_order_id)
            
        ref.delete()
        selected_method = "TOSSPAY"
        pg_provider = "tosspay"
        resolved_transaction_id = pay_token

    # 2. 피팅 완료 결제 성공 후 DB 상태 동기화 처리
    booking_order_ref = rtdb.reference(f"booking_orders/{final_order_id}")
    order_data = booking_order_ref.get()
    if not order_data:
        return HTMLResponse(content="<h1>피팅 가결제 정보를 찾을 수 없습니다.</h1>", status_code=404)
        
    booking_id = order_data.get("bookingId")
    if not customer_email:
        customer_email = order_data.get("customer", {}).get("email")
        
    is_vaccount = selected_method.upper() == "VACCOUNT"
    status_text = "입금 대기" if is_vaccount else "결제 완료"
    
    payment_payload = {
        "orderId": final_order_id,
        "transactionId": resolved_transaction_id,
        "amount": int(resolved_amount),
        "paidItems": order_data.get("items", []),
        "status": status_text,
        "method": selected_method,
        "pgProvider": pg_provider
    }
    
    if not is_vaccount:
        payment_payload["paidAt"] = datetime.now().isoformat()
    else:
        va_info = confirm_res.get("virtualAccount")
        if isinstance(va_info, dict):
            payment_payload["virtualAccount"] = {
                "accountNumber": va_info.get("accountNumber"),
                "bankCode": va_info.get("bankCode"),
                "bankName": va_info.get("bankName"),
                "expireDateTime": va_info.get("expireDateTime")
            }
        else:
            payment_payload["virtualAccount"] = {
                "accountNumber": confirm_res.get("accountNumber") or confirm_res.get("virtualAccountNumber"),
                "bankCode": confirm_res.get("bankCode"),
                "bankName": confirm_res.get("bankName"),
                "expireDateTime": confirm_res.get("expireDateTime") or confirm_res.get("expireDate")
            }
            
    # 결제 상태 저장
    payment_ref = rtdb.reference(f"booking_payments/{booking_id}/{final_order_id}")
    payment_ref.set(payment_payload)

    # 가주문 상태 업데이트
    booking_order_update = {
        "status": status_text,
        "transactionId": resolved_transaction_id,
        "method": selected_method,
        "pgProvider": pg_provider
    }
    if not is_vaccount:
        booking_order_update["paidAt"] = datetime.now().isoformat()
    else:
        booking_order_update["virtualAccount"] = payment_payload["virtualAccount"]
    booking_order_ref.update(booking_order_update)

    # 예약 상태 업데이트
    safe_email = sanitize_email(customer_email)
    booking_ref = rtdb.reference(f"booking/{safe_email}/{booking_id}")
    booking_ref.update({"status": status_text})

    # 결제 완료 시 작성된 리뷰가 있다면 구매 완료 스티커 부착 상태로 업데이트 (카드 등 일반결제일때만)
    if not is_vaccount:
        try:
            bdata = booking_ref.get()
            if bdata:
                r_date = bdata.get("reservedDate")
                r_time = bdata.get("reservedTime")
                if r_date and r_time:
                    review_doc_id = f"{r_date}_{r_time}"
                    db_fs = firestore.client()
                    review_ref = db_fs.collection("fitting_reviews").document(review_doc_id)
                    if review_ref.get().exists:
                        review_ref.update({"is_purchased": True})
        except Exception as re_err:
            print(f"🔥 결제 완료 후 리뷰 상태 업데이트 실패: {re_err}")

    # 텔레그램 접수 안내
    customer_name = order_data.get("customer", {}).get("name", "알 수 없음")
    customer_phone = order_data.get("customer", {}).get("phone", "알 수 없음")
    
    db_fs = firestore.client()
    paid_items_ids = order_data.get("items", [])
    first_item_name = "안경 상품"
    if len(paid_items_ids) > 0:
        try:
            item_doc = db_fs.collection("item").document(paid_items_ids[0]).get()
            if item_doc.exists:
                first_item_name = item_doc.to_dict().get("name", "안경 상품")
        except Exception:
            pass
    goods_summary = f"{first_item_name} 포함 총 {len(paid_items_ids)}개"
    
    status_msg = "가상계좌 발급" if is_vaccount else "결제 완료"
    tg_message = (
        f"🏦 <b>[피팅 완료 상품 {status_msg} ({selected_method})]</b>\n\n"
        f"<b>예약번호:</b> {booking_id}\n"
        f"<b>주문번호:</b> {final_order_id}\n"
        f"<b>고객명:</b> {customer_name} ({customer_email})\n"
        f"<b>연락처:</b> {customer_phone}\n"
        f"<b>금액:</b> ₩{int(resolved_amount):,}\n"
        f"<b>상품:</b> {goods_summary}\n"
        f"<b>결제수단:</b> {selected_method}\n"
        f"<b>일시:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
    )
    if is_vaccount:
        va = payment_payload["virtualAccount"]
        tg_message += f"\n<b>[발급 계좌 정보]</b>\n<b>은행:</b> {va.get('bankName')}\n<b>계좌번호:</b> {va.get('accountNumber')}\n<b>기한:</b> {va.get('expireDateTime')}\n"

    if REQUEST_CHAT_ID:
        background_tasks.add_task(send_telegram_message, REQUEST_CHAT_ID, tg_message)

    if is_vaccount:
        order_name_val = first_item_name if len(paid_items_ids) <= 1 else f"{first_item_name} 외 {len(paid_items_ids)-1}건"
        background_tasks.add_task(
            send_virtual_account_email,
            to_email=customer_email,
            customer_name=customer_name,
            order_id=final_order_id,
            order_name=order_name_val,
            amount=int(resolved_amount),
            va_info=payment_payload["virtualAccount"]
        )

    return RedirectResponse(url=f"/general/payment_success?orderId={final_order_id}", status_code=303)

@router.get("/wholesale_success")
async def wholesale_success_get(
    request: Request,
    background_tasks: BackgroundTasks,
    orderId: Optional[str] = Query(None),
    orderNo: Optional[str] = Query(None),
    pg_token: Optional[str] = Query(None),
    code: Optional[str] = Query(None),
    message: Optional[str] = Query(None),
    transactionId: Optional[str] = Query(None),
    method: Optional[str] = Query(None),
    amount: Optional[int] = Query(None)
):
    return await process_wholesale_success(request, background_tasks, orderId, orderNo, pg_token, code, message, transactionId, method, amount)

@router.post("/wholesale_success")
async def wholesale_success_post(
    request: Request,
    background_tasks: BackgroundTasks,
    orderId: Optional[str] = Form(None),
    orderNo: Optional[str] = Form(None),
    pg_token: Optional[str] = Form(None),
    code: Optional[str] = Form(None),
    message: Optional[str] = Form(None),
    transactionId: Optional[str] = Form(None),
    method: Optional[str] = Form(None),
    amount: Optional[int] = Form(None)
):
    return await process_wholesale_success(request, background_tasks, orderId, orderNo, pg_token, code, message, transactionId, method, amount)

@router.get("/booking_success")
async def booking_success_get(
    request: Request,
    background_tasks: BackgroundTasks,
    orderId: Optional[str] = Query(None),
    orderNo: Optional[str] = Query(None),
    pg_token: Optional[str] = Query(None),
    code: Optional[str] = Query(None),
    message: Optional[str] = Query(None),
    transactionId: Optional[str] = Query(None),
    method: Optional[str] = Query(None),
    amount: Optional[int] = Query(None)
):
    return await process_booking_success(request, background_tasks, orderId, orderNo, pg_token, code, message, transactionId, method, amount)

@router.post("/booking_success")
async def booking_success_post(
    request: Request,
    background_tasks: BackgroundTasks,
    orderId: Optional[str] = Form(None),
    orderNo: Optional[str] = Form(None),
    pg_token: Optional[str] = Form(None),
    code: Optional[str] = Form(None),
    message: Optional[str] = Form(None),
    transactionId: Optional[str] = Form(None),
    method: Optional[str] = Form(None),
    amount: Optional[int] = Form(None)
):
    return await process_booking_success(request, background_tasks, orderId, orderNo, pg_token, code, message, transactionId, method, amount)

async def process_payment_fail(request: Request, code: Optional[str] = None, message: Optional[str] = None, orderId: Optional[str] = None):
    # None인 경우 기본값 지정
    code = code or "UNKNOWN"
    message = message or "결제 중 오류가 발생했거나 취소되었습니다."
    orderId = orderId or "UNKNOWN"
    
    print(f"🔥 결제 실패 콜백: {code} - {message} (주문ID: {orderId})")
    
    order_id_html = f"<div class='info-row'><span class='info-label'>주문 번호</span><span class='info-value'>{orderId}</span></div>" if orderId != "UNKNOWN" else ""
    
    html_content = f"""
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>결제 실패 - 아무래도 안경</title>
        <link rel="icon" href="/static/img/icon.webp" type="image/webp">
        <link rel="stylesheet" as="style" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" />
        <style>
            * {{
                box-sizing: border-box;
                margin: 0;
                padding: 0;
                font-family: 'Pretendard', sans-serif;
            }}

            body {{
                background: radial-gradient(circle at top, #162a45, #0a1424);
                color: #fff;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }}

            .fail-card {{
                background: rgba(255, 255, 255, 0.04);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 24px;
                padding: 50px 40px;
                max-width: 500px;
                width: 100%;
                text-align: center;
                box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
            }}

            .icon-container {{
                width: 80px;
                height: 80px;
                background: rgba(239, 68, 68, 0.1);
                border: 2px solid rgba(239, 68, 68, 0.3);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 30px auto;
                animation: pulse 2s infinite;
            }}

            .fail-icon {{
                font-size: 2.5rem;
                color: #ef4444;
            }}

            @keyframes pulse {{
                0% {{ transform: scale(1); }}
                50% {{ transform: scale(1.05); }}
                100% {{ transform: scale(1); }}
            }}

            .title {{
                font-size: 1.8rem;
                font-weight: 800;
                color: #f3f4f6;
                margin-bottom: 15px;
                letter-spacing: -0.5px;
            }}

            .subtitle {{
                font-size: 1rem;
                color: #9ca3af;
                margin-bottom: 35px;
                line-height: 1.6;
            }}

            /* 상세 에러 정보 박스 */
            .error-info-box {{
                background: rgba(0, 0, 0, 0.2);
                border-radius: 12px;
                padding: 20px;
                margin-bottom: 40px;
                text-align: left;
                border: 1px solid rgba(255, 255, 255, 0.03);
            }}

            .info-row {{
                display: flex;
                margin-bottom: 8px;
                font-size: 0.9rem;
            }}
            .info-row:last-child {{
                margin-bottom: 0;
            }}

            .info-label {{
                width: 90px;
                color: #6b7280;
                font-weight: 700;
            }}

            .info-value {{
                flex: 1;
                color: #e5e7eb;
                word-break: break-all;
            }}

            /* 액션 버튼 */
            .btn-group {{
                display: flex;
                flex-direction: column;
                gap: 12px;
            }}

            .btn {{
                display: inline-block;
                width: 100%;
                padding: 16px;
                font-size: 1rem;
                font-weight: 700;
                border-radius: 12px;
                text-decoration: none;
                cursor: pointer;
                transition: all 0.25s ease;
                text-align: center;
            }}

            .btn-primary {{
                background: #2563eb;
                color: #fff;
                border: none;
                box-shadow: 0 4px 15px rgba(37, 99, 235, 0.3);
            }}
            .btn-primary:hover {{
                background: #1d4ed8;
                transform: translateY(-2px);
            }}

            .btn-secondary {{
                background: transparent;
                color: #d1d5db;
                border: 1px solid rgba(255, 255, 255, 0.15);
            }}
            .btn-secondary:hover {{
                background: rgba(255, 255, 255, 0.05);
                color: #fff;
            }}

            @media (max-width: 480px) {{
                .fail-card {{
                    padding: 40px 20px;
                }}
                .title {{
                    font-size: 1.5rem;
                }}
            }}
        </style>
    </head>
    <body>
        <div class="fail-card">
            <div class="icon-container">
                <span class="fail-icon">✕</span>
            </div>
            <h1 class="title">결제를 완료하지 못했습니다</h1>
            <p class="subtitle">결제 진행 중 오류가 발생했거나<br>사용자에 의해 결제 요청이 취소되었습니다.</p>

            <!-- 상세 정보 박스 -->
            <div class="error-info-box">
                {order_id_html}
                <div class="info-row">
                    <span class="info-label">실패 사유</span>
                    <span class="info-value">{message} ({code})</span>
                </div>
            </div>

            <!-- 버튼 그룹 -->
            <div class="btn-group">
                <button class="btn btn-primary" onclick="window.history.back();">결제 페이지로 다시 넘어가기</button>
                <a href="/" class="btn btn-secondary">메인페이지로 넘어가기</a>
            </div>
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content, status_code=200)

@router.get("/danal_fail")
async def danal_fail_get(
    request: Request,
    code: Optional[str] = Query(None),
    message: Optional[str] = Query(None),
    orderId: Optional[str] = Query(None)
):
    return await process_payment_fail(request, code, message, orderId)

@router.post("/danal_fail")
async def danal_fail_post(
    request: Request,
    code: Optional[str] = Form(None),
    message: Optional[str] = Form(None),
    orderId: Optional[str] = Form(None)
):
    return await process_payment_fail(request, code, message, orderId)

@router.get("/fail")
async def payment_fail_get(
    request: Request,
    code: Optional[str] = Query(None),
    message: Optional[str] = Query(None),
    orderId: Optional[str] = Query(None),
    orderNo: Optional[str] = Query(None)
):
    # PG사마다 orderId 혹은 orderNo 등으로 파라미터가 다르게 올 수 있으므로 모두 지원
    final_order_id = orderId or orderNo
    return await process_payment_fail(request, code, message, final_order_id)

@router.post("/fail")
async def payment_fail_post(
    request: Request,
    code: Optional[str] = Form(None),
    message: Optional[str] = Form(None),
    orderId: Optional[str] = Form(None),
    orderNo: Optional[str] = Form(None)
):
    final_order_id = orderId or orderNo
    return await process_payment_fail(request, code, message, final_order_id)

@router.post("/danal_noti")
@router.get("/danal_noti")
async def danal_noti(request: Request, background_tasks: BackgroundTasks):
    """
    다날 가상계좌 입금 통보 (Noti) 수신 API (웹훅)
    """
    try:
        body_json = {}
        if request.method == "POST":
            try:
                body_json = await request.json()
            except Exception:
                form_data = await request.form()
                body_json = dict(form_data)
        else:
            body_json = dict(request.query_params)
            
        print(f"📥 다날 가상계좌 입금 통보 수신 데이터: {body_json}")
        
        code = body_json.get("code")
        if code != "SUCCESS":
            print(f"⚠️ 다날 가상계좌 노티 실패 코드 수신: {code} - {body_json.get('message')}")
            return HTMLResponse(content="OK", status_code=200)
            
        order_id = body_json.get("orderId")
        amount = body_json.get("amount")
        transaction_id = body_json.get("transactionId")
        deposit_time = body_json.get("depositDateTime")
        bank_name = body_json.get("bankName")
        depositor_name = body_json.get("depositorName")
        
        if not order_id:
            print("⚠️ 다날 가상계좌 노티에 orderId가 누락되었습니다.")
            return HTMLResponse(content="FAIL", status_code=400)
            
        order_type = "booking" if order_id.startswith("BKORD") else "wholesale"
        
        paid_at_time = datetime.now().isoformat()
        if deposit_time and len(deposit_time) == 14:
            try:
                dt = datetime.strptime(deposit_time, "%Y%m%d%H%M%S")
                paid_at_time = dt.isoformat()
            except Exception:
                pass
                
        if order_type == "wholesale":
            customer_email = body_json.get("userEmail") or body_json.get("userId")
            safe_email = None
            if customer_email and "@" in customer_email:
                safe_email = sanitize_email(customer_email)
                
            if not safe_email:
                orders_ref = rtdb.reference("ws_orders")
                all_orders = orders_ref.get() or {}
                for user_key, user_orders in all_orders.items():
                    if order_id in user_orders:
                        safe_email = user_key
                        break
                        
            if not safe_email:
                print(f"⚠️ 다날 Noti 수신: 주문번호 {order_id} 에 해당하는 도매 주문 노드를 찾을 수 없습니다.")
                return HTMLResponse(content="FAIL", status_code=404)
                
            order_ref = rtdb.reference(f"ws_orders/{safe_email}/{order_id}")
            order_data = order_ref.get()
            if not order_data:
                print(f"⚠️ 다날 Noti 수신: ws_orders/{safe_email}/{order_id} 노드가 비어있습니다.")
                return HTMLResponse(content="FAIL", status_code=404)
                
            # 🏁 [중복 차단 필터] 이미 결제 완료 상태인 주문은 처리 스킵
            if order_data.get("status") == "결제 완료":
                print(f"ℹ️ 이미 결제 완료된 도매 주문입니다. (주문ID: {order_id}) Noti 처리 생략 및 성공 응답.")
                return HTMLResponse(content="OK", status_code=200)
                
            db_amount = int(order_data.get("amount", 0))
            if amount is not None and int(amount) != db_amount:
                print(f"⚠️ 금액 위조 의심: DB금액 {db_amount} != 노티금액 {amount}")
                return HTMLResponse(content="FAIL", status_code=400)
                
            order_ref.update({
                "status": "결제 완료",
                "paidAt": paid_at_time,
                "danalDepositDetail": {
                    "depositorName": depositor_name,
                    "bankName": bank_name,
                    "depositDateTime": deposit_time,
                    "transactionId": transaction_id
                }
            })
            
            customer_name = order_data.get("customer", {}).get("name", "가맹점주")
            tg_message = (
                f"🏦 <b>[도매 가상계좌 입금 완료]</b>\n\n"
                f"<b>주문번호:</b> {order_id}\n"
                f"<b>가맹점명:</b> {customer_name} ({customer_email or '이메일 미획득'})\n"
                f"<b>입금금액:</b> ₩{db_amount:,}\n"
                f"<b>입금자명:</b> {depositor_name or '미지정'}\n"
                f"<b>입금은행:</b> {bank_name or '미지정'}\n"
                f"<b>입금일시:</b> {paid_at_time.replace('T', ' ')}\n"
            )
            if REQUEST_CHAT_ID:
                background_tasks.add_task(send_telegram_message, REQUEST_CHAT_ID, tg_message)
                        
        else:
            order_ref = rtdb.reference(f"booking_orders/{order_id}")
            order_data = order_ref.get()
            if not order_data:
                print(f"⚠️ 다날 Noti 수신: booking_orders/{order_id} 가결제 정보를 찾을 수 없습니다.")
                return HTMLResponse(content="FAIL", status_code=404)
                
            # 🏁 [중복 차단 필터] 이미 결제 완료 상태인 주문은 처리 스킵
            if order_data.get("status") == "결제 완료":
                print(f"ℹ️ 이미 결제 완료된 피팅 주문입니다. (주문ID: {order_id}) Noti 처리 생략 및 성공 응답.")
                return HTMLResponse(content="OK", status_code=200)
                
            booking_id = order_data.get("bookingId")
            customer_email = order_data.get("customer", {}).get("email")
            db_amount = int(order_data.get("amount", 0))
            
            if amount is not None and int(amount) != db_amount:
                print(f"⚠️ 금액 위조 의심 (피팅결제): DB금액 {db_amount} != 노티금액 {amount}")
                return HTMLResponse(content="FAIL", status_code=400)
                
            order_ref.update({
                "status": "결제 완료",
                "paidAt": paid_at_time,
                "danalDepositDetail": {
                    "depositorName": depositor_name,
                    "bankName": bank_name,
                    "depositDateTime": deposit_time,
                    "transactionId": transaction_id
                }
            })
            
            payments_ref = rtdb.reference(f"booking_payments/{booking_id}/{order_id}")
            payments_ref.update({
                "status": "결제 완료",
                "paidAt": paid_at_time,
                "danalDepositDetail": {
                    "depositorName": depositor_name,
                    "bankName": bank_name,
                    "depositDateTime": deposit_time,
                    "transactionId": transaction_id
                }
            })
            
            if customer_email:
                safe_email = sanitize_email(customer_email)
                booking_ref = rtdb.reference(f"booking/{safe_email}/{booking_id}")
                booking_ref.update({"status": "결제 완료"})
                
                try:
                    bdata = booking_ref.get()
                    if bdata:
                        r_date = bdata.get("reservedDate")
                        r_time = bdata.get("reservedTime")
                        if r_date and r_time:
                            review_doc_id = f"{r_date}_{r_time}"
                            db_fs = firestore.client()
                            review_ref = db_fs.collection("fitting_reviews").document(review_doc_id)
                            if review_ref.get().exists:
                                review_ref.update({"is_purchased": True})
                except Exception as re_err:
                    print(f"🔥 피팅 Noti 입금 완료 후 리뷰 상태 업데이트 실패: {re_err}")
            
            customer_name = order_data.get("customer", {}).get("name", "알 수 없음")
            tg_message = (
                f"🏦 <b>[일반 피팅 가상계좌 입금 완료]</b>\n\n"
                f"<b>예약 ID:</b> {booking_id}\n"
                f"<b>주문번호:</b> {order_id}\n"
                f"<b>결제고객:</b> {customer_name} ({customer_email or '이메일 없음'})\n"
                f"<b>입금금액:</b> ₩{db_amount:,}\n"
                f"<b>입금자명:</b> {depositor_name or '미지정'}\n"
                f"<b>입금은행:</b> {bank_name or '미지정'}\n"
                f"<b>입금일시:</b> {paid_at_time.replace('T', ' ')}\n"
            )
            if REQUEST_CHAT_ID:
                background_tasks.add_task(send_telegram_message, REQUEST_CHAT_ID, tg_message)
                        
        return HTMLResponse(content="OK", status_code=200)
    except Exception as e:
        print(f"🔥 다날 가상계좌 노티 처리 중 에러: {e}")
        return HTMLResponse(content="FAIL", status_code=500)


# -------------------------------------------------------------
# 🏁 카카오페이 API 엔드포인트
# -------------------------------------------------------------
@router.post("/kakaopay_ready")
async def kakaopay_ready(request: Request):
    """
    카카오페이 결제 준비 (Token 발급 및 결제창 URL 획득)
    """
    email = request.session.get("user_id")
    if not email:
        return JSONResponse(status_code=403, content={"status": "error", "message": "로그인이 필요합니다."})

    try:
        body = await request.json()
        order_id = body.get("orderId")
        amount = body.get("amount")
        order_name = body.get("orderName")
        
        if not order_id or not amount or not order_name:
            return JSONResponse(status_code=400, content={"status": "error", "message": "필수 결제 요청 정보가 누락되었습니다."})

        # 주문 성격 구분 (BKORD 시작 = 피팅 주문)
        order_type = "booking" if order_id.startswith("BKORD") else "wholesale"

        url = "https://open-api.kakaopay.com/online/v1/payment/ready"
        headers = {
            "Authorization": f"SECRET_KEY {KAKAOPAY_SECRET_KEY}",
            "Content-Type": "application/json"
        }

        base_url = get_base_url(request)
        if order_type == "booking":
            approval_url = f"{base_url}/api/payment/booking_success?orderNo={order_id}"
        else:
            approval_url = f"{base_url}/api/payment/wholesale_success?orderNo={order_id}"

        cancel_url = f"{base_url}/api/payment/fail?orderNo={order_id}&status=cancel"
        fail_url = f"{base_url}/api/payment/fail?orderNo={order_id}&status=fail"

        payload = {
            "cid": KAKAOPAY_CID,
            "partner_order_id": order_id,
            "partner_user_id": order_id,
            "item_name": order_name,
            "quantity": 1,
            "total_amount": int(amount),
            "tax_free_amount": 0,
            "approval_url": approval_url,
            "cancel_url": cancel_url,
            "fail_url": fail_url
        }

        response = await run_in_threadpool(requests.post, url, headers=headers, json=payload, timeout=10)
        res_json = response.json()

        if response.status_code == 200:
            tid = res_json.get("tid")
            redirect_url = res_json.get("next_redirect_pc_url") # PC 기준
            
            # 가주문 임시 세션 및 tid 보존
            ref = rtdb.reference(f"payment_temp/{order_id}")
            ref.set({
                "tid": tid,
                "amount": int(amount),
                "email": email,
                "type": order_type,
                "createdAt": datetime.now().isoformat()
            })

            return {"status": "success", "redirectUrl": redirect_url}
        else:
            print(f"🔥 카카오페이 준비 API 실패: {response.text}")
            return JSONResponse(status_code=400, content={"status": "error", "message": res_json.get("msg", "카카오페이 준비 실패")})

    except Exception as e:
        print(f"🔥 카카오페이 준비 예외 발생: {e}")
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})





@router.get("/kakaopay_fail")
async def kakaopay_fail(request: Request, orderNo: str, status: str):
    """
    카카오페이 결제 취소 / 실패 콜백
    """
    msg = "결제가 사용자에 의해 취소되었습니다." if status == "cancel" else "결제 승인 전 단계에서 처리에 실패했습니다."
    return await process_payment_fail(request, code=status, message=msg, orderId=orderNo)


# -------------------------------------------------------------
# 🏁 토스페이 API 엔드포인트 (Toss Pay V2 간편결제)
# -------------------------------------------------------------
@router.post("/tosspay_ready")
async def tosspay_ready(request: Request):
    """
    토스페이 결제 준비
    """
    email = request.session.get("user_id")
    if not email:
        return JSONResponse(status_code=403, content={"status": "error", "message": "로그인이 필요합니다."})

    try:
        body = await request.json()
        order_id = body.get("orderId")
        amount = body.get("amount")
        order_name = body.get("orderName")

        if not order_id or not amount or not order_name:
            return JSONResponse(status_code=400, content={"status": "error", "message": "필수 결제 요청 정보가 누락되었습니다."})

        order_type = "booking" if order_id.startswith("BKORD") else "wholesale"

        url = "https://pay.toss.im/api/v2/payments"
        headers = {"Content-Type": "application/json"}

        base_url = get_base_url(request)
        if order_type == "booking":
            ret_url = f"{base_url}/api/payment/booking_success?orderNo={order_id}"
        else:
            ret_url = f"{base_url}/api/payment/wholesale_success?orderNo={order_id}"

        ret_cancel_url = f"{base_url}/api/payment/fail?orderNo={order_id}&status=cancel"

        payload = {
            "orderNo": order_id,
            "amount": int(amount),
            "amountTaxFree": 0,
            "productDesc": order_name,
            "apiKey": TOSSPAY_API_KEY,
            "retUrl": ret_url,
            "retCancelUrl": ret_cancel_url,
            "autoExecute": False
        }

        response = await run_in_threadpool(requests.post, url, headers=headers, json=payload, timeout=10)
        res_json = response.json()

        if response.status_code == 200 and res_json.get("code") == 0:
            pay_token = res_json.get("payToken")
            redirect_url = res_json.get("checkoutPage")

            # 가주문 임시 세션 및 payToken 보존
            ref = rtdb.reference(f"payment_temp/{order_id}")
            ref.set({
                "payToken": pay_token,
                "amount": int(amount),
                "email": email,
                "type": order_type,
                "createdAt": datetime.now().isoformat()
            })

            return {"status": "success", "redirectUrl": redirect_url}
        else:
            print(f"🔥 토스페이 준비 API 실패: {response.text}")
            return JSONResponse(status_code=400, content={"status": "error", "message": res_json.get("msg", "토스페이 준비 실패")})

    except Exception as e:
        print(f"🔥 토스페이 준비 예외 발생: {e}")
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})





@router.get("/tosspay_fail")
async def tosspay_fail(request: Request, orderNo: str, status: str):
    """
    토스페이 결제 취소 / 실패 콜백
    """
    msg = "결제가 사용자에 의해 취소되었습니다." if status == "cancel" else "결제 승인 전 단계에서 처리에 실패했습니다."
    return await process_payment_fail(request, code=status, message=msg, orderId=orderNo)


# -------------------------------------------------------------
# 🏁 결제 성공 영수증 조회를 위한 신규 API 2종
# -------------------------------------------------------------
@router.get("/order/{order_id}")
async def get_wholesale_order_detail(request: Request, order_id: str):
    email = request.session.get("user_id")
    if not email:
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    try:
        safe_email = sanitize_email(email)
        ref = rtdb.reference(f'ws_orders/{safe_email}/{order_id}')
        order_data = ref.get()
        
        if not order_data:
            raise HTTPException(status_code=404, detail="Order not found")
            
        return {
            "status": "success",
            "orderId": order_id,
            "customerName": order_data.get("customer", {}).get("name", "가맹점주"),
            "amount": order_data.get("amount", 0),
            "items": order_data.get("cart", []),
            "method": order_data.get("method", ""),
            "virtualAccount": order_data.get("virtualAccount")
        }
    except Exception as e:
        print(f"🔥 도매 주문 단건 조회 에러: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/booking_order/{order_id}")
async def get_booking_order_detail(request: Request, order_id: str):
    email = request.session.get("user_id")
    if not email:
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    try:
        # 1. 가주문 정보 조회
        order_ref = rtdb.reference(f'booking_orders/{order_id}')
        order_data = order_ref.get()
        if not order_data:
            raise HTTPException(status_code=404, detail="Booking order not found")
            
        # 2. 아이템 ID 리스트를 기반으로 실제 상품 정보(이름, 단가) 조회
        db_fs = firestore.client()
        
        items_list = []
        items_arr = order_data.get("items", [])
        for item_id in items_arr:
            try:
                item_doc = db_fs.collection("item").document(item_id).get()
                if item_doc.exists:
                    idata = item_doc.to_dict()
                    items_list.append({
                        "id": item_id,
                        "name": idata.get("name", "안경 상품"),
                        "price": idata.get("price", 0),
                        "quantity": 1
                    })
                else:
                    items_list.append({
                        "id": item_id,
                        "name": f"안경 상품 ({item_id})",
                        "price": 0,
                        "quantity": 1
                    })
            except Exception as ie:
                print(f"🔥 아이템 정보 연동 중 에러: {ie}")
                
        return {
            "status": "success",
            "orderId": order_id,
            "customerName": order_data.get("customer", {}).get("name", "고객"),
            "amount": order_data.get("amount", 0),
            "items": items_list,
            "method": order_data.get("method", ""),
            "virtualAccount": order_data.get("virtualAccount")
        }
    except Exception as e:
        print(f"🔥 피팅 주문 단건 조회 에러: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# -------------------------------------------------------------
# 🏁 피팅 서비스 리뷰(후기) 연동 API 탑재
# -------------------------------------------------------------
def mask_name(name: str) -> str:
    if not name:
        return ""
    name = name.strip()
    length = len(name)
    if length <= 1:
        return name
    elif length == 2:
        return name[0] + "*"
    elif length == 3:
        return name[0] + "*" + name[2]
    else:
        return name[0] + "*" * (length - 2) + name[-1]

@router.post("/review")
async def create_review(request: Request):
    """
    피팅 서비스 완료(이용 완료/결제 완료) 예약 건에 대해 리뷰를 작성하고 Firestore에 저장합니다.
    """
    email = request.session.get("user_id")
    if not email:
        raise HTTPException(status_code=403, detail="로그인이 필요합니다.")
        
    try:
        body = await request.json()
        booking_id = body.get("bookingId")
        content = body.get("content")
        rating = body.get("rating")
        
        if not booking_id or not content or rating is None:
            raise HTTPException(status_code=400, detail="필수 입력 항목이 누락되었습니다.")
            
        try:
            rating = int(rating)
            if rating < 1 or rating > 5:
                raise ValueError()
        except ValueError:
            raise HTTPException(status_code=400, detail="별점은 1에서 5 사이의 숫자여야 합니다.")
            
        if len(content.strip()) < 5:
            raise HTTPException(status_code=400, detail="후기는 최소 5자 이상 작성해 주세요.")
            
        safe_email = sanitize_email(email)
        
        # 1. 예약 정보 조회 및 검증
        booking_ref = rtdb.reference(f'booking/{safe_email}/{booking_id}')
        booking_data = booking_ref.get()
        if not booking_data:
            raise HTTPException(status_code=404, detail="예약 내역을 찾을 수 없습니다.")
            
        status = booking_data.get("status")
        if status not in ["이용 완료", "결제 완료"]:
            raise HTTPException(status_code=400, detail="이용 완료 또는 결제 완료된 예약만 후기를 작성할 수 있습니다.")
            
        reserved_date = booking_data.get("reservedDate")
        reserved_time = booking_data.get("reservedTime")
        customer_name = booking_data.get("customerName", "고객")
        
        if not reserved_date or not reserved_time:
            raise HTTPException(status_code=400, detail="예약 날짜 또는 시간 정보가 누락되었습니다.")
            
        # 문서 ID 생성
        review_doc_id = f"{reserved_date}_{reserved_time}"
        
        # 2. Firestore 중복 체크 및 저장
        db_fs = firestore.client()
        
        review_ref = db_fs.collection("fitting_reviews").document(review_doc_id)
        if review_ref.get().exists:
            raise HTTPException(status_code=400, detail="이미 해당 예약에 대한 후기가 등록되어 있습니다.")
            
        # 3. 구매 완료 여부 체크 (rtdb booking_payments 노드 존재 검사)
        payments_ref = rtdb.reference(f"booking_payments/{booking_id}")
        payments_data = payments_ref.get()
        is_purchased = payments_data is not None
        
        # Firestore에 후기 데이터 저장
        review_data = {
            "bookingId": booking_id,
            "customerName": customer_name,
            "customerEmail": email,
            "reservedDate": reserved_date,
            "reservedTime": reserved_time,
            "content": content.strip(),
            "rating": rating,
            "is_purchased": is_purchased,
            "created_at": datetime.now().isoformat()
        }
        review_ref.set(review_data)
        
        return {"status": "success", "message": "후기가 성공적으로 등록되었습니다."}
        
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"🔥 리뷰 등록 중 에러: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/booking/{booking_id}/review_status")
async def get_booking_review_status(request: Request, booking_id: str):
    """
    특정 예약건에 이미 작성한 후기가 있는지 조회합니다.
    """
    email = request.session.get("user_id")
    if not email:
        raise HTTPException(status_code=403, detail="로그인이 필요합니다.")
        
    try:
        safe_email = sanitize_email(email)
        booking_ref = rtdb.reference(f'booking/{safe_email}/{booking_id}')
        booking_data = booking_ref.get()
        if not booking_data:
            return {"status": "success", "has_review": False}
            
        reserved_date = booking_data.get("reservedDate")
        reserved_time = booking_data.get("reservedTime")
        if not reserved_date or not reserved_time:
            return {"status": "success", "has_review": False}
            
        review_doc_id = f"{reserved_date}_{reserved_time}"
        
        db_fs = firestore.client()
        review_doc = db_fs.collection("fitting_reviews").document(review_doc_id).get()
        
        return {"status": "success", "has_review": review_doc.exists}
    except Exception as e:
        print(f"🔥 리뷰 작성 여부 조회 중 에러: {e}")
        return {"status": "error", "message": str(e), "has_review": False}

@router.get("/fitting_reviews")
async def get_fitting_reviews(limit: int = 30):
    """
    모든 고객들이 피팅 후기를 볼 수 있도록 전체 리뷰를 조회합니다. (최신순, limit 개수 제한)
    개인정보 보호를 위해 작성자명은 마스킹 처리하여 반환합니다.
    """
    try:
        db_fs = firestore.client()
        
        if db_fs is None:
            return {"status": "error", "message": "Firebase 연결 불가", "reviews": []}
            
        # created_at 기준 내림차순(최신순) 정렬 및 limit 개수 제한 적용
        reviews_query = db_fs.collection("fitting_reviews")\
            .order_by("created_at", direction=firestore.Query.DESCENDING)\
            .limit(limit)\
            .stream()
        
        reviews_list = []
        for doc in reviews_query:
            data = doc.to_dict()
            raw_name = data.get("customerName", "고객")
            masked_name = mask_name(raw_name)
            
            reviews_list.append({
                "customerName": masked_name,
                "reservedDate": data.get("reservedDate"),
                "reservedTime": data.get("reservedTime"),
                "content": data.get("content"),
                "rating": data.get("rating"),
                "is_purchased": data.get("is_purchased", False),
                "created_at": data.get("created_at")
            })
            
        return {"status": "success", "reviews": reviews_list}
    except Exception as e:
        print(f"🔥 전체 리뷰 조회 중 에러: {e}")
        return {"status": "error", "message": str(e), "reviews": []}


@router.post("/booking_order/cancel_request")
async def request_booking_order_cancel(request: Request, background_tasks: BackgroundTasks):
    """
    일반 고객이 예약 완료 및 결제 완료된 상품 주문의 취소를 요청했을 때 호출됨.
    booking_id를 받아 booking_payments에서 order_id를 조회하고,
    booking_orders, booking_payments, booking 노드의 상태를 '취소 요청 완료'로 업데이트하고
    관리자 텔레그램으로 취소 요청 알림을 발송합니다.
    """
    email = request.session.get("user_id")
    if not email:
        return JSONResponse(status_code=403, content={"status": "error", "message": "로그인이 필요합니다."})

    try:
        body = await request.json()
        booking_id = body.get("bookingId")
        
        if not booking_id:
            return JSONResponse(status_code=400, content={"status": "error", "message": "예약번호가 필요합니다."})

        # 1. booking_payments/{booking_id}에서 order_id 조회
        payments_ref = rtdb.reference(f"booking_payments/{booking_id}")
        payments_data = payments_ref.get()
        if not payments_data:
            return JSONResponse(status_code=404, content={"status": "error", "message": "결제 정보를 찾을 수 없습니다."})

        order_ids = list(payments_data.keys())
        if not order_ids:
            return JSONResponse(status_code=404, content={"status": "error", "message": "주문번호를 조회할 수 없습니다."})
        
        order_id = None
        for oid in order_ids:
            p_info = payments_data.get(oid)
            if isinstance(p_info, dict) and p_info.get("status") == "결제 완료":
                order_id = oid
                break
        if not order_id:
            order_id = order_ids[0]

        # 2. booking_orders에서 주문 정보 확인
        order_ref = rtdb.reference(f"booking_orders/{order_id}")
        order_data = order_ref.get()
        if not order_data:
            return JSONResponse(status_code=404, content={"status": "error", "message": "주문 정보를 찾을 수 없습니다."})

        # 권한 및 상태 검증
        customer_email = order_data.get("customer", {}).get("email")
        if customer_email != email:
            return JSONResponse(status_code=403, content={"status": "error", "message": "요청 권한이 없습니다."})

        current_status = order_data.get("status")
        if current_status != "결제 완료":
            return JSONResponse(status_code=400, content={"status": "error", "message": "결제 완료 상태의 주문만 취소 요청이 가능합니다."})

        # 3. 3개 노드 상태 동기화 업데이트 ("취소 요청 완료")
        status_text = "취소 요청 완료"
        
        # booking_orders/{order_id}
        order_ref.update({"status": status_text})
        
        # booking_payments/{booking_id}/{order_id}
        payments_ref.child(order_id).update({"status": status_text})
            
        # booking/{safe_email}/{booking_id}
        safe_email = sanitize_email(email)
        booking_ref = rtdb.reference(f"booking/{safe_email}/{booking_id}")
        if booking_ref.get():
            booking_ref.update({"status": status_text})

        # 4. 텔레그램 메시지 구성 및 전송
        customer = order_data.get("customer", {})
        customer_name = customer.get("name", "알 수 없음")
        customer_phone = customer.get("phone", "알 수 없음")
        amount = order_data.get("amount", 0)
        
        message = (
            f"<b>🚨 B2C 일반 주문 취소 요청 알림</b>\n\n"
            f"<b>주문번호:</b> {order_id}\n"
            f"<b>예약 ID:</b> {booking_id}\n"
            f"<b>금액:</b> ₩{amount:,}\n\n"
            f"<b>[취소 요청 고객 정보]</b>\n"
            f"<b>성함:</b> {customer_name}\n"
            f"<b>연락처:</b> {customer_phone}\n"
            f"<b>이메일:</b> {customer_email}\n"
        )
        
        background_tasks.add_task(send_telegram_message, CANCEL_CHAT_ID, message)

        return {"status": "success", "message": "취소 요청이 완료되었습니다. 관리자 확인 후 처리가 진행됩니다."}
    except Exception as e:
        print(f"🔥 일반 주문 취소 요청 처리 에러: {e}")
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})


@router.post("/booking_order/exchange_request")
async def request_booking_order_exchange(request: Request, background_tasks: BackgroundTasks):
    """
    일반 고객이 예약 완료 및 결제 완료된 상품 주문의 교환을 요청했을 때 호출됨.
    booking_id를 받아 booking_payments에서 order_id를 조회하고,
    booking_orders, booking_payments, booking 노드의 상태를 '교환 요청 완료'로 업데이트하고
    관리자 텔레그램으로 교환 요청 알림을 발송합니다.
    """
    email = request.session.get("user_id")
    if not email:
        return JSONResponse(status_code=403, content={"status": "error", "message": "로그인이 필요합니다."})

    try:
        body = await request.json()
        booking_id = body.get("bookingId")
        
        if not booking_id:
            return JSONResponse(status_code=400, content={"status": "error", "message": "예약번호가 필요합니다."})

        # 1. booking_payments/{booking_id}에서 order_id 조회
        payments_ref = rtdb.reference(f"booking_payments/{booking_id}")
        payments_data = payments_ref.get()
        if not payments_data:
            return JSONResponse(status_code=404, content={"status": "error", "message": "결제 정보를 찾을 수 없습니다."})

        order_ids = list(payments_data.keys())
        if not order_ids:
            return JSONResponse(status_code=404, content={"status": "error", "message": "주문번호를 조회할 수 없습니다."})
        
        order_id = None
        for oid in order_ids:
            p_info = payments_data.get(oid)
            if isinstance(p_info, dict) and p_info.get("status") == "결제 완료":
                order_id = oid
                break
        if not order_id:
            order_id = order_ids[0]

        # 2. booking_orders에서 주문 정보 확인
        order_ref = rtdb.reference(f"booking_orders/{order_id}")
        order_data = order_ref.get()
        if not order_data:
            return JSONResponse(status_code=404, content={"status": "error", "message": "주문 정보를 찾을 수 없습니다."})

        # 권한 및 상태 검증
        customer_email = order_data.get("customer", {}).get("email")
        if customer_email != email:
            return JSONResponse(status_code=403, content={"status": "error", "message": "요청 권한이 없습니다."})

        current_status = order_data.get("status")
        if current_status != "결제 완료":
            return JSONResponse(status_code=400, content={"status": "error", "message": "결제 완료 상태의 주문만 교환 요청이 가능합니다."})

        # 3. 3개 노드 상태 동기화 업데이트 ("교환 요청 완료")
        status_text = "교환 요청 완료"
        
        # booking_orders/{order_id}
        order_ref.update({"status": status_text})
        
        # booking_payments/{booking_id}/{order_id}
        payments_ref.child(order_id).update({"status": status_text})
            
        # booking/{safe_email}/{booking_id}
        safe_email = sanitize_email(email)
        booking_ref = rtdb.reference(f"booking/{safe_email}/{booking_id}")
        if booking_ref.get():
            booking_ref.update({"status": status_text})

        # 4. 텔레그램 메시지 구성 및 전송
        customer = order_data.get("customer", {})
        customer_name = customer.get("name", "알 수 없음")
        customer_phone = customer.get("phone", "알 수 없음")
        amount = order_data.get("amount", 0)
        
        message = (
            f"<b>🔄 B2C 일반 주문 교환 요청 알림</b>\n\n"
            f"<b>주문번호:</b> {order_id}\n"
            f"<b>예약 ID:</b> {booking_id}\n"
            f"<b>금액:</b> ₩{amount:,}\n\n"
            f"<b>[교환 요청 고객 정보]</b>\n"
            f"<b>성함:</b> {customer_name}\n"
            f"<b>연락처:</b> {customer_phone}\n"
            f"<b>이메일:</b> {customer_email}\n"
        )
        
        background_tasks.add_task(send_telegram_message, CANCEL_CHAT_ID, message)

        return {"status": "success", "message": "교환 요청이 완료되었습니다. 관리자 확인 후 처리가 진행됩니다."}
    except Exception as e:
        print(f"🔥 일반 주문 교환 요청 처리 에러: {e}")
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})
