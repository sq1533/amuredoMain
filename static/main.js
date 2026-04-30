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

    /* 🏁 신규: 스크롤 감지하여 헤더 배경색 토글 (오버레이 모드) */
    const mainHeader = document.querySelector(".main-header");
    window.addEventListener("scroll", () => {
        if (window.scrollY > 50) {
            mainHeader.classList.add("scrolled");
        } else {
            mainHeader.classList.remove("scrolled");
        }
    });

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
       2. 메인 배너 슬라이드 캐러셀 로직 삭제됨 (단일 비디오 배너 전환)
       ==================================================== */


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
