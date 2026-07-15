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
            // 모바일 화면(640px 이하)일 경우 무조건 버전 2로 오버라이드하여 렌더링
            const isMobile = window.matchMedia("(max-width: 640px)").matches;
            const activeVersion = isMobile ? 2 : 1; // 1: 기본 UI, 2: 가로 1:1 대칭형

            // 글로벌 공통 컴포넌트 함수를 호출하여 상품 카드 DOM 생성
            const card = createProductCard(item, activeVersion);
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
