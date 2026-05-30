document.addEventListener("DOMContentLoaded", () => {
    // 🏁 DOM 요소 캐싱
    const citySelect = document.getElementById("citySelect");
    const countrySelect = document.getElementById("countrySelect");
    const partnerGrid = document.getElementById("partnerGrid");
    const partnerCount = document.getElementById("partnerCount");
    const partnerLoader = document.getElementById("partnerLoader");
    const partnerEmptyState = document.getElementById("partnerEmptyState");
    const resetFilterBtn = document.getElementById("resetFilterBtn");
    
    // 🏁 선택 모드 동적 전환용 DOM
    const partnerTitle = document.querySelector(".partner-title");
    const partnerSubtitle = document.querySelector(".partner-subtitle");

    let allPartners = []; // 전체 파트너 매장 데이터 배열

    // 🏁 URL 쿼리 파라미터 감지를 통한 하이브리드 예약 장소 선택 스위칭 가동
    const urlParams = new URLSearchParams(window.location.search);
    const isSelectMode = urlParams.get("mode") === "select";
    const itemsParam = urlParams.get("items") || "";

    if (isSelectMode && partnerTitle && partnerSubtitle) {
        partnerTitle.textContent = "예약 장소 선택";
        partnerSubtitle.textContent = "피팅 예약을 진행하실 파트너 안경점을 아래에서 선택해 주세요.";
    }

    // 🏁 11자리 또는 10자리 번호 하이픈 자동 포맷터
    const formatPhoneNumber = (phone) => {
        if (!phone) return "";
        // 숫자만 추출
        const clean = phone.toString().replace(/[^0-9]/g, "");

        // 서울(02) 국번 처리
        if (clean.startsWith("02")) {
            if (clean.length === 9) {
                return clean.replace(/(\d{2})(\d{3})(\d{4})/, "$1-$2-$3");
            } else if (clean.length === 10) {
                return clean.replace(/(\d{2})(\d{4})(\d{4})/, "$1-$2-$3");
            }
        }

        // 일반 3자리 번호 (010, 031, 051 등)
        if (clean.length === 10) {
            return clean.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
        } else if (clean.length === 11) {
            return clean.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
        }

        // 포맷팅 대상이 아니면 원본 그대로 반환
        return phone;
    };

    // 🏁 파트너 카드 목록 렌더링 함수
    const renderPartners = (partners) => {
        partnerGrid.innerHTML = "";
        partnerCount.textContent = partners.length;

        if (partners.length === 0) {
            partnerGrid.style.display = "none";
            partnerEmptyState.style.display = "flex";
            return;
        }

        partnerEmptyState.style.display = "none";
        partnerGrid.style.display = "grid";

        partners.forEach((partner, index) => {
            const formattedPhone = formatPhoneNumber(partner.called);
            
            // 🏁 주소 및 매장명을 결합한 네이버 지도 위치(상세보기) 연동 HTML 구성
            // 만약 DB에 등록된 공식 단축/전용 map_url이 존재하면 이를 우선 노출하고, 없으면 주소+상호명 결합 검색 URL을 폴백(Fallback)으로 연동
            const queryAddress = `${partner.city} ${partner.country} ${partner.details} ${partner.name}`;
            const encodedQuery = encodeURIComponent(queryAddress);
            
            const routeUrl = partner.map_url 
                ? partner.map_url 
                : `https://map.naver.com/p/search/${encodedQuery}?c=15,0,0,0,dh`;
            
            const routeLinkHTML = `
                <div class="info-item route-item">
                    <span class="info-icon">🧭</span>
                    <a href="${routeUrl}" target="_blank" class="info-link route-link" title="네이버 지도에서 위치 보기">
                        <span>지도 위치 보기</span>
                        <span class="route-tag">지도 연결</span>
                    </a>
                </div>
            `;

            // 🏁 선택 모드일 때 매장 선택을 위한 단정하고 예쁜 액션 버튼 동적 추가
            let selectActionHTML = "";
            if (isSelectMode) {
                selectActionHTML = `
                    <div class="select-action-area" style="margin-top: 18px; border-top: 1px dashed #eee; padding-top: 15px;">
                        <button class="select-store-btn" 
                                data-id="${partner.id}" 
                                data-name="${partner.name}" 
                                style="width: 100%; padding: 12px 0; background-color: #0e3a5b; color: #fff; border: 1px solid #0e3a5b; border-radius: 8px; font-weight: 800; font-size: 0.95rem; cursor: pointer; transition: all 0.2s ease;">
                            이 매장 선택하기
                        </button>
                    </div>
                `;
            }

            const cardHTML = `
                <div class="partner-card" style="animation-delay: ${index * 0.05}s;">
                    <div class="card-badge">OFFICIAL STORE</div>
                    <h3 class="card-name">${partner.name}</h3>
                    <div class="card-divider"></div>
                    <div class="card-info">
                        <div class="info-item">
                            <span class="info-icon">📍</span>
                            <span class="info-text">${partner.city} ${partner.country} ${partner.details}</span>
                        </div>
                        <div class="info-item phone-item">
                            <span class="info-icon">📞</span>
                            <a href="tel:${partner.called}" class="info-link tel-link" title="전화걸기">
                                <span>${formattedPhone}</span>
                                <span class="mobile-call-tag">통화 연결</span>
                            </a>
                        </div>
                        ${routeLinkHTML}
                        ${selectActionHTML}
                    </div>
                </div>
            `;
            partnerGrid.insertAdjacentHTML("beforeend", cardHTML);
        });

        // 🏁 선택 모드 클릭 이벤트 리스너 일괄 바인딩 및 복귀 스위칭
        if (isSelectMode) {
            document.querySelectorAll(".select-store-btn").forEach(btn => {
                btn.addEventListener("click", (e) => {
                    const storeId = e.target.getAttribute("data-id");
                    const storeName = e.target.getAttribute("data-name");
                    
                    // 예약 장소 정보(ID, 상호명)를 인코딩하여 예약하기 페이지로 복귀 
                    location.href = `/general/reserve?items=${encodeURIComponent(itemsParam)}&place_id=${storeId}&place_name=${encodeURIComponent(storeName)}`;
                });
                
                // 마우스 호버 효과 보강
                btn.addEventListener("mouseenter", (e) => {
                    e.target.style.backgroundColor = "#0b2d47";
                    e.target.style.borderColor = "#0b2d47";
                });
                btn.addEventListener("mouseleave", (e) => {
                    e.target.style.backgroundColor = "#0e3a5b";
                    e.target.style.borderColor = "#0e3a5b";
                });
            });
        }
    };

    // 🏁 시/도 및 구/군 셀렉트 옵션 바인딩 함수
    const initFilters = () => {
        // 1. 시/도 목록 정렬 후 중복제거 파싱
        const cities = [...new Set(allPartners.map(item => item.city).filter(Boolean))].sort();
        
        citySelect.innerHTML = '<option value="">시/도 전체</option>';
        cities.forEach(city => {
            const option = document.createElement("option");
            option.value = city;
            option.textContent = city;
            citySelect.appendChild(option);
        });

        // 구/군 필터 초기화
        resetCountryFilter();
    };

    const resetCountryFilter = () => {
        countrySelect.innerHTML = '<option value="">구/군 전체</option>';
        countrySelect.disabled = true;
    };

    // 🏁 구/군 필터 데이터 동적 바인딩 함수
    const updateCountryFilter = (selectedCity) => {
        if (!selectedCity) {
            resetCountryFilter();
            return;
        }

        // 해당 시/도에 포함된 구/군 파싱
        const countries = [...new Set(
            allPartners
                .filter(item => item.city === selectedCity)
                .map(item => item.country)
                .filter(Boolean)
        )].sort();

        countrySelect.innerHTML = '<option value="">구/군 전체</option>';
        countries.forEach(country => {
            const option = document.createElement("option");
            option.value = country;
            option.textContent = country;
            countrySelect.appendChild(option);
        });

        countrySelect.disabled = false;
    };

    // 🏁 실시간 필터링 기동 함수
    const filterPartners = () => {
        const selectedCity = citySelect.value;
        const selectedCountry = countrySelect.value;

        let filtered = allPartners;

        if (selectedCity) {
            filtered = filtered.filter(item => item.city === selectedCity);
        }
        if (selectedCountry) {
            filtered = filtered.filter(item => item.country === selectedCountry);
        }

        renderPartners(filtered);
    };

    // 🏁 Firestore 파트너 데이터 비동기 Fetch
    const fetchPartners = () => {
        partnerLoader.style.display = "flex";
        partnerGrid.style.display = "none";
        partnerEmptyState.style.display = "none";

        fetch("/api/user/partners")
            .then(res => {
                if (!res.ok) {
                    throw new Error("네트워크 응답 실패");
                }
                return res.json();
            })
            .then(data => {
                partnerLoader.style.display = "none";
                if (data.status === "success" && data.partners) {
                    allPartners = data.partners;
                    initFilters();
                    renderPartners(allPartners);
                } else {
                    renderPartners([]);
                }
            })
            .catch(err => {
                console.error("🔥 파트너 안경점 로드 오류:", err);
                partnerLoader.style.display = "none";
                renderPartners([]);
            });
    };

    // 🏁 이벤트 리스너 바인딩
    citySelect.addEventListener("change", (e) => {
        const selectedCity = e.target.value;
        updateCountryFilter(selectedCity);
        filterPartners();
    });

    countrySelect.addEventListener("change", filterPartners);

    resetFilterBtn.addEventListener("click", () => {
        citySelect.value = "";
        resetCountryFilter();
        renderPartners(allPartners);
    });

    // 🏁 페이지 로드 즉시 데이터 호출 기동
    fetchPartners();
});
