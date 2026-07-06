document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("searchInput");
    const searchSubmitBtn = document.getElementById("searchSubmitBtn");
    const searchResultGrid = document.getElementById("searchResultGrid");
    const resultCountBar = document.getElementById("resultCountBar");

    // 1. URL 파라미터에서 초기 검색어(q) 추출하여 있으면 바로 검색 실행
    const urlParams = new URLSearchParams(window.location.search);
    const initialQuery = urlParams.get("q") || "";
    
    if (initialQuery.trim()) {
        searchInput.value = initialQuery;
        performSearch(initialQuery);
    }

    // 2. 검색 실행 핵심 함수
    function performSearch(query) {
        const cleanQuery = query.trim();
        if (!cleanQuery) {
            resultCountBar.textContent = "검색어를 입력해 주세요.";
            searchResultGrid.innerHTML = '<p class="search-empty-msg">검색어를 입력해 주세요.</p>';
            return;
        }

        // 검색 도중 표시 피드백
        resultCountBar.textContent = `"${cleanQuery}" 검색 중...`;
        searchResultGrid.innerHTML = '<p class="search-empty-msg">검색 중입니다. 잠시만 기다려 주세요...</p>';

        fetch(`/api/items/search?q=${encodeURIComponent(cleanQuery)}`)
            .then(response => response.json())
            .then(data => {
                const items = data.items || [];
                renderSearchResults(items, cleanQuery);
            })
            .catch(error => {
                console.error("검색 중 오류가 발생했습니다:", error);
                resultCountBar.textContent = "검색 중 오류 발생";
                searchResultGrid.innerHTML = '<p class="search-empty-msg">검색 도중 통신 오류가 발생했습니다. 다시 시도해 주세요.</p>';
            });
    }

    // 3. 상품 격자판 그리기 함수 (기존 itemList.js UI 상속 및 복제)
    function renderSearchResults(items, query) {
        searchResultGrid.innerHTML = ""; // 초기화

        if (items.length === 0) {
            resultCountBar.textContent = `"${query}"에 대한 검색 결과가 없습니다.`;
            searchResultGrid.innerHTML = '<p class="search-empty-msg">검색 조건에 맞는 상품을 찾지 못했습니다.</p>';
            return;
        }

        resultCountBar.textContent = `"${query}" 검색 결과 (${items.length}개)`;

        items.forEach(item => {
            // 카테고리 전용 아이템 카드(사진+하단텍스트) 컨테이너 생성
            const card = document.createElement("article");
            card.className = "category-item-card";

            // 이미지 래퍼 (정사각형 1:1 비율 세팅 구역)
            const imgWrapper = document.createElement("div");
            imgWrapper.className = "category-image-wrapper";
            imgWrapper.addEventListener("click", () => {
                location.href = `/item/${item.id}`;
            });

            // 썸네일 이미지 태그
            const img = document.createElement("img");
            img.src = item.image_url || "/static/img/ready.webp";
            img.className = "category-image";
            img.loading = "lazy";
            imgWrapper.appendChild(img);

            // 미니멀 하단 정보 래퍼
            const infoWrapper = document.createElement("div");
            infoWrapper.className = "category-info-wrapper";

            // 상품명 DOM
            const itemName = document.createElement("h3");
            itemName.className = "category-item-name";
            itemName.textContent = item.name;

            // 가격 DOM
            const itemPrice = document.createElement("p");
            itemPrice.className = "category-item-price";
            itemPrice.textContent = `₩ ${item.price}`;

            infoWrapper.appendChild(itemName);
            infoWrapper.appendChild(itemPrice);
            card.appendChild(imgWrapper);
            card.appendChild(infoWrapper);
            searchResultGrid.appendChild(card);
        });
    }

    // 4. 이벤트 연결: 버튼 클릭 및 엔터 키 입력
    searchSubmitBtn.addEventListener("click", () => {
        const query = searchInput.value;
        updateURLAndSearch(query);
    });

    searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            const query = searchInput.value;
            updateURLAndSearch(query);
        }
    });

    // 주소창 파라미터 갱신 후 검색 실행 (뒤로가기/새로고침 지원용)
    function updateURLAndSearch(query) {
        const cleanQuery = query.trim();
        const newUrl = window.location.pathname + (cleanQuery ? `?q=${encodeURIComponent(cleanQuery)}` : "");
        window.history.pushState({ path: newUrl }, "", newUrl);
        performSearch(cleanQuery);
    }
});
