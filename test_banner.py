import sys
import os

# amuredoMain 폴더를 경로에 추가
sys.path.append(r'C:\Users\dndnDG\amuredo\amuredoMain')

try:
    from main import db
    doc = db.collection('banner').document('img').get()
    
    if doc.exists:
        data = doc.to_dict()
        print("✅ 문서 존재함")
        print("Data:", data)
        print("paths Type:", type(data.get("paths")))
    else:
        print("❌ 문서가 존재하지 않음 (Collection 'banner', Document 'img' 확인 요망)")
        
        # banner 콜렉션 안에 무슨 문서들이 있는지 스캔
        print("--- 'banner' 콜렉션 내부 문서 스캔 ---")
        docs = db.collection('banner').stream()
        for d in docs:
            print(f"발견된 문서 ID: {d.id}, 내용: {d.to_dict()}")
            
except Exception as e:
    print("🔥 에러 발생:", e)
