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

            // 네이버 스마트스토어 외부 전환 버튼 로직
            const naverStoreBtn = document.getElementById("naverStoreBtn");
            if (naverStoreBtn) {
                if (data.naver && data.naver.trim() !== "") {
                    // 데이터가 있으면(True) 화면에 표시하고 클릭 연동
                    naverStoreBtn.style.display = 'inline-block';
                    naverStoreBtn.addEventListener("click", () => {
                        window.open(data.naver, '_blank'); // 파싱받은 외부 주소로 새 창 띄우기
                    });
                } else {
                    // 없으면 버튼 숨김 (방어 코딩)
                    naverStoreBtn.style.display = 'none';
                }
            }

            // 이미지 배열 패치 및 스와이프 슬라이더 렌더링
            const paths = data.paths || [];
            if (paths.length === 0) {
                sliderTrack.innerHTML = '<p style="padding: 2rem;">등록된 이미지가 없습니다.</p>';
                return;
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
                        img.src = item.path;
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
});
