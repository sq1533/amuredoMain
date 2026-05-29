document.addEventListener("DOMContentLoaded", () => {
    // 🏁 DOM 요소 캐싱
    const citySelect = document.getElementById("citySelect");
    const countrySelect = document.getElementById("countrySelect");
    const partnerGrid = document.getElementById("partnerGrid");
    const partnerCount = document.getElementById("partnerCount");
    const partnerLoader = document.getElementById("partnerLoader");
    const partnerEmptyState = document.getElementById("partnerEmptyState");
    const resetFilterBtn = document.getElementById("resetFilterBtn");

    let allPartners = []; // 전체 파트너 매장 데이터 배열

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
                    </div>
                </div>
            `;
            partnerGrid.insertAdjacentHTML("beforeend", cardHTML);
        });
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
