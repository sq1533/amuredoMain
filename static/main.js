// HTML 문서 전체 로딩(DOM 인식) 후 스크립트 실행
document.addEventListener("DOMContentLoaded", () => {
    
    /* ====================================================
       1. 모바일 기기의 슬라이딩 토스트(드로어) 메뉴 팝업 로직 구현
       ==================================================== */
       
    const menuToggleBtn = document.getElementById("menuToggleBtn");
    const closeMenuBtn = document.getElementById("closeMenuBtn");
    const pageNav = document.getElementById("pageNav");
    const navOverlay = document.getElementById("navOverlay");

    // 메뉴 창을 열기/닫기 처리 해 주는 토글 함수
    function toggleMenu() {
        // 내부 CSS의 toggle 기능을 이용하여 '.open' 클래스의 유무를 판단해 추가/삭제 합니다.
        // open 클래스가 들어가면 CSS에서 left: 0 으로 설정되어 화면 밖 좌측에 숨겨진 상자가 튀어나옵니다.
        pageNav.classList.toggle("open");
        navOverlay.classList.toggle("open");
    }

    // 모바일 햄버거 버튼 클릭 시 여는 이벤트 연결
    menuToggleBtn.addEventListener("click", toggleMenu);
    
    // 메뉴 안의 X(닫기) 버튼 또는 바깥의 반투명 검은 배경 클릭 시 닫히도록 이벤트 연동
    closeMenuBtn.addEventListener("click", toggleMenu);
    navOverlay.addEventListener("click", toggleMenu);


    /* ====================================================
       2. 메인 배너 슬라이드 캐러셀 로직 
          (5초 자동 전환 / 이전·다음 마우스 수동 전환)
       ==================================================== */
       
    const bannerTrack = document.getElementById("bannerTrack");
    const prevBtn = document.getElementById("bannerPrevBtn");
    const nextBtn = document.getElementById("bannerNextBtn");
    
    let currentSlide = 0;   // 현재 보고 있는 이미지 번호의 위치 (인덱스)
    let totalSlides = 0;    // 전달 받은 전체 이미지 배너 개수
    let slideTimer = null;  // 5초 간격으로 이미지를 넘겨줄 타이머 저장용 변수

    // 1. 백엔드(FastAPI)의 Firebase 데이터 조회(임시) 엔드포인트에 요청을 보냅니다.
    fetch('/api/banner')
        .then(response => response.json())
        .then(data => {
            const paths = data.paths;
            
            // 불러온 이미지 리스트(.paths)가 존재할 경우 화면 렌더링 과정을 시작합니다
            if (paths && paths.length > 0) {
                renderBanner(paths);
                startAutoSlide(); // 렌더링이 완전히 성공하면 즉시 5초 세기 타이머 시작
            }
        })
        .catch(error => {
            console.error("Firebase API 배너 이미지 데이터를 불러오는 중 오류 발생:", error);
        });

    // 2. 전달받은 이미지 URL 목록 데이터(paths)를 화면의 HTML 태그(<img>)로 만들어 출력시키는 함수입니다
    function renderBanner(paths) {
        bannerTrack.innerHTML = ''; // 기본적으로 남아있는 임시 영역 텍스트 등 초기화
        
        // 반복문을 돌며 이미지 태그 하나하나를 동적으로 생성해 넣습니다.
        paths.forEach((url, index) => {
            const img = document.createElement('img');
            img.src = url;
            img.alt = `amuredo 메인 배너 이미지 ${index + 1}`;
            img.className = 'banner-img'; // CSS에서 '100% 꽉 채운 속성'을 상속합니다
            bannerTrack.appendChild(img);
        });
        
        totalSlides = paths.length; // 들어간 이미지의 총 개수 파악
        goToSlide(0); // 렌더링 끝난 직후 0번(첫 번째) 화면 세팅
    }

    // 3. 원하는 슬라이드 번호(index) 방향으로 이미지를 강제로 밀어 전환시키는 효과 함수
    function goToSlide(index) {
        if (totalSlides === 0) return; // 표시할 사진이 없으면 정지
        
        currentSlide = index;
        
        // 배열 범위를 계산하여 루프(무한 반복)를 구현합니다
        if (currentSlide < 0) {
            // 맨 처음 사진에서 '이전' 방향으로 돌아갈 경우 맨 뒷 사진이 나옵니다
            currentSlide = totalSlides - 1; 
        } 
        else if (currentSlide >= totalSlides) {
            // 끝 사진에서 '다음' 방향을 누르면 배열 갯수를 초과해 0번 사진으로 루프됩니다
            currentSlide = 0; 
        }

        /* 
           flex box에서 track(기차 길이 연상)을 통째로 좌측(-X축)으로 좌표이동 시킵니다
           계산예시 : 0% (첫 번째 사진), -100% (옆의 두 번째 사진 표시), -200% (세 번째 사진 표시) 
        */
        const offset = currentSlide * 100;
        bannerTrack.style.transform = `translateX(-${offset}%)`;
    }

    // 4. 요구사항 조건: 이미지가 화면에 노출된 지 '5초(5000ms)' 유지 시 자동으로 넘기는 구동기
    function startAutoSlide() {
        clearInterval(slideTimer); // 이미 과거에 작동중인 타이머가 있으면 혼서 방지를 위해 바로 파괴함
        
        // 5초에 한번씩 강제로 goToSlide 방향을 한 칸씩 뒤(+1)로 보냅니다
        slideTimer = setInterval(() => {
            goToSlide(currentSlide + 1); 
        }, 5000); 
    }

    // 5. 고객이 수동으로 배너 좌, 우 (이전/다음) 10px 버튼 클릭 시 발생하는 액션 함수
    function handleManualSlide(direction) {
        if (direction === 'next') {
            goToSlide(currentSlide + 1);
        } else {
            goToSlide(currentSlide - 1);
        }
        
        // **고객이 버튼으로 화면을 수동 조작했다면, 5초 타이머를 강제로 첫 0초 지점으로 초기화시켜 사용자 경험(UX) 엉킴을 방지합니다**
        startAutoSlide();
    }

    // 사용자가 실제로 누를 다음 버튼 객체에 클릭 이벤트 연동
    nextBtn.addEventListener("click", () => handleManualSlide('next'));
    prevBtn.addEventListener("click", () => handleManualSlide('prev'));

    /* ====================================================
       3. 메인 하단: 'Best' 아이템 카드 3열 그리드 생성 로직
          (Firebase 필터링 데이터 호출 및 1:1 카드 렌더링, 클릭 이벤트)
       ==================================================== */
    
    const bestItemsGrid = document.getElementById("bestItemsGrid");

    // 백엔드의 FastAPI (Firebase event: 'best' 필터링 대상) 엔드포인트 요청
    fetch('/api/items/best')
        .then(response => response.json())
        .then(data => {
            const bestItems = data.items;
            if (bestItems && bestItems.length > 0) {
                renderBestItems(bestItems);
            }
        })
        .catch(error => {
            console.error("Best 아이템 데이터를 불러오는 중 통신 오류 발생:", error);
        });

    // 받은 JSON (str 계열의 name, price 및 이미지url) 바탕으로 즉시 아이템 카드 HTML 삽입
    function renderBestItems(items) {
        bestItemsGrid.innerHTML = ''; // 요소 청소

        items.forEach(item => {
            // 개별 아이템 카드 컨테이너
            const card = document.createElement('article');
            card.className = 'item-card';

            // 1. 이미지 래퍼 (정사각형 1:1 비율 세팅 구역) - 클릭 이벤트(Switch) 탑재
            const imgWrapper = document.createElement('div');
            imgWrapper.className = 'item-image-wrapper';
            imgWrapper.addEventListener('click', () => {
                // 요구사항: 상세 페이지 switch 전환 연결
                location.href = `/item/${item.id}`; 
            });

            // 2. 실제 썸네일 이미지 태그
            const img = document.createElement('img');
            img.src = item.image_url;
            img.alt = item.name;
            img.className = 'item-image';
            imgWrapper.appendChild(img);

            // 3. 상품명 문자열 생성 및 클릭 전환(Switch) 이벤트 처리
            const nameEl = document.createElement('h3');
            nameEl.className = 'item-name';
            nameEl.textContent = item.name; // string 삽입
            nameEl.addEventListener('click', () => {
                // 요구사항: 이미지, name 부분 모두 상세 페이지로 전환됨.
                location.href = `/item/${item.id}`;
            });

            // 4. 상품 가격 문자열 생성
            const priceEl = document.createElement('p');
            priceEl.className = 'item-price';
            priceEl.textContent = item.price; // 예: "35,000원" 등의 string 삽입

            // 상자 조립 (부모 요소에 자식 순서대로 결합)
            card.appendChild(imgWrapper);
            card.appendChild(nameEl);
            card.appendChild(priceEl);

            // 최종적으로 페이지의 그리드 시스템 컨테이너에 카드를 장착
            bestItemsGrid.appendChild(card);
        });
    }
});
