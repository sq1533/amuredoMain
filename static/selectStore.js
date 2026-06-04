document.addEventListener("DOMContentLoaded", () => {
    // 🏁 URL 파라미터 파싱
    const urlParams = new URLSearchParams(window.location.search);
    const itemsParam = urlParams.get("items") || "";

    // 🏁 탭 전환 제어
    const tabVisitBtn = document.getElementById("tabVisitBtn");
    const tabStoreBtn = document.getElementById("tabStoreBtn");
    const panelVisit = document.getElementById("panelVisit");
    const panelStore = document.getElementById("panelStore");

    tabVisitBtn.addEventListener("click", () => {
        tabVisitBtn.classList.add("active");
        tabStoreBtn.classList.remove("active");
        panelVisit.classList.add("active");
        panelStore.classList.remove("active");
    });

    tabStoreBtn.addEventListener("click", () => {
        tabStoreBtn.classList.add("active");
        tabVisitBtn.classList.remove("active");
        panelStore.classList.add("active");
        panelVisit.classList.remove("active");
        // 안경점 탭 로드 시 파트너 안경점 목록 최초 불러오기 실행
        if (allPartners.length === 0) {
            fetchPartners();
        }
    });

    // =========================================================================
    // 📅 탭 1: 희망 장소와 시간 선택 (본사 방문 피팅) 코어 로직
    // =========================================================================
    const calendarMonthYear = document.getElementById("calendarMonthYear");
    const calendarGrid = document.getElementById("calendarGrid");
    const timeExpander = document.getElementById("timeExpander");
    const timeGrid = document.getElementById("timeGrid");
    const visitSliderTrack = document.getElementById("visitSliderTrack");
    const btnToLocation = document.getElementById("btnToLocation");
    const btnBackToDateTime = document.getElementById("btnBackToDateTime");
    const addressInput = document.getElementById("addressInput");
    const detailAddressInput = document.getElementById("detailAddressInput");
    const btnConfirmVisit = document.getElementById("btnConfirmVisit");

    let selectedDate = "";
    let selectedTime = "";

    // 1) 2주(14일)짜리 일요일 시작 미니 캘린더 빌더
    function buildCalendar() {
        const today = new Date();
        const startDay = new Date(today);
        
        // 금주의 시작 일요일로 날짜 조정
        const dayOfWeek = today.getDay();
        startDay.setDate(today.getDate() - dayOfWeek);

        // 헤더 월/년 표시 갱신
        calendarMonthYear.textContent = `${today.getFullYear()}년 ${today.getMonth() + 1}월`;

        calendarGrid.innerHTML = "";

        // 총 14일 (2주 분량) 드로잉
        for (let i = 0; i < 14; i++) {
            const current = new Date(startDay);
            current.setDate(startDay.getDate() + i);

            const cell = document.createElement("div");
            cell.className = "calendar-cell";
            cell.textContent = current.getDate();

            // 요일 클래스 부여
            const wDay = current.getDay();
            if (wDay === 0) cell.classList.add("sunday");
            if (wDay === 6) cell.classList.add("saturday");

            // YYYY-MM-DD 형식의 데이터 속성 심기
            const yyyy = current.getFullYear();
            const mm = String(current.getMonth() + 1).padStart(2, '0');
            const dd = String(current.getDate()).padStart(2, '0');
            const dateStr = `${yyyy}-${mm}-${dd}`;
            cell.setAttribute("data-date", dateStr);

            // 오늘 및 오늘 이전 날짜는 비활성화 (당일 예약 불가)
            const checkToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const checkCurrent = new Date(yyyy, current.getMonth(), current.getDate());

            if (checkCurrent <= checkToday) {
                cell.classList.add("disabled");
            }

            // 날짜 클릭 이벤트 바인딩
            cell.addEventListener("click", () => {
                document.querySelectorAll(".calendar-cell").forEach(c => c.classList.remove("selected"));
                cell.classList.add("selected");
                selectedDate = dateStr;
                selectedTime = ""; // 시간 리셋
                btnToLocation.disabled = true;
                
                // 시간 슬롯 불러오기 및 아코디언 오픈
                loadTimeSlots(dateStr);
            });

            calendarGrid.appendChild(cell);
        }
    }

    // 2) 특정 날짜 클릭 시 시간 슬롯 패치 및 아코디언 로직
    function loadTimeSlots(dateStr) {
        timeGrid.innerHTML = '<div style="grid-column: span 4; text-align: center; padding: 15px 0;"><div class="spinner" style="width:20px; height:20px; margin:0 auto;"></div></div>';
        timeExpander.classList.add("open");

        fetch(`/api/payment/visit_schedule?date=${dateStr}`)
            .then(res => res.json())
            .then(data => {
                if (data.status !== "success") throw new Error("스케줄 데이터 로드 실패");
                renderTimeSlots(data.schedule);
            })
            .catch(err => {
                console.error(err);
                timeGrid.innerHTML = '<div style="grid-column: span 4; text-align: center; color: #dc3545; font-size:0.85rem; font-weight:700;">시간 정보를 가져올 수 없습니다.</div>';
            });
    }

    // 시간 포맷의 다음 슬롯 계산 도우미 (ex: "1100" -> "1200")
    function getNextHourSlotStr(timeStr) {
        const val = parseInt(timeStr);
        const nextVal = val + 100;
        return String(nextVal).padStart(4, '0');
    }

    function renderTimeSlots(schedule) {
        timeGrid.innerHTML = "";
        
        // 10:00부터 21:00까지 1시간 단위
        const timeSlots = [
            "1000", "1100", "1200", "1300", "1400", "1500", 
            "1600", "1700", "1800", "1900", "2000", "2100"
        ];

        timeSlots.forEach((slot, index) => {
            const displayTime = `${slot.substring(0, 2)}:${slot.substring(2, 4)}`;
            const cell = document.createElement("div");
            cell.className = "time-cell";
            cell.textContent = displayTime;
            cell.setAttribute("data-time", slot);

            // 해당 슬롯이 예약되었는지 확인
            const isReserved = schedule[slot] && schedule[slot].status === "reserved";
            
            // 2시간 연속 예약이어야 하므로 다음 1시간 뒤 슬롯 상태도 확인
            const nextSlot = getNextHourSlotStr(slot);
            const isNextReserved = schedule[nextSlot] && schedule[nextSlot].status === "reserved";

            if (isReserved || isNextReserved) {
                cell.classList.add("disabled");
                cell.title = "해당 시간대에 이미 예약 일정이 존재합니다.";
            }

            // 클릭 이벤트
            cell.addEventListener("click", () => {
                document.querySelectorAll(".time-cell").forEach(c => {
                    c.classList.remove("active-start", "active-end");
                });
                
                cell.classList.add("active-start");
                selectedTime = slot;

                // 다음 단계 버튼 활성화
                btnToLocation.disabled = false;
            });

            timeGrid.appendChild(cell);
        });
    }

    // 3) 주소 입력 단계 슬라이딩 모션 제어
    btnToLocation.addEventListener("click", () => {
        if (!selectedDate || !selectedTime) return;
        visitSliderTrack.style.transform = "translateX(-50%)"; // 가로 50%만큼 좌측으로 슬라이드 이동
    });

    btnBackToDateTime.addEventListener("click", (e) => {
        e.preventDefault();
        visitSliderTrack.style.transform = "translateX(0)"; // 원복
    });

    // 주소 인풋 변경 감지하여 설정 버튼 활성화 제어
    function validateLocationInputs() {
        const addr = addressInput.value.trim();
        const detail = detailAddressInput.value.trim();
        if (addr && detail) {
            btnConfirmVisit.disabled = false;
        } else {
            btnConfirmVisit.disabled = true;
        }
    }
    detailAddressInput.addEventListener("input", validateLocationInputs);

    // 🏁 카카오 우편번호 서비스 연동
    const btnSearchAddress = document.getElementById("btnSearchAddress");

    function openKakaoPostcode() {
        new daum.Postcode({
            oncomplete: function(data) {
                // 도로명 주소 또는 지번 주소 선택 시 대입
                addressInput.value = data.roadAddress || data.address;
                detailAddressInput.focus();
                validateLocationInputs();
            }
        }).open();
    }

    if (btnSearchAddress) {
        btnSearchAddress.addEventListener("click", openKakaoPostcode);
    }
    addressInput.addEventListener("click", openKakaoPostcode);

    // 4) 설정하기 버튼 클릭 시 예약하기 페이지로 복귀
    btnConfirmVisit.addEventListener("click", (e) => {
        e.preventDefault();
        const addr = addressInput.value.trim();
        const detail = detailAddressInput.value.trim();
        const fullAddress = `${addr} ${detail}`;

        if (!selectedDate || !selectedTime || !fullAddress) return;

        // 최종 선택 파라미터를 들고 reserve.html 로 리다이렉트 복귀
        location.href = `/general/reserve?items=${encodeURIComponent(itemsParam)}&type=visit&date=${selectedDate}&time=${selectedTime}&address=${encodeURIComponent(fullAddress)}`;
    });

    // 캘린더 생성 초기 구동
    buildCalendar();


    // =========================================================================
    // 🏢 탭 2: 원하는 안경점 선택 (파트너 안경점) 코어 로직
    // =========================================================================
    const citySelect = document.getElementById("citySelect");
    const countrySelect = document.getElementById("countrySelect");
    const partnerGrid = document.getElementById("partnerGrid");
    const partnerLoader = document.getElementById("partnerLoader");
    const partnerEmptyState = document.getElementById("partnerEmptyState");
    const resetFilterBtn = document.getElementById("resetFilterBtn");
    const nearStoreBtn = document.getElementById("nearStoreBtn");

    let allPartners = []; // 전체 안경점 원본 데이터

    // 1) 11자리 또는 10자리 번호 하이픈 자동 포맷터
    const formatPhoneNumber = (phone) => {
        if (!phone) return "";
        const clean = phone.toString().replace(/[^0-9]/g, "");
        if (clean.startsWith("02")) {
            if (clean.length === 9) return clean.replace(/(\d{2})(\d{3})(\d{4})/, "$1-$2-$3");
            if (clean.length === 10) return clean.replace(/(\d{2})(\d{4})(\d{4})/, "$1-$2-$3");
        }
        if (clean.length === 10) return clean.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
        if (clean.length === 11) return clean.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
        return phone;
    };

    // 2) 파트너 안경점 카드 목록 렌더링
    const renderPartners = (partners) => {
        partnerGrid.innerHTML = "";

        if (partners.length === 0) {
            partnerGrid.style.display = "none";
            partnerEmptyState.style.display = "block";
            return;
        }

        partnerEmptyState.style.display = "none";
        partnerGrid.style.display = "grid";

        partners.forEach((partner, index) => {
            const formattedPhone = formatPhoneNumber(partner.called);
            const queryAddress = `${partner.city} ${partner.country} ${partner.details} ${partner.name}`;
            const encodedQuery = encodeURIComponent(queryAddress);
            
            const routeUrl = partner.map_url 
                ? partner.map_url 
                : `https://map.naver.com/p/search/${encodedQuery}?c=15,0,0,0,dh`;

            const selectActionHTML = `
                <div class="select-action-area" style="margin-top: 18px; border-top: 1px dashed #eee; padding-top: 15px;">
                    <button class="select-store-btn" 
                            data-id="${partner.id}" 
                            data-name="${partner.name}" 
                            data-address="${partner.city} ${partner.country} ${partner.details}"
                            style="width: 100%; padding: 12px 0; background-color: #0e3a5b; color: #fff; border: 1px solid #0e3a5b; border-radius: 8px; font-weight: 800; font-size: 0.95rem; cursor: pointer; transition: all 0.2s ease;">
                        이 매장 선택하기
                    </button>
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
                        <div class="info-item route-item">
                            <span class="info-icon">🧭</span>
                            <a href="${routeUrl}" target="_blank" class="info-link route-link" title="네이버 지도에서 위치 보기">
                                <span>지도 위치 보기</span>
                                <span class="route-tag">지도 연결</span>
                            </a>
                        </div>
                        ${selectActionHTML}
                    </div>
                </div>
            `;
            partnerGrid.insertAdjacentHTML("beforeend", cardHTML);
        });

        // 🏢 매점 선택 완료 클릭 리스너 바인딩
        document.querySelectorAll(".select-store-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const storeId = e.target.getAttribute("data-id");
                const storeName = e.target.getAttribute("data-name");
                const storeAddress = e.target.getAttribute("data-address");
                
                location.href = `/general/reserve?items=${encodeURIComponent(itemsParam)}&type=store&place_id=${storeId}&place_name=${encodeURIComponent(storeName)}&address=${encodeURIComponent(storeAddress)}`;
            });
            
            // 호버 인터랙션 보정
            btn.addEventListener("mouseenter", (e) => {
                e.target.style.backgroundColor = "#0b2d47";
                e.target.style.borderColor = "#0b2d47";
            });
            btn.addEventListener("mouseleave", (e) => {
                e.target.style.backgroundColor = "#0e3a5b";
                e.target.style.borderColor = "#0e3a5b";
            });
        });
    };

    // 3) 셀렉트 필터 데이터 옵션 이니셜라이징
    const initFilters = () => {
        const cities = [...new Set(allPartners.map(item => item.city).filter(Boolean))].sort();
        citySelect.innerHTML = '<option value="">시/도 전체</option>';
        cities.forEach(city => {
            const option = document.createElement("option");
            option.value = city;
            option.textContent = city;
            citySelect.appendChild(option);
        });
        resetCountryFilter();
    };

    const resetCountryFilter = () => {
        countrySelect.innerHTML = '<option value="">구/군 전체</option>';
        countrySelect.disabled = true;
    };

    const updateCountryFilter = (selectedCity) => {
        if (!selectedCity) {
            resetCountryFilter();
            return;
        }
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

    // 4) DB에서 파트너 리스트 비동기 조회
    const fetchPartners = () => {
        partnerLoader.style.display = "flex";
        partnerGrid.style.display = "none";
        partnerEmptyState.style.display = "none";

        fetch("/api/user/partners")
            .then(res => res.json())
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
                console.error("🔥 파트너 로드 에러:", err);
                partnerLoader.style.display = "none";
                renderPartners([]);
            });
    };

    // -------------------------------------------------------------
    // 🔍 원하는 안경점 찾기 (외부 매장 검색 모달) 제어
    // -------------------------------------------------------------
    const searchStoreModal = document.getElementById("searchStoreModal");
    const closeStoreModal = document.getElementById("closeStoreModal");
    const modalSearchInput = document.getElementById("modalSearchInput");
    const modalSearchBtn = document.getElementById("modalSearchBtn");
    const modalSearchEmptyState = document.getElementById("modalSearchEmptyState");
    const modalSearchLoader = document.getElementById("modalSearchLoader");
    const modalSearchList = document.getElementById("modalSearchList");

    // 모달 열기
    nearStoreBtn.addEventListener("click", () => {
        searchStoreModal.classList.add("open");
        modalSearchInput.focus();
    });

    // 모달 닫기 함수
    const closeModal = () => {
        searchStoreModal.classList.remove("open");
        modalSearchInput.value = "";
        modalSearchList.innerHTML = "";
        modalSearchEmptyState.style.display = "block";
        modalSearchEmptyState.textContent = "동 또는 면 이름을 검색해 주세요. (예: 신림동)";
        modalSearchLoader.style.display = "none";
    };

    closeStoreModal.addEventListener("click", closeModal);
    window.addEventListener("click", (e) => {
        if (e.target === searchStoreModal) {
            closeModal();
        }
    });

    // 외부 안경점 API 검색 수행
    const searchExternalStore = () => {
        const keyword = modalSearchInput.value.trim();
        if (!keyword) {
            alert("검색어를 입력해 주세요.");
            return;
        }

        modalSearchEmptyState.style.display = "none";
        modalSearchList.innerHTML = "";
        modalSearchLoader.style.display = "flex";

        fetch(`/api/payment/search_external_store?keyword=${encodeURIComponent(keyword)}`)
            .then(res => res.json())
            .then(data => {
                modalSearchLoader.style.display = "none";
                if (data.status === "success" && data.stores && data.stores.length > 0) {
                    renderExternalStores(data.stores);
                } else {
                    modalSearchEmptyState.style.display = "block";
                    modalSearchEmptyState.textContent = `"${keyword}"에 대한 검색 결과가 존재하지 않습니다.`;
                }
            })
            .catch(err => {
                console.error("🔥 외부 안경점 검색 에러:", err);
                modalSearchLoader.style.display = "none";
                modalSearchEmptyState.style.display = "block";
                modalSearchEmptyState.textContent = "검색 중 에러가 발생했습니다. 다시 시도해 주세요.";
            });
    };

    // 검색 버튼 및 엔터키 이벤트 바인딩
    modalSearchBtn.addEventListener("click", searchExternalStore);
    modalSearchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            searchExternalStore();
        }
    });

    // 외부 안경점 카드 목록 렌더링
    const renderExternalStores = (stores) => {
        modalSearchList.innerHTML = "";
        stores.forEach(store => {
            const displayAddress = store.road_address_name || store.address_name;
            const displayPhone = store.phone || "전화번호 미등록";
            
            const cardHTML = `
                <div class="modal-result-card">
                    <h4 class="modal-card-title">${store.place_name}</h4>
                    <div class="modal-card-info">
                        <div style="font-size: 0.88rem; color: #666; display: flex; align-items: flex-start; gap: 6px; line-height: 1.4;">
                            <span>📍</span>
                            <span>${displayAddress}</span>
                        </div>
                        <div style="font-size: 0.88rem; color: #666; display: flex; align-items: center; gap: 6px;">
                            <span>📞</span>
                            <span>${displayPhone}</span>
                        </div>
                    </div>
                    <div class="modal-card-buttons">
                        <button class="btn-verify-loc" data-url="${store.place_url}">위치 확인하기</button>
                        <button class="btn-select-store" data-id="${store.id}" data-name="${store.place_name}" data-address="${displayAddress}">선택하기</button>
                    </div>
                </div>
            `;
            modalSearchList.insertAdjacentHTML("beforeend", cardHTML);
        });

        // 위치 확인하기 버튼 클릭 바인딩
        modalSearchList.querySelectorAll(".btn-verify-loc").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const url = e.target.getAttribute("data-url");
                if (url) {
                    window.open(url, "_blank");
                } else {
                    alert("위치 정보 URL이 없습니다.");
                }
            });
        });

        // 선택하기 버튼 클릭 바인딩
        modalSearchList.querySelectorAll(".btn-select-store").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const id = e.target.getAttribute("data-id");
                const name = e.target.getAttribute("data-name");
                const address = e.target.getAttribute("data-address");
                
                location.href = `/general/reserve?items=${encodeURIComponent(itemsParam)}&type=store&place_id=external_${id}&place_name=${encodeURIComponent(name)}&address=${encodeURIComponent(address)}`;
            });
        });
    };

    // 필터 변경 이벤트 바인딩
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
});
