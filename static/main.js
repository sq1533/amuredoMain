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
       2. 메인 베스트 상품 탭(Tab) 전환 및 데이터 로딩 로직
       ==================================================== */
    const bestTabs = document.querySelectorAll(".best-tab");
    const bestItemsGrid = document.getElementById("bestItemsGrid");
    const bestHashtags = document.getElementById("bestHashtags");
    const bestMainBanner = document.getElementById("bestMainBanner");
    
    // 탭별 해시태그 정의
    const hashtagData = {
        focus: ["# 초경량 기어", "# 시각 노이즈 차단", "# 12g의 혁신", "# 오피스 셋업"],
        meeting: ["# 프로페셔널", "# 신뢰의 완성", "# 비즈니스 에디션", "# 완벽한 핏"],
        drive: ["# 시야 확보", "# 자외선 차단", "# 필드 워커", "# 야외 활동"],
        holiday: ["# 바캉스 필수", "# 휴가 스타일링", "# 시선 집중", "# 휴일 컬렉션"]
    };

    // 탭별 메인 화보 이미지 매칭
    const bannerImageData = {
        focus: "/static/img/main01.webp",
        meeting: "/static/img/main02.webp",
        drive: "/static/img/main03.webp",
        holiday: "/static/img/main04.webp"
    };

    /**
     * 특정 이벤트 타입의 베스트 아이템을 불러와 렌더링하는 함수
     */
    function loadBestItems(eventType) {
        fetch(`/api/items/best/${eventType}`)
            .then(response => response.json())
            .then(data => {
                const items = data.items || [];
                renderBestGearItems(bestItemsGrid, items);
                
                // 해시태그 업데이트
                if (bestHashtags && hashtagData[eventType]) {
                    bestHashtags.innerHTML = hashtagData[eventType]
                        .map(tag => `<span class="hashtag-text">${tag}</span>`)
                        .join("");
                }

                // 메인 화보 이미지 업데이트
                if (bestMainBanner && bannerImageData[eventType]) {
                    bestMainBanner.src = bannerImageData[eventType];
                }
            })
            .catch(error => console.error(`Best Items(${eventType}) 통신 오류:`, error));
    }

    // 탭 클릭 이벤트 바인딩
    bestTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            // 활성화 스타일 전환
            bestTabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");

            // 데이터 로드
            const eventType = tab.getAttribute("data-event");
            loadBestItems(eventType);
        });
    });

    // 초기 로딩 (Focus 탭 기본 활성화)
    loadBestItems("focus");

    /* ====================================================
       3. 브랜드 채널(About) URL 동적 바인딩 로직
       ==================================================== */
    const naverStoreLink = document.getElementById("naverStoreLink");
    const naverBlogLink = document.getElementById("naverBlogLink");
    const instagramLink = document.getElementById("instagramLink");

    fetch('/api/about')
        .then(response => response.json())
        .then(data => {
            if (data.naverStore) naverStoreLink.href = data.naverStore;
            else naverStoreLink.style.display = 'none';

            if (data.blog) naverBlogLink.href = data.blog;
            else naverBlogLink.style.display = 'none';

            if (data.instargram) instagramLink.href = data.instargram;
            else instagramLink.style.display = 'none';
        })
        .catch(error => console.error("About 정보 로딩 실패:", error));

    /**
     * 상품 리스트를 받아서 가로형 '기어 카드' 레이아웃(이미지 2: 정보 1)으로 렌더링
     */
    function renderBestGearItems(container, items) {
        container.innerHTML = ''; 
        
        // 추천된 대로 상위 3개 아이템만 노출
        const displayItems = items.slice(0, 3);

        displayItems.forEach(item => {
            const card = document.createElement('article');
            card.className = 'best-gear-card';

            // 왼쪽: 이미지 영역 (비중 2)
            const imgSide = document.createElement('div');
            imgSide.className = 'gear-image-side';
            imgSide.addEventListener('click', () => { location.href = `/item/${item.id}`; });
            
            const img = document.createElement('img');
            img.src = item.image_url;
            img.alt = item.name;
            imgSide.appendChild(img);

            // 오른쪽: 정보 영역 (비중 1)
            const infoSide = document.createElement('div');
            infoSide.className = 'gear-info-side';

            const specLabel = document.createElement('span');
            specLabel.className = 'gear-spec-label';
            specLabel.textContent = 'OFFICE GEAR SPEC';

            const nameEl = document.createElement('h3');
            nameEl.className = 'gear-name';
            nameEl.textContent = item.name;
            nameEl.addEventListener('click', () => { location.href = `/item/${item.id}`; });

            // 태그 정보 (소재/특징)
            const tagsWrap = document.createElement('div');
            tagsWrap.className = 'gear-tags';
            const tags = item.category ? item.category.split(',') : ['Premium', 'Lightweight'];
            tags.forEach(tag => {
                const tagSpan = document.createElement('span');
                tagSpan.className = 'gear-tag';
                tagSpan.textContent = `# ${tag.trim()}`;
                tagsWrap.appendChild(tagSpan);
            });

            const priceEl = document.createElement('p');
            priceEl.className = 'gear-price';
            priceEl.textContent = `₩ ${item.price}`;

            const actionBtn = document.createElement('a');
            actionBtn.className = 'gear-action-btn';
            actionBtn.href = `/item/${item.id}`;
            actionBtn.textContent = '장비 상세보기';

            infoSide.appendChild(specLabel);
            infoSide.appendChild(nameEl);
            infoSide.appendChild(tagsWrap);
            infoSide.appendChild(priceEl);
            infoSide.appendChild(actionBtn);

            card.appendChild(imgSide);
            card.appendChild(infoSide);
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
