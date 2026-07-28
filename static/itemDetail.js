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

            // 🏁 [수정] 통합 상세 이미지 섹션 동적 렌더링 (details -> models -> info)
            const detailImagesSection = document.getElementById("detailImagesSection");
            const detailProductImg = document.getElementById("detailProductImg");
            const detailModelImagesContainer = document.getElementById("detailModelImagesContainer");
            const detailInfoImg = document.getElementById("detailInfoImg");

            if (detailImagesSection) {
                detailImagesSection.style.display = 'block'; // 상세 이미지 섹션 노출 개시
                
                // 1) 상품별 고유 상세 이미지
                if (data.details && data.details.trim() !== "") {
                    detailProductImg.src = data.details;
                    detailProductImg.style.display = 'block';
                } else {
                    detailProductImg.removeAttribute('src');
                    detailProductImg.style.display = 'none';
                }

                // 2) 모델 이미지 리스트 (세로 스크롤 나열)
                if (detailModelImagesContainer) {
                    detailModelImagesContainer.innerHTML = "";
                    const models = data.models || [];
                    if (models.length > 0) {
                        models.forEach((imgUrl, index) => {
                            const imgEl = document.createElement('img');
                            imgEl.src = imgUrl;
                            imgEl.alt = `모델 이미지 ${index + 1}`;
                            imgEl.loading = 'lazy';
                            imgEl.style.cssText = "width: 100%; display: block; margin: 0; padding: 0; border: none; height: auto;";
                            detailModelImagesContainer.appendChild(imgEl);
                        });
                        detailModelImagesContainer.style.display = 'block';
                    } else {
                        detailModelImagesContainer.style.display = 'none';
                    }
                }

                // 3) B2B/B2C 공통 사이즈 스펙 정보 (info + size 데이터 바인딩)
                const detailInfoSection = document.getElementById("detailInfoSection");
                const detailSizeList = document.getElementById("detailSizeList");
                
                if (detailInfoSection && detailSizeList) {
                    if (data.size && Object.keys(data.size).length > 0) {
                        const size = data.size;
                        
                        // 데이터 정렬 순서 정의
                        const specs = [
                            { label: "1 프레임", value: size.frame },
                            { label: "2 렌즈 가로", value: size.lens1 },
                            { label: "3 렌즈 세로", value: size.lens2 },
                            { label: "4 브릿지", value: size.bridge },
                            { label: "5 안경 다리", value: size.temple }
                        ];
                        
                        detailSizeList.innerHTML = "";
                        specs.forEach(spec => {
                            const li = document.createElement("li");
                            
                            const labelSpan = document.createElement("span");
                            labelSpan.className = "label";
                            labelSpan.textContent = spec.label;
                            
                            const valueSpan = document.createElement("span");
                            valueSpan.className = "value";
                            valueSpan.textContent = (spec.value !== undefined && spec.value !== null && spec.value !== "") ? `${spec.value}mm` : "-";
                            
                            li.appendChild(labelSpan);
                            li.appendChild(valueSpan);
                            detailSizeList.appendChild(li);
                        });
                        
                        detailInfoSection.style.display = 'flex';
                    } else {
                        detailInfoSection.style.display = 'none';
                    }
                }
            }

            // 이미지 배열 패치 및 스와이프 슬라이더 렌더링
            let paths = data.paths || [];
            if (paths.length === 0 || (paths.length === 1 && !paths[0])) {
                // 이미지가 없거나 첫번째 경로가 비어있을 경우 준비중(ready.webp) 이미지를 대체 노출
                paths = ["/static/img/ready.webp"];
            }

            renderSwipeSlider(paths);
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
        
        // 🏁 퀵 메뉴 장바구니 수량 배지 즉각 갱신
        if (window.updateGlobalCartBadge) {
            window.updateGlobalCartBadge("general");
        }
        
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
        
        // 🏁 브라우저가 배지 갱신 화면을 먼저 그리도록 100ms 지연 후 알림창을 띄움
        setTimeout(() => {
            alert(`'${itemName}' 상품이 장바구니에 담겼습니다.`);
        }, 100);
    }
});
