// 상품 카드 디자인 버전 제어 스위치 (1: 기본 수직 구조, 2: 가로 1:1 대칭 무배경 구조)
const CARD_VERSION = 1;

document.addEventListener("DOMContentLoaded", () => {
    const categoryGrid = document.getElementById("categoryGrid");
    const categoryTitle = document.getElementById("categoryTitle");
    const filterContainer = document.getElementById("filterContainer") || document.querySelector(".filter-container");
    const categoryFilter = document.getElementById("categoryFilter");
    const releaseSortFilter = document.getElementById("releaseSortFilter");

    // 경로 파싱 (예: '/trench' 또는 '/oxford' 접속 시 첫 문자 '/' 제외한 카테고리명 획득)
    let currentCategory = window.location.pathname.substring(1).toLowerCase();
    currentCategory = currentCategory.split('/')[0];

    if (!currentCategory) {
        currentCategory = "items";
    }

    // 대문자로 바꾸어 HTML 상단 타이틀에 삽입 (trench -> Trench, oxford -> Oxford)
    categoryTitle.textContent = currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1);

    // ==========================================
    // 드롭박스(아코디언 패널) 열기/닫기 이벤트 바인딩
    // - 드롭박스 클릭 후 확장된 UI 유지 및 내부 라디오 버튼 자유 클릭 지원
    // ==========================================
    const setupDropboxToggle = (dropboxId, triggerId) => {
        const dropbox = document.getElementById(dropboxId);
        const trigger = document.getElementById(triggerId);
        if (!dropbox || !trigger) return;

        trigger.addEventListener("click", (e) => {
            e.preventDefault();
            const isOpen = dropbox.classList.toggle("open");
            trigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
        });
    };

    setupDropboxToggle("colorFilterDropbox", "colorDropboxTrigger");
    setupDropboxToggle("sortFilterDropbox", "sortDropboxTrigger");

    // ==========================================
    // 필터(컬러) 및 정렬(출시일: 신상품 내림차순 / 출시일 오름차순) 상태 관리
    // ==========================================
    let allFetchedItems = [];
    let selectedColor = "ALL";
    let selectedSort = "newest"; // 디폴트 값: 신상품 (created_at 내림차순)

    // YYYYMMDD 문자열을 비교 가능한 숫자로 변환 (예: "20260602" -> 20260602)
    function parseCreatedAt(val) {
        if (!val) return null;
        const digits = String(val).replace(/\D/g, "");
        if (!digits) return null;
        const num = parseInt(digits, 10);
        return Number.isNaN(num) ? null : num;
    }

    function applyFilterAndSort() {
        // 1. 컬러 필터링
        const filtered = selectedColor === "ALL"
            ? [...allFetchedItems]
            : allFetchedItems.filter(item => item.color && item.color.trim() === selectedColor.trim());

        // 2. 출시일(created_at) 기준 정렬
        filtered.sort((a, b) => {
            const dateA = parseCreatedAt(a.created_at);
            const dateB = parseCreatedAt(b.created_at);

            if (dateA !== null && dateB !== null) {
                return selectedSort === "classic" ? (dateA - dateB) : (dateB - dateA);
            }
            if (dateA !== null && dateB === null) return -1;
            if (dateA === null && dateB !== null) return 1;
            return 0;
        });

        renderCategoryItems(filtered);
    }

    // 출시일 라디오 버튼 변경 이벤트 바인딩
    if (releaseSortFilter) {
        releaseSortFilter.addEventListener("change", (e) => {
            const radio = e.target.closest('input[type="radio"][name="releaseSort"]');
            if (!radio) return;

            selectedSort = radio.value;
            const labels = releaseSortFilter.querySelectorAll(".filter-radio-item");
            labels.forEach(label => {
                const input = label.querySelector('input[type="radio"]');
                label.classList.toggle("active", Boolean(input && input.checked));
            });

            applyFilterAndSort();
        });
    }

    // 컬러 라디오 아이템 생성 헬퍼
    function createColorRadioOption(labelText, value, isChecked) {
        const label = document.createElement("label");
        label.className = isChecked ? "filter-radio-item active" : "filter-radio-item";
        label.setAttribute("data-value", value);

        const input = document.createElement("input");
        input.type = "radio";
        input.name = "colorFilter";
        input.value = value;
        if (isChecked) input.checked = true;

        const mark = document.createElement("span");
        mark.className = "radio-custom-mark";

        const text = document.createElement("span");
        text.className = "radio-label-text";
        text.textContent = labelText;

        label.appendChild(input);
        label.appendChild(mark);
        label.appendChild(text);
        return label;
    }

    // ==========================================
    // 백엔드 API 요청 -> 카테고리 데이터 확보 및 필터/정렬 동기화
    // ==========================================
    fetch(`/api/items?category=${currentCategory}`)
        .then(response => response.json())
        .then(data => {
            allFetchedItems = data.items || [];

            if (allFetchedItems.length > 0) {
                if (filterContainer) filterContainer.style.display = "";

                // 1. 유일한(Unique) 컬러 키워드 추출 (Set)
                const keywords = new Set();
                allFetchedItems.forEach(item => {
                    if (item.color && item.color.trim()) {
                        keywords.add(item.color.trim());
                    }
                });

                // 2. 컬러 라디오 버튼 목록 초기화 및 렌더링
                if (categoryFilter) {
                    categoryFilter.innerHTML = "";
                    categoryFilter.appendChild(createColorRadioOption("all", "ALL", true));

                    keywords.forEach(keyword => {
                        categoryFilter.appendChild(createColorRadioOption(keyword.toLowerCase(), keyword, false));
                    });

                    categoryFilter.addEventListener("change", (e) => {
                        const radio = e.target.closest('input[type="radio"][name="colorFilter"]');
                        if (!radio) return;

                        selectedColor = radio.value;
                        const labels = categoryFilter.querySelectorAll(".filter-radio-item");
                        labels.forEach(label => {
                            const input = label.querySelector('input[type="radio"]');
                            label.classList.toggle("active", Boolean(input && input.checked));
                        });

                        applyFilterAndSort();
                    });
                }

                // 3. URL 파라미터(?filter=...) 확인 및 자동 필터링 적용
                const urlParams = new URLSearchParams(window.location.search);
                const initialFilter = urlParams.get("filter");

                if (initialFilter && categoryFilter) {
                    const cleanFilter = initialFilter.replace(/\s/g, "").toLowerCase();
                    const labels = categoryFilter.querySelectorAll(".filter-radio-item");

                    labels.forEach(label => {
                        const val = label.getAttribute("data-value") || "";
                        const labelText = label.textContent.trim().toLowerCase();

                        if (val.replace(/\s/g, "").toLowerCase() === cleanFilter ||
                            labelText.replace(/\s/g, "") === cleanFilter) {
                            const input = label.querySelector('input[type="radio"]');
                            if (input) {
                                input.checked = true;
                                selectedColor = input.value;
                            }
                            labels.forEach(l => l.classList.remove("active"));
                            label.classList.add("active");
                        }
                    });
                }

                // 4. 초기 필터 + 디폴트 정렬(신상품: created_at 내림차순) 반영하여 렌더링
                applyFilterAndSort();
            } else {
                // Firestore에 해당 카테고리 상품이 없는 경우 별도 안내 페이지(/ready)로 이동
                window.location.replace(`/ready?category=${encodeURIComponent(currentCategory)}`);
            }
        })
        .catch(error => {
            console.error("아이템 데이터를 불러오는 중 통신 오류 발생:", error);
            categoryGrid.innerHTML = '<div class="category-empty-notice">데이터를 불러오는 데 실패했습니다.</div>';
        });

    // 화면 그리기 함수 (글로벌 공통 카드 컴포넌트 호출)
    function renderCategoryItems(items) {
        categoryGrid.innerHTML = "";

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
