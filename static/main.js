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
        bannerTrack.innerHTML = '';
        
        // [지능형 루프 핵심] 이미지 클로닝 (앞뒤에 하나씩 더 붙임)
        // 구성: [마지막장 복제] - [1, 2, 3...] - [1번장 복제]
        const extendedPaths = [
            paths[paths.length - 1], 
            ...paths,                
            paths[0]                 
        ];

        extendedPaths.forEach((url, index) => {
            const img = document.createElement('img');
            img.src = url;
            img.alt = `amuredo 메인 배너 이미지 ${index}`;
            img.className = 'banner-img'; 
            bannerTrack.appendChild(img);
        });

        // 3. 초기 위치 설정 (두 번째 칸 - 원본 첫 번째 장)
        // 렌더링 직후 너비 계산을 위해 최소한의 지연시간(50ms) 후 이동
        setTimeout(() => {
            const width = bannerTrack.offsetWidth;
            bannerTrack.scrollLeft = width;
            
            // 무한 루프 감시 엔진 가동
            setupInfiniteLoop(bannerTrack, paths.length);
        }, 50);

        // 4. PC 데스크탑 환경을 위한 마우스 드래그(스와이프) 폴리필 부착
        setupDesktopDrag(bannerTrack);
    }

    /* 🏁 신규: 모든 베스트 섹션(선글라스/안경) 이미지 스와이프 배너 드래그 연결 */
    const itemBestTracks = document.querySelectorAll(".best-banner-track");
    itemBestTracks.forEach(track => {
        setupDesktopDrag(track);
    });

    // [지능형 루프 엔진] 스크롤 위치를 실시간 감시하여 경계선에서 '사일런트 워프' 수행
    function setupInfiniteLoop(track, originalCount) {
        track.addEventListener('scroll', () => {
            const width = track.offsetWidth;
            const scrollLeft = track.scrollLeft;
            
            // 1. 맨 앞(마지막장 복제본) 위치에 도달했을 때 -> 진짜 마지막장 위치로 순간 이동
            if (scrollLeft <= 0) {
                track.style.scrollBehavior = 'auto'; // 애니메이션 없이 점프
                track.scrollLeft = originalCount * width;
                setTimeout(() => { track.style.scrollBehavior = 'smooth'; }, 10);
            }
            
            // 2. 맨 뒤(1번장 복제본) 위치에 도달했을 때 -> 진짜 1번장 위치로 순간 이동
            // (originalCount + 1) 번째 칸이 마지막 클론 위치임
            if (scrollLeft >= (originalCount + 1) * width - 1) {
                track.style.scrollBehavior = 'auto';
                track.scrollLeft = width;
                setTimeout(() => { track.style.scrollBehavior = 'smooth'; }, 10);
            }
        });
    }
    // 3. 메인 하단: 'Sunglasses Best' 아이템 카드 스와이퍼 생성 로직
    const sunglassesBestGrid = document.getElementById("sunglassesBestGrid");
    fetch('/api/items/sunglasses_best')
        .then(response => response.json())
        .then(data => {
            const bestItems = data.items;
            if (bestItems && bestItems.length > 0) {
                renderItemsTrack(sunglassesBestGrid, bestItems);
                setupDesktopDrag(sunglassesBestGrid);
            }
        })
        .catch(error => console.error("Sunglasses Best 아이템 통신 오류:", error));

    // 4. 메인 최하단: 'Glasses Best' 전용 상품 카드 스와이퍼 생성 로직
    const glassesBestGrid = document.getElementById("glassesBestGrid");
    fetch('/api/items/glasses_best')
        .then(response => response.json())
        .then(data => {
            const newItems = data.items;
            if (newItems && newItems.length > 0) {
                renderItemsTrack(glassesBestGrid, newItems);
                setupDesktopDrag(glassesBestGrid);
            }
        })
        .catch(error => console.error("Glasses Best 아이템 통신 오류:", error));

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
