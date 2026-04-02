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
       1.5. 스크롤 위치 감지(IntersectionObserver) 애니메이션 등록
       ==================================================== */
    const fadeElements = document.querySelectorAll(".fade-in-section");
    // 사용자가 스크롤을 내려 해당 요소가 뷰포트에 살짝(10%) 걸치면 노출시킴
    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("is-visible");
                obs.unobserve(entry.target); // 한번 렌더링된 후에는 감지 해제 (퍼포먼스 향상)
            }
        });
    }, { 
        threshold: 0.1 
    });
    
    // HTML에 class="fade-in-section" 가 붙은 모든 요소들을 감시 대상에 넣음
    fadeElements.forEach(el => observer.observe(el));

    /* ====================================================
       2. 메인 배너 슬라이드 캐러셀 로직 
          (5초 자동 전환 / 이전·다음 마우스 수동 전환)
       ==================================================== */
       
    const bannerTrack = document.getElementById("bannerTrack");
    
    // 1. 백엔드(FastAPI)의 Firebase 데이터 조회(임시) 엔드포인트에 요청을 보냅니다.
    fetch('/api/banner')
        .then(response => response.json())
        .then(data => {
            const paths = data.paths;
            
            // 불러온 이미지 리스트(.paths)가 존재할 경우 화면 렌더링 과정을 시작합니다
            if (paths && paths.length > 0) {
                renderBanner(paths);
            }
        })
        .catch(error => {
            console.error("Firebase API 배너 이미지 데이터를 불러오는 중 오류 발생:", error);
        });

    // 2. 전달받은 이미지 URL 목록 데이터를 화면의 HTML 태그(<img>)로 만들어 출력시키는 함수입니다
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

        // 3. PC 데스크탑 환경을 위한 마우스 드래그(스와이프) 폴리필 부착
        setupDesktopDrag(bannerTrack);
    }
    /* ====================================================
       2.5. 프로모션(Code) 영역 스와이퍼 제어 로직
       ==================================================== */
    const promoSection = document.getElementById("promoSection");
    const promoImage = document.getElementById("promoImage");
    const promoInfo = document.getElementById("promoInfo");
    const promoPrevBtn = document.getElementById("promoPrevBtn");
    const promoNextBtn = document.getElementById("promoNextBtn");
    const promoDetailBtn = document.getElementById("promoDetailBtn"); // 상세보기 버튼 취득

    let promoDataList = [];
    let currentPromoIdx = 0;

    // 1. 프로모션 데이터 파싱
    fetch('/api/promotions')
        .then(res => res.json())
        .then(data => {
            const items = data.items;
            if (items && items.length > 0) {
                promoDataList = items;
                promoSection.style.display = 'block'; // 데이터가 있으면 화면에 노출
                renderPromo(0); // 최초 첫 번째 렌더링
            }
        })
        .catch(error => {
            console.error("Firebase 프로모션 데이터 호출 에러:", error);
        });

    // 2. 인덱스 기반 화면 렌더 트랜지션 함수
    function renderPromo(idx) {
        if (promoDataList.length === 0) return;
        
        // 투명도 트랜지션 효과를 위해 일시적으로 투명하게 만듦
        promoImage.style.opacity = '0';
        promoInfo.style.opacity = '0';

        setTimeout(() => {
            const item = promoDataList[idx];
            promoImage.src = item.path;
            promoInfo.innerHTML = item.info.replace(/\n/g, '<br>'); // 줄바꿈 지원
            
            // 데이터 교체 후 투명도 복구
            promoImage.style.opacity = '1';
            promoInfo.style.opacity = '1';
        }, 200); // 0.2초 딜레이
    }

    if (promoPrevBtn && promoNextBtn) {
        promoPrevBtn.addEventListener('click', () => {
            currentPromoIdx--;
            if (currentPromoIdx < 0) currentPromoIdx = promoDataList.length - 1;
            renderPromo(currentPromoIdx);
        });

        promoNextBtn.addEventListener('click', () => {
            currentPromoIdx++;
            if (currentPromoIdx >= promoDataList.length) currentPromoIdx = 0;
            renderPromo(currentPromoIdx);
        });
    }

    // 3. 상세보기(징검다리 API) 연결 연동
    if (promoDetailBtn) {
        promoDetailBtn.addEventListener("click", () => {
            if (promoDataList.length > 0) {
                // 현재 보고 있는 프로모션의 고유 아이디(code) 추출
                const targetCodeId = promoDataList[currentPromoIdx].id;
                // 만들어둔 백엔드 리다이렉트 API로 브라우저 이동
                location.href = `/api/promo-redirect/${targetCodeId}`;
            }
        });
    }

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

    /* ====================================================
       4. [공용 유틸리티] 데스크탑 마우스 드래그 가로 스크롤 호환 함수
       ==================================================== */
    function setupDesktopDrag(trackElement) {
        let isDown = false;
        let startX;
        let scrollLeft;

        trackElement.addEventListener('mousedown', (e) => {
            isDown = true;
            trackElement.classList.add('active-drag'); // CSS Snap 해제용
            startX = e.pageX - trackElement.offsetLeft;
            scrollLeft = trackElement.scrollLeft;
        });

        trackElement.addEventListener('mouseleave', () => {
            isDown = false;
            trackElement.classList.remove('active-drag');
        });

        trackElement.addEventListener('mouseup', () => {
            isDown = false;
            trackElement.classList.remove('active-drag');
        });

        trackElement.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - trackElement.offsetLeft;
            const walk = (x - startX) * 1.5; // 드래그 속도 배율
            trackElement.scrollLeft = scrollLeft - walk;
        });
    }
});
