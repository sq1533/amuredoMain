document.addEventListener("DOMContentLoaded", () => {
    const categoryGrid = document.getElementById("categoryGrid");
    const categoryTitle = document.getElementById("categoryTitle");

    // 경로 파싱 (예: '/sunglasses' 로 접속하면 첫 문자 '/' 제외한 'sunglasses' 획득)
    let currentCategory = window.location.pathname.substring(1).toLowerCase();

    // 혹시라도 뒤에 trailing slash 나 쿼리스트링이 있을 수 있으니 순수 단어만 분리
    currentCategory = currentCategory.split('/')[0];

    // 안전 장치 (알 수 없는 경로 방어)
    if (!currentCategory) {
        currentCategory = "items"; 
    }

    // 대문자로 바꾸어 HTML 상단 타이틀에 삽입 (sunglasses -> Sunglasses)
    categoryTitle.textContent = currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1);

    // ==========================================
    // 백엔드 API 요청 -> 카테고리 데이터 확보 및 필터 동기화
    // ==========================================
    const categoryFilter = document.getElementById("categoryFilter");
    let allFetchedItems = []; // 서버에서 불러온 원본 데이터를 보존할 광주리

    fetch(`/api/items?category=${currentCategory}`)
        .then(response => response.json())
        .then(data => {
            allFetchedItems = data.items || [];
            
            if (allFetchedItems.length > 0) {
                // 1. 유일한(Unique) 하위 카테고리 키워드 추출 (Set)
                const keywords = new Set();
                allFetchedItems.forEach(item => {
                    if (item.category) {
                        keywords.add(item.category);
                    }
                });
                
                // 2. 드롭다운(Select) 옵션 초기화 및 렌더링
                if (categoryFilter) {
                    categoryFilter.innerHTML = '<option value="ALL">전체보기</option>';
                    keywords.forEach(keyword => {
                        const option = document.createElement("option");
                        option.value = keyword;
                        option.textContent = keyword;
                        categoryFilter.appendChild(option);
                    });
                    
                    // 3. 필터 선택 이벤트 바인딩 (클라이언트 사이드 실시간 정렬)
                    categoryFilter.addEventListener('change', (e) => {
                        const selectedValue = e.target.value;
                        if (selectedValue === 'ALL') {
                            renderCategoryItems(allFetchedItems); // 원상복구
                        } else {
                            // 사용자가 고른 키워드(category 문자열)와 동일한 상품만 필터링
                            const filteredItems = allFetchedItems.filter(item => item.category === selectedValue);
                            renderCategoryItems(filteredItems);
                        }
                    });
                }

                // 4. 최초 화면 그리기 (전체보기 상태)
                renderCategoryItems(allFetchedItems);
            } else {
                // 데이터 없는 경우 가이드 제공 및 필터 숨김
                categoryGrid.innerHTML = '<p style="text-align:center; grid-column: 1 / -1; padding: 2rem;">해당 카테고리의 상품 데이터를 찾을 수 없습니다.</p>';
                if(categoryFilter) categoryFilter.parentElement.style.display = 'none'; 
            }
        })
        .catch(error => {
            console.error("아이템 데이터를 불러오는 중 통신 오류 발생:", error);
            categoryGrid.innerHTML = '<p style="text-align:center; grid-column: 1 / -1; padding: 2rem;">데이터를 불러오는 데 실패했습니다.</p>';
        });

    // 화면 그리기 함수 (가격/이름 제거 버전. 오로지 1:1 비율 사진만 사용)
    function renderCategoryItems(items) {
        categoryGrid.innerHTML = ''; // 기본 요소 청소

        items.forEach(item => {
            // 카테고리 전용 아이템 카드(사진+하단텍스트) 컨테이너 생성
            const card = document.createElement('article');
            card.className = 'category-item-card';

            // 이미지 래퍼 (정사각형 1:1 비율 세팅 구역)
            const imgWrapper = document.createElement('div');
            imgWrapper.className = 'category-image-wrapper';
            // 사진 클릭 시 상세페이지 스위치 이동 로직 바인딩
            imgWrapper.addEventListener('click', () => {
                location.href = `/item/${item.id}`;
            });

            // 썸네일 이미지 태그 생성 및 부착
            const img = document.createElement('img');
            img.src = item.image_url; 
            img.className = 'category-image';
            imgWrapper.appendChild(img);

            // 미니멀 하단 텍스트(Minimal Bottom) 정보 래퍼 생성
            const infoWrapper = document.createElement('div');
            infoWrapper.className = 'category-info-wrapper';
            
            // 상품명 DOM (매우 모던하고 얇게)
            const itemName = document.createElement('h3');
            itemName.className = 'category-item-name';
            itemName.textContent = item.name;

            // 가격 DOM (백엔드 쉼표 포맷팅 + 프리미엄 원화 ₩ 감성 부착)
            const itemPrice = document.createElement('p');
            itemPrice.className = 'category-item-price';
            itemPrice.textContent = `₩ ${item.price}`; 

            // 조립: 카드 안에 사진과 하단 정보를 순서대로 밀어넣기
            infoWrapper.appendChild(itemName);
            infoWrapper.appendChild(itemPrice);
            card.appendChild(imgWrapper);
            card.appendChild(infoWrapper);
            categoryGrid.appendChild(card);
        });
    }
});
