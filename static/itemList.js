// 상품 카드 디자인 버전 제어 스위치 (1: 기본 수직 구조, 2: 가로 1:1 대칭 무배경 구조)
const CARD_VERSION = 1;

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
                // 1. 유일한(Unique) 컬러 키워드 추출 (Set)
                const keywords = new Set();
                allFetchedItems.forEach(item => {
                    if (item.color && item.color.trim()) {
                        keywords.add(item.color.trim());
                    }
                });
                
                // 2. 필터 탭(Tabs) 초기화 및 렌더링
                if (categoryFilter) {
                    categoryFilter.innerHTML = '';
                    
                    // '전체보기(all)' 버튼 생성
                    const allBtn = document.createElement("button");
                    allBtn.className = "filter-tab active";
                    allBtn.textContent = "all";
                    allBtn.setAttribute("data-value", "ALL");
                    categoryFilter.appendChild(allBtn);

                    // 각 키워드별 버튼 생성
                    keywords.forEach(keyword => {
                        const btn = document.createElement("button");
                        btn.className = "filter-tab";
                        btn.textContent = keyword.toLowerCase();
                        btn.setAttribute("data-value", keyword);
                        categoryFilter.appendChild(btn);
                    });
                    
                    // 3. 필터 클릭 이벤트 바인딩
                    categoryFilter.addEventListener('click', (e) => {
                        const target = e.target.closest('.filter-tab');
                        if (!target) return;

                        // 탭 활성화 스타일 전환
                        const tabs = categoryFilter.querySelectorAll('.filter-tab');
                        tabs.forEach(tab => tab.classList.remove('active'));
                        target.classList.add('active');

                        const selectedValue = target.getAttribute('data-value');
                        if (selectedValue === 'ALL') {
                            renderCategoryItems(allFetchedItems);
                        } else {
                            const filteredItems = allFetchedItems.filter(item => 
                                item.color && item.color.trim() === selectedValue.trim()
                            );
                            renderCategoryItems(filteredItems);
                        }
                    });
                }

                // 4. URL 파라미터(?filter=...) 확인 및 자동 필터링 적용
                const urlParams = new URLSearchParams(window.location.search);
                const initialFilter = urlParams.get('filter');
                let filterApplied = false;

                if (initialFilter && categoryFilter) {
                    const tabs = categoryFilter.querySelectorAll('.filter-tab');
                    const cleanFilter = initialFilter.replace(/\s/g, '').toLowerCase(); // 공백 제거 후 비교용

                    tabs.forEach(tab => {
                        const val = tab.getAttribute('data-value') || "";
                        const tabText = tab.textContent.trim().toLowerCase();
                        
                        // 데이터 값 또는 텍스트에서 공백을 제거하고 비교하여 매칭 확률을 극대화
                        if (val.replace(/\s/g, '').toLowerCase() === cleanFilter || 
                            tabText.replace(/\s/g, '') === cleanFilter) {
                            
                            // 탭 활성화 스타일 수동 적용 후 클릭 이벤트 발생
                            tabs.forEach(t => t.classList.remove('active'));
                            tab.classList.add('active');
                            
                            const selectedValue = tab.getAttribute('data-value');
                            if (selectedValue === 'ALL') {
                                renderCategoryItems(allFetchedItems);
                            } else {
                                const filteredItems = allFetchedItems.filter(item => 
                                    item.color && item.color.trim() === selectedValue.trim()
                                );
                                renderCategoryItems(filteredItems);
                            }
                            filterApplied = true;
                        }
                    });
                }

                // 매칭된 필터가 없거나 파라미터가 없는 경우 기본 전체 상품 노출
                if (!filterApplied) {
                    renderCategoryItems(allFetchedItems);
                }
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

    // 화면 그리기 함수 (글로벌 공통 카드 컴포넌트 호출)
    function renderCategoryItems(items) {
        categoryGrid.innerHTML = ''; // 기본 요소 청소

        items.forEach(item => {
            // 모바일 화면(640px 이하)일 경우 무조건 버전 2로 오버라이드하여 렌더링
            const isMobile = window.matchMedia("(max-width: 640px)").matches;
            const activeVersion = isMobile ? 2 : CARD_VERSION;

            // 글로벌 공통 컴포넌트 함수를 호출하여 상품 카드 DOM 생성
            const card = createProductCard(item, activeVersion);
            categoryGrid.appendChild(card);
        });
    }
});
