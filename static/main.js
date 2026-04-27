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
            const banners = data.banners;
            
            // 불러온 배너 객체 배열(.banners)이 존재할 경우 화면 렌더링 시작
            if (banners && banners.length > 0) {
                renderBanner(banners);
            }
        })
        .catch(error => {
            console.error("Firebase API 배너 이미지 데이터를 불러오는 중 오류 발생:", error);
        });

    // 2. 메인 배너 화면 렌더링 핵심 함수 (스와이프리스 터치 라우팅)
    function renderBanner(banners) {
        bannerTrack.innerHTML = '';
        
        // 엣지 화살표 버튼 서치
        const btnPrev = document.getElementById("bannerNavPrev");
        const btnNext = document.getElementById("bannerNavNext");
        
        // 데이터가 없다면 그리기 중단
        if (!banners || banners.length === 0) return;
        const total = banners.length;

        // 이미지 DOM 생성 (지저분한 무한 양끝 클로닝 로직 걷어냄)
        banners.forEach((bannerObj, index) => {
            const img = document.createElement('img');
            img.src = bannerObj.path;
            img.alt = `amuredo 메인 기획 배너 ${index}`;
            img.className = 'banner-img'; 
            
            // 🏁 [완벽한 버튼 분리] 순수하게 '가운데 이미지 영역' 클릭 시에만 라우팅 이동
            img.style.cursor = 'pointer'; 
            img.addEventListener('click', () => {
                const targetUrl = bannerObj.url;
                if (!targetUrl || targetUrl.trim() === "") {
                    // url 공백 Fallback 메인 귀환
                    location.href = '/';
                } else {
                    location.href = targetUrl;
                }
            });
            bannerTrack.appendChild(img);
        });
        
        let currentIndex = 0;
        let autoSlideInterval = null;
        
        // --- 좌/우 이동의 통제 타워 (인스타 스토리 방식) ---
        function moveBanner(index) {
            const width = bannerTrack.offsetWidth;
            // 지정된 위치로 부드럽게 스크롤
            bannerTrack.scrollTo({ left: index * width, behavior: 'smooth' });
            
            // 기존 5초 루프 죽이고 현재 배너 기준 새로 5초 부여
            if (autoSlideInterval) clearInterval(autoSlideInterval);
            currentIndex = index;
            autoSlideInterval = setInterval(slideNext, 5000);
        }
        
        function slideNext() {
            let nextIndex = currentIndex + 1;
            if (nextIndex >= total) nextIndex = 0; // 끝 도달 시 1번 배너로 리와인드 귀환
            moveBanner(nextIndex);
        }
        
        function slidePrev() {
            let prevIndex = currentIndex - 1;
            if (prevIndex < 0) prevIndex = total - 1; // 맨 앞 배너 도달 시 끝으로 이동
            moveBanner(prevIndex);
        }
        
        // 🏁 모바일 양끝 100% 터치 및 PC 화살표 버튼 클릭 이벤트 최종 매핑
        if (btnPrev) btnPrev.addEventListener('click', slidePrev);
        if (btnNext) btnNext.addEventListener('click', slideNext);

        // --- 초기 시작점 (Start Scene) ---
        // 1번장 출발
        moveBanner(0);
        
        // 상단 최적화 배너는 이제 JS 드래그 코드가 개입하지 않도록 완전히 격리됩니다.
        // setupDesktopDrag(bannerTrack); 부분 삭제 완료.
    }

    // (베스트 섹션 이미지 스와이프 코드 제거 완료 - 정적 그리드 방식 적용)

    // 3. 메인 하단(상단부): 'Glasses Best' 전용 상품 3열 그리드 생성 로직
    const glassesBestGrid = document.getElementById("glassesBestGrid");
    fetch('/api/items/glasses_best')
        .then(response => response.json())
        .then(data => {
            const newItems = data.items;
            if (newItems && newItems.length > 0) {
                renderItemsTrack(glassesBestGrid, newItems);
                // setupDesktopDrag 삭제됨
            }
        })
        .catch(error => console.error("Glasses Best 아이템 통신 오류:", error));

    // 4. 메인 최하단: 'Sunglasses Best' 아이템 3열 그리드 생성 로직
    const sunglassesBestGrid = document.getElementById("sunglassesBestGrid");
    fetch('/api/items/sunglasses_best')
        .then(response => response.json())
        .then(data => {
            const bestItems = data.items;
            if (bestItems && bestItems.length > 0) {
                renderItemsTrack(sunglassesBestGrid, bestItems);
                // setupDesktopDrag 삭제됨
            }
        })
        .catch(error => console.error("Sunglasses Best 아이템 통신 오류:", error));

    /**
     * 상품 리스트를 받아서 지정된 컨테이너에 가로 스와이프용 카드를 생성하는 공용 함수
     */
    function renderItemsTrack(container, items) {
        container.innerHTML = ''; 

        items.forEach(item => {
            const card = document.createElement('article');
            card.className = 'item-card';

            const imgWrapper = document.createElement('div');
            imgWrapper.className = 'item-image-wrapper';
            imgWrapper.addEventListener('click', () => { location.href = `/item/${item.id}`; });

            const img = document.createElement('img');
            img.src = item.image_url;
            img.alt = item.name;
            img.className = 'item-image';
            imgWrapper.appendChild(img);

            const nameEl = document.createElement('h3');
            nameEl.className = 'item-name';
            nameEl.textContent = item.name;
            nameEl.addEventListener('click', () => { location.href = `/item/${item.id}`; });

            const priceEl = document.createElement('p');
            priceEl.className = 'item-price';
            priceEl.textContent = `₩ ${item.price}`;

            card.appendChild(imgWrapper);
            card.appendChild(nameEl);
            card.appendChild(priceEl);
            container.appendChild(card);
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
            trackElement.classList.add('active-drag'); // 드래그 중 스냅 일시 해제
            startX = e.pageX - trackElement.offsetLeft;
            scrollLeft = trackElement.scrollLeft;
        });

        trackElement.addEventListener('mouseleave', () => {
            if (!isDown) return;
            isDown = false;
            trackElement.classList.remove('active-drag');
        });

        trackElement.addEventListener('mouseup', (e) => {
            if (!isDown) return;
            isDown = false;
            trackElement.classList.remove('active-drag');
            
            // 드래그 거리에 따른 강제 스냅 보정 로직
            const endX = e.pageX - trackElement.offsetLeft;
            const diff = startX - endX; // 양수: 다음으로 밀기, 음수: 이전으로 밀기
            const threshold = 50; // 50px 이상 움직이면 다음 장으로 판단
            const width = trackElement.offsetWidth;
            
            if (Math.abs(diff) > threshold) {
                const target = diff > 0 
                    ? Math.ceil(trackElement.scrollLeft / width) * width 
                    : Math.floor(trackElement.scrollLeft / width) * width;
                
                trackElement.scrollTo({
                    left: target,
                    behavior: 'smooth'
                });
            }
        });

        trackElement.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - trackElement.offsetLeft;
            const walk = (x - startX) * 1.5; // 드래그 가속도
            trackElement.scrollLeft = scrollLeft - walk;
        });
    }
});
