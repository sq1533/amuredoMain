document.addEventListener("DOMContentLoaded", () => {
    // 1. URL 파싱: '/item/{id}' 형태에서 맨 뒤의 ID값 추출
    const pathParts = window.location.pathname.split('/');
    const itemId = pathParts[pathParts.length - 1];

    const sliderTrack = document.getElementById("detailSliderTrack");
    const sliderDots = document.getElementById("detailSliderDots");
    const itemName = document.getElementById("detailItemName");
    const itemPrice = document.getElementById("detailItemPrice");

    if (!itemId) {
        sliderTrack.innerHTML = '<p style="padding: 2rem;">상품 정보를 찾을 수 없습니다.</p>';
        return;
    }

    // 2. 상품 상세 데이터 API 비동기 통신
    fetch(`/api/items/${itemId}`)
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                sliderTrack.innerHTML = `<p style="padding: 2rem;">${data.error}</p>`;
                return;
            }

            // 상품 이름, 가격 텍스트 렌더링
            itemName.textContent = data.name;
            itemPrice.textContent = `₩ ${data.price}`;

            // 상품 설명(코멘트) 렌더링 (인용 블록 디자인)
            const detailItemDesc = document.getElementById("detailItemDesc");
            if (detailItemDesc) {
                if (data.desc && data.desc.trim() !== "") {
                    // \n 줄바꿈 문자를 HTML <br> 태그로 치환해 뷰에 투영합니다 (정규식 사용)
                    detailItemDesc.innerHTML = data.desc.replace(/\n/g, '<br>');
                    detailItemDesc.style.display = 'block';
                } else {
                    // 코멘트가 빈 값이면 우아하게 숨김 처리합니다.
                    detailItemDesc.style.display = 'none';
                }
            }

            // 🏁 [요청사항 1 & 2] 네이버 스마트스토어 버튼 제거 및 장바구니 담기 버튼 탑재
            const cartAddBtn = document.getElementById("cartAddBtn");
            if (cartAddBtn) {
                // 일반고객 상세페이지에서는 항상 장바구니 담기 버튼을 노출시킵니다
                cartAddBtn.style.display = 'block';
                cartAddBtn.addEventListener("click", () => {
                    addToCart(itemId, data.name);
                });
            }

            // 🏁 [요청사항 3] 상세 이미지 섹터 동적 렌더링
            const detailImagesSection = document.getElementById("detailImagesSection");
            const detailProductImg = document.getElementById("detailProductImg");

            if (detailImagesSection) {
                detailImagesSection.style.display = 'block'; // 상세 이미지 섹션 노출 개시
                
                // Firestore 의 item > {itemID} > details 데이터 연동 (아직 없으면 임시 빈 공간 처리)
                if (data.details && data.details.trim() !== "") {
                    detailProductImg.src = data.details;
                    detailProductImg.style.display = 'block';
                } else {
                    // 상품별 고유 상세 이미지가 아직 생성되지 않은 상태이면 공간만 비워둠
                    detailProductImg.removeAttribute('src');
                    detailProductImg.style.display = 'none';
                }
            }

            // 이미지 배열 패치 및 스와이프 슬라이더 렌더링
            let paths = data.paths || [];
            if (paths.length === 0 || (paths.length === 1 && !paths[0])) {
                // 이미지가 없거나 첫번째 경로가 비어있을 경우 준비중(ready.webp) 이미지를 대체 노출
                paths = ["/static/img/ready.webp"];
            }

            renderSwipeSlider(paths);

            // 🏁 룩북(모델 사진) 갤러리 렌더링 로직 추가
            const lookbookSection = document.getElementById("lookbookSection");
            const lookbookTrack = document.getElementById("lookbookTrack");
            const lookbookTrackContainer = document.querySelector(".lookbook-track-container");
            const models = data.models || []; // 백엔드 통신으로 추가 전달받은 모델 path 배열

            if (lookbookSection && lookbookTrack && models.length > 0) {
                lookbookSection.style.display = 'block'; // 데이터가 있을 때만 룩북 공간 오픈
                
                models.forEach((imgUrl, index) => {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'lookbook-item';
                    
                    const imgEl = document.createElement('img');
                    imgEl.src = imgUrl;
                    imgEl.alt = `Lookbook 모델 이미지 ${index + 1}`;
                    imgEl.loading = 'lazy'; // 여러장일 경우 트래픽 분산을 위한 lazy 옵션
                    
                    itemDiv.appendChild(imgEl);
                    lookbookTrack.appendChild(itemDiv);
                });

                // PC 가로 스와이프 휠 바를 마우스로 잡고 끌 수 있도록 데스크탑 폴리필 적용
                if (lookbookTrackContainer) {
                    setupDesktopDrag(lookbookTrackContainer);
                }
            }
        })
        .catch(err => {
            console.error(err);
            sliderTrack.innerHTML = '<p style="padding: 2rem;">데이터를 불러오는 데 실패했습니다.</p>';
        });

    // 3. 네이티브 CSS 스크롤 스냅 & 마우스 드래그 기반 슬라이더 렌더링 엔진
    function renderSwipeSlider(paths) {
        sliderTrack.innerHTML = '';
        sliderDots.innerHTML = '';

        paths.forEach((imgUrl, index) => {
            // 슬라이드 패널(가로 1칸, 100% 폭, 좌우 padding 10px) 생성
            const slide = document.createElement('div');
            slide.className = 'detail-slide';

            // 1:1 박스 래퍼
            const wrapper = document.createElement('div');
            wrapper.className = 'detail-image-box';

            // 실제 이미지
            const img = document.createElement('img');
            img.src = imgUrl;
            img.className = 'detail-image';

            wrapper.appendChild(img);
            slide.appendChild(wrapper);
            sliderTrack.appendChild(slide);

            // 하단 조작용 페이징 도트(Dots) 생성 - 사진이 1장 이상일 때만 인터페이스 확장
            if(paths.length > 1) {
                const dot = document.createElement('button');
                dot.className = index === 0 ? 'detail-dot active' : 'detail-dot';
                dot.setAttribute('aria-label', `Go to slide ${index + 1}`);
                
                // 닷 클릭 시 해당 이미지칸으로 스무스하게 스크롤 이동
                dot.addEventListener('click', () => {
                    const scrollLeftAmount = slide.offsetLeft;
                    sliderTrack.scrollTo({ left: scrollLeftAmount, behavior: 'smooth' });
                });
                sliderDots.appendChild(dot);
            }
        });

        // 4. 스크롤 위치에 따라 활성화된 도트(Dot) 변경 로직 (Intersection Observer API)
        if(paths.length > 1) {
            const slides = document.querySelectorAll('.detail-slide');
            const dots = document.querySelectorAll('.detail-dot');

            const observerOptions = {
                root: sliderTrack,
                threshold: 0.6 // 화면에 60% 이상 진입하면 해당 사진 영역으로 간주
            };

            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        // 현재 눈 앞에 보이는 슬라이드의 인덱스를 찾아 닷 UI 까맣게 갱신
                        const activeIndex = Array.from(slides).indexOf(entry.target);
                        dots.forEach(d => d.classList.remove('active'));
                        if (activeIndex >= 0 && dots[activeIndex]) {
                            dots[activeIndex].classList.add('active');
                        }
                    }
                });
            }, observerOptions);

            slides.forEach(slide => observer.observe(slide));
        }

        // 5. PC 데스크탑 사용자를 위한 마우스 드래그(Click-and-Drag) 폴리필 적용
        setupDesktopDrag(sliderTrack);
    }

    // -------------------------------------------------------------
    // [공용 유틸리티] 마우스 드래그 가로 스크롤 지원 함수
    // -------------------------------------------------------------
    function setupDesktopDrag(trackElement) {
        let isDown = false;
        let startX;
        let scrollLeft;

        trackElement.addEventListener('mousedown', (e) => {
            isDown = true;
            trackElement.classList.add('active-drag'); // 드래그 시 CSS 스냅 해제 (튕김 방지)
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
            const walk = (x - startX) * 1.5; // 스크롤 민감도(속도)
            trackElement.scrollLeft = scrollLeft - walk;
        });
    }

    // -------------------------------------------------------------
    // 6. 최하단 '연관 아이템' 비동기 호출 및 렌더링 로직
    // -------------------------------------------------------------
    const relatedSection = document.getElementById("relatedSection");
    const relatedTrack = document.getElementById("relatedTrack");

    if (itemId && relatedSection && relatedTrack) {
        fetch(`/api/items/${itemId}/related`)
            .then(res => res.json())
            .then(data => {
                const items = data.items;
                // 동일 코드를 가진 연관 상품이 1개라도 있을 때만 노출
                if (items && items.length > 0) {
                    relatedSection.style.display = 'block';
                    
                    items.forEach(item => {
                        // 1. 전체 카드 컨테이너
                        const card = document.createElement('a');
                        card.className = 'related-card';
                        card.href = `/item/${item.id}`; // 클릭 시 페이지 이동

                        // 2. 1:1 이미지 래퍼 박스
                        const imgWrapper = document.createElement('div');
                        imgWrapper.className = 'related-card-img-wrapper';

                        const img = document.createElement('img');
                        img.src = item.path || "/static/img/ready.webp";
                        img.alt = item.name;

                        imgWrapper.appendChild(img);

                        // 3. 상품명 라벨
                        const nameEl = document.createElement('p');
                        nameEl.className = 'related-name';
                        nameEl.textContent = item.name;

                        // 4. 조합 후 트랙에 삽입
                        card.appendChild(imgWrapper);
                        card.appendChild(nameEl);
                        
                        relatedTrack.appendChild(card);
                    });

                    // 연관 아이템 스와이퍼 영역 역시 PC 마우스 드래그를 지원합니다.
                    setupDesktopDrag(document.querySelector('.related-track-container'));
                }
            })
            .catch(err => {
                console.error("연관 상품 호출 에러:", err);
            });
    }

    // 🏁 추후 일반 장바구니 연동을 위한 백엔드 API 스켈레톤 및 라이브 쿠키 연동 함수
    function addToCart(itemId, itemName) {
        // 🏁 비로그인(Guest) 상태일 때 장바구니 담기 원천 차단
        const roleMatch = document.cookie.match(new RegExp('(^| )amuredo_role=([^;]+)'));
        const role = roleMatch ? decodeURIComponent(roleMatch[2]) : "guest";
        
        if (role === "guest") {
            const confirmLogin = confirm("장바구니 기능은 로그인 후 이용하실 수 있습니다.\n로그인 화면으로 이동할까요?");
            if (confirmLogin) {
                window.location.href = "/login";
            }
            return;
        }

        // 1. 쿠키에서 장바구니 읽기
        let cart = [];
        const match = document.cookie.match(new RegExp('(^| )general_cart=([^;]+)'));
        if (match) {
            try {
                cart = JSON.parse(decodeURIComponent(match[2]));
            } catch(e) {
                cart = [];
            }
        }
        
        // 2. 중복 담기 방지
        const exists = cart.find(item => item.id === itemId);
        if (exists) {
            alert("이미 장바구니에 담겨 있는 안경입니다.");
            return;
        }
        
        // 3. 상품 데이터 칩 추가 (쿠키 용량 과부하 방지를 위해 ID만 보존)
        cart.push({
            id: itemId
        });
        
        // 4. 쿠키 저장
        document.cookie = `general_cart=${encodeURIComponent(JSON.stringify(cart))}; path=/; max-age=2592000`;
        
        // 5. Firebase RTDB에 실시간 즉시 동기화 수행
        fetch('/api/user/cart/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cart: cart })
        })
        .then(res => res.json())
        .then(syncData => {
            if (syncData.status === 'success') {
                // 세션 스토리지의 초깃값도 새 상태로 동기화 갱신
                sessionStorage.setItem("initialCartState", JSON.stringify(cart));
            }
        })
        .catch(err => {
            console.error("장바구니 DB 동기화 실패:", err);
        });
        
        alert(`'${itemName}' 상품이 장바구니에 담겼습니다.`);
    }
});
