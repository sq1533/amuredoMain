# 1. 공식 경량화 Python 이미지를 베이스로 사용합니다.
FROM python:3.11-slim

# 2. Python의 출력을 버퍼링 없이 즉시 전송하도록 설정합니다. (로그 확인 용이)
ENV PYTHONUNBUFFERED=1
# 타임존을 서울로 설정합니다.
ENV TZ=Asia/Seoul

# 3. 작업 디렉토리를 /app으로 설정합니다.
WORKDIR /app

# 4. 의존성 설치를 위해 requirements.txt만 먼저 복사합니다. (빌드 캐시 최적화)
COPY requirements.txt .

# 5. 필요한 라이브러리들을 설치합니다.
RUN pip install --no-cache-dir --upgrade -r requirements.txt

# 6. 소스 코드 전체를 컨테이너 내부로 복사합니다.
COPY . .

# 7. Google Cloud Run은 환경 변수 $PORT를 통해 접근받습니다. (기본 8080)
# uvicorn 실행 시 --port 8080으로 강제 설정하여 배포 호환성을 높입니다.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
