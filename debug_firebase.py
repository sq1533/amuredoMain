import firebase_admin
from firebase_admin import credentials, firestore
import os

# Firebase Admin SDK 설정
cred_path = os.path.join(os.path.dirname(__file__), "database", "firebase.json")
cred = credentials.Certificate(cred_path)
firebase_admin.initialize_app(cred)
db = firestore.client()

print("=== Firebase 아이템 목록 10개 조회 샘플 ===")
docs = db.collection('item').limit(10).stream()

test_code = None
for doc in docs:
    d = doc.to_dict()
    code_val = d.get('code')
    print(f"ID: {doc.id} | Name: {d.get('name')} | Code: {code_val!r} (Type: {type(code_val)})")
    if code_val and not test_code:
        test_code = code_val

if test_code:
    print(f"\n=== 연관 상품 쿼리 테스트 ===")
    print(f"조회 대상 code: {test_code!r} (문자열 캐스팅: {str(test_code)!r})")
    
    # 1. 원본 그대로 조회
    try:
        res1 = list(db.collection('item').where('code', '==', test_code).stream())
        print(f"[테스트 1] 원본 타입(where ==): {len(res1)}개 발견")
    except Exception as e:
        print(f"에러 1: {e}")
        
    # 2. 강제 문자열 변환 후 조회
    try:
        res2 = list(db.collection('item').where('code', '==', str(test_code)).stream())
        print(f"[테스트 2] 무조건 str 캐스팅(where ==): {len(res2)}개 발견")
    except Exception as e:
        print(f"에러 2: {e}")
        
    # 3. in 쿼리 조회 (현재 실적용 로직 방식)
    try:
        res3 = list(db.collection('item').where('code', 'in', [str(test_code), int(test_code) if str(test_code).isdigit() else str(test_code)]).stream())
        print(f"[테스트 3] in 쿼리 혼동 방지 (실적용 로직): {len(res3)}개 발견")
    except Exception as e:
        print(f"에러 3: {e}")
else:
    print("code 값이 지정된 상품을 하나도 찾지 못했습니다!")
