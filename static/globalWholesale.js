// 🏁 전역 유틸리티 함수: 금액 포맷팅 (3자리 콤마 + ₩)
window.formatWon = function(num) {
    if (num === undefined || num === null) return "₩ 0";
    return "₩ " + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

// 🏁 전역 유틸리티 함수: 전화번호 하이픈 포맷팅
window.formatPhoneNumber = function(phone) {
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

document.addEventListener("DOMContentLoaded", () => {
    // 🏁 전역 공통 역할 획득 유틸리티
    const getRoleFromCookie = () => {
        const match = document.cookie.match(new RegExp('(^| )amuredo_role=([^;]+)'));
        if (match) {
            return decodeURIComponent(match[2]);
        }
        return "guest"; // 쿠키가 없으면 비로그인(guest)이 기본값
    };

    // 🏁 전역 공통 헤더 주입 로직
    const injectGlobalHeader = () => {
        // 구글 아이콘 폰트 CDN 동적 삽입
        if (!document.getElementById("googleIconFontsCDN")) {
            const link = document.createElement("link");
            link.id = "googleIconFontsCDN";
            link.href = "https://fonts.googleapis.com/icon?family=Material+Icons";
            link.rel = "stylesheet";
            document.head.appendChild(link);
        }

        // 기존 헤더가 있으면 제거 (구식 헤더와의 충돌 방지)
        const existingHeader = document.querySelector(".main-header");
        if (existingHeader) existingHeader.remove();

        const role = getRoleFromCookie();
        let rightNavHTML = "";
        if (role === "wholesale") {
            rightNavHTML = `
                <button class="nav-switch-btn" onclick="location.href='/wholesale/cart'" style="position: relative; display: inline-flex; align-items: center; justify-content: center; padding: 0 4px;" title="Cart"><span class="material-icons" style="font-size: 1.45rem;">local_mall</span><span class="cart-count-badge" id="pcHeaderCartBadge" style="display: none; position: absolute; top: -5px; right: -5px;">0</span></button>
                <button class="nav-switch-btn" onclick="location.href='/wholesale/orders'" style="display: inline-flex; align-items: center; justify-content: center; padding: 0 4px;" title="주문현황"><span class="material-icons" style="font-size: 1.45rem;">receipt_long</span></button>
                <button class="nav-switch-btn" onclick="location.href='/contact'" style="display: inline-flex; align-items: center; justify-content: center; padding: 0 4px;" title="Connect"><span class="material-icons" style="font-size: 1.45rem;">support_agent</span></button>
                <button class="nav-switch-btn globalLogoutBtnTrigger" style="color: #d32f2f; display: inline-flex; align-items: center; justify-content: center; padding: 0 4px;" title="Logout"><span class="material-icons" style="font-size: 1.45rem;">logout</span></button>
            `;
        } else if (role === "general") {
            rightNavHTML = `
                <button class="nav-switch-btn" onclick="location.href='/general/cart'" style="position: relative; display: inline-flex; align-items: center; justify-content: center; padding: 0 4px;" title="Cart"><span class="material-icons" style="font-size: 1.45rem;">local_mall</span><span class="cart-count-badge" id="pcHeaderCartBadge" style="display: none; position: absolute; top: -5px; right: -5px;">0</span></button>
                <button class="nav-switch-btn" onclick="location.href='/general/bookings'" style="display: inline-flex; align-items: center; justify-content: center; padding: 0 4px;" title="예약 확인"><span class="material-icons" style="font-size: 1.45rem;">event_note</span></button>
                <button class="nav-switch-btn" onclick="location.href='/contact'" style="display: inline-flex; align-items: center; justify-content: center; padding: 0 4px;" title="Connect"><span class="material-icons" style="font-size: 1.45rem;">support_agent</span></button>
                <button class="nav-switch-btn globalLogoutBtnTrigger" style="color: #d32f2f; display: inline-flex; align-items: center; justify-content: center; padding: 0 4px;" title="Logout"><span class="material-icons" style="font-size: 1.45rem;">logout</span></button>
            `;
        } else { // guest
            rightNavHTML = `
                <button class="nav-switch-btn" onclick="location.href='/login'" style="display: inline-flex; align-items: center; justify-content: center; padding: 0 4px;" title="Login"><span class="material-icons" style="font-size: 1.45rem;">login</span></button>
                <button class="nav-switch-btn" onclick="location.href='/contact'" style="display: inline-flex; align-items: center; justify-content: center; padding: 0 4px;" title="Connect"><span class="material-icons" style="font-size: 1.45rem;">support_agent</span></button>
            `;
        }

        const headerHTML = `
            <header class="main-header">
                <button class="menu-toggle-btn" id="menuToggleBtn" aria-label="메뉴 열기">
                    <span class="hamburger-box"></span>
                </button>
                <div class="logo-wrapper">
                    <img src="/static/img/logo.png" alt="amuredo Logo" class="logo" style="cursor: pointer;" onclick="location.href='/'">
                </div>
                <nav class="pc-nav-center">
                    <button class="nav-switch-btn" onclick="location.href='/glasses'">Glasses</button>
                    <button class="nav-switch-btn" onclick="location.href='/sunglasses'">Sunwear</button>
                    <button class="nav-switch-btn antioch-nav-btn" onclick="location.href='/antioch'">ANTIOCH</button>
                </nav>
                <nav class="pc-nav-right">
                    ${rightNavHTML}
                </nav>
                <nav class="page-nav" id="pageNav">
                    <button class="close-menu-btn" id="closeMenuBtn" aria-label="메뉴 닫기">✕</button>
                    <ul class="nav-links">
                        <li><button class="nav-switch-btn" onclick="location.href='/glasses'">Glasses</button></li>
                        <li><button class="nav-switch-btn" onclick="location.href='/sunglasses'">Sunwear</button></li>
                        <li><button class="nav-switch-btn antioch-nav-btn" onclick="location.href='/antioch'">ANTIOCH</button></li>
                        <li style="margin-top: 25px; border-top: 1px solid #0e3a5b; padding-top: 15px;">
                            <button class="nav-switch-btn" id="sidebarSearchBtn" style="display: inline-flex; align-items: center; gap: 10px; color: #555; font-weight: 600;">
                                <span class="material-icons" style="font-size: 1.45rem;">search</span>
                                <span>Search</span>
                            </button>
                        </li>
                        <li style="margin-top: 25px; border-top: 1px solid #0e3a5b; padding-top: 15px;">
                            <button class="nav-switch-btn" onclick="location.href='/contact'" style="display: inline-flex; align-items: center; gap: 10px; color: #0e3a5b; font-weight: 700;">
                                <span class="material-icons" style="font-size: 1.4rem;">support_agent</span>
                                <span>Connect</span>
                            </button>
                        </li>
                    </ul>
                </nav>
                <div class="nav-overlay" id="navOverlay"></div>
            </header>
        `;
        document.body.insertAdjacentHTML("afterbegin", headerHTML);
    };

    // 🏁 전역 공통 푸터 주입 로직
    const injectGlobalFooter = () => {
        const existingFooter = document.querySelector(".main-footer");
        if (existingFooter) existingFooter.remove();

        const footerHTML = `
            <footer class="main-footer">
                <hr class="footer-divider">
                <div class="footer-info">
                    <p class="footer-terms-wrap">
                        <a href="/about" class="footer-terms-link">about us</a>
                        <span style="color: #ccc; margin: 0 8px;">|</span>
                        <a href="/static/terms.html" class="footer-terms-link">이용약관</a> 
                        <span style="color: #ccc; margin: 0 8px;">|</span> 
                        <a href="/static/privacy.html" class="footer-terms-link">개인정보처리방침</a>
                    </p>
                    <p>상호명 및 호스트 서비스 제공 : 주식회사 키제이</p>
                    <p>대표 : 서명원 / 연락처 : 070-8064-4598</p>
                    <p>email : amuredo_shop@naver.com</p>
                    <p>서울시 관악구 난곡로 128, 1층</p>
                    <p>사업자 등록 번호 : 257-87-03297</p>
                    <p>통신판매업 신고 : 2026-서울관악-0029</p>
                </div>
            </footer>
        `;
        document.body.insertAdjacentHTML("beforeend", footerHTML);
    };

    injectGlobalHeader();
    injectGlobalFooter();

    const bindMenuEvents = () => {
        const menuBtn = document.getElementById("menuToggleBtn");
        const closeBtn = document.getElementById("closeMenuBtn");
        const pageNav = document.getElementById("pageNav");
        const overlay = document.getElementById("navOverlay");

        if (menuBtn && pageNav && overlay) {
            const toggleMenu = () => {
                pageNav.classList.toggle("open");
                overlay.classList.toggle("active");
            };
            menuBtn.onclick = toggleMenu;
            if (closeBtn) closeBtn.onclick = toggleMenu;
            overlay.onclick = toggleMenu;
        }
    };
    bindMenuEvents();

    const bindScrollHeaderEvent = () => {
        const mainHeader = document.querySelector(".main-header");
        if (mainHeader) {
            window.addEventListener("scroll", () => {
                if (window.scrollY > 50) {
                    mainHeader.classList.add("scrolled");
                } else {
                    mainHeader.classList.remove("scrolled");
                }
            });
            // 초기 스크롤 상태도 확인
            if (window.scrollY > 50) {
                mainHeader.classList.add("scrolled");
            }
        }
    };
    bindScrollHeaderEvent();

    const initGlobalIntersectionObserver = () => {
        const fadeElements = document.querySelectorAll(".fade-in-section");
        if (fadeElements.length > 0) {
            const observer = new IntersectionObserver((entries, obs) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("is-visible");
                        obs.unobserve(entry.target);
                    }
                });
            }, {
                threshold: 0.1
            });
            fadeElements.forEach(el => observer.observe(el));
        }
    };
    initGlobalIntersectionObserver();

    const renderQuickMenu = (role) => {
        // 기존 퀵 메뉴 및 모바일 탭바, 모달창이 있다면 중복 렌더링 방지를 위해 말끔히 청소
        const oldPcMenu = document.getElementById("globalWholesaleMenuContainer");
        if (oldPcMenu) oldPcMenu.remove();
        const oldSearchOverlay = document.getElementById("globalSearchOverlay");
        if (oldSearchOverlay) oldSearchOverlay.remove();
        const oldMobileBar = document.querySelector(".mobile-common-bottom-nav") || document.querySelector(".mobile-wholesale-bottom-nav");
        if (oldMobileBar) oldMobileBar.remove();
        const oldMobileStyle = document.getElementById("mobileBottomNavStyles");
        if (oldMobileStyle) oldMobileStyle.remove();
        const oldLogoutModal = document.getElementById("customGlobalLogoutModal");
        if (oldLogoutModal) oldLogoutModal.remove();

        let mobileNavItemsHTML = "";
        if (role === "general") {
            mobileNavItemsHTML = `
                <a href="/" class="bottom-nav-item">
                    <span class="material-icons">home</span>
                    <span>Home</span>
                </a>
                <a href="/general/cart" class="bottom-nav-item" style="position: relative;">
                    <div class="mobile-cart-icon-wrapper">
                        <span class="material-icons">local_mall</span>
                        <span class="cart-count-badge mobile-cart-badge" id="mobileBottomCartBadge" style="display: none;">0</span>
                    </div>
                    <span>장바구니</span>
                </a>
                <a href="/general/bookings" class="bottom-nav-item">
                    <span class="material-icons">event_note</span>
                    <span>예약현황</span>
                </a>
                <a href="/general/mypage" class="bottom-nav-item">
                    <span class="material-icons">person</span>
                    <span>My Page</span>
                </a>
                <a href="#" class="bottom-nav-item" id="bottomNavTopTrigger">
                    <span class="material-icons">arrow_upward</span>
                    <span>Top</span>
                </a>
            `;
        } else if (role === "wholesale") {
            mobileNavItemsHTML = `
                <a href="/" class="bottom-nav-item">
                    <span class="material-icons">home</span>
                    <span>Home</span>
                </a>
                <a href="/wholesale/cart" class="bottom-nav-item" style="position: relative;">
                    <div class="mobile-cart-icon-wrapper">
                        <span class="material-icons">local_mall</span>
                        <span class="cart-count-badge mobile-cart-badge" id="mobileBottomCartBadge" style="display: none;">0</span>
                    </div>
                    <span>장바구니</span>
                </a>
                <a href="/wholesale/orders" class="bottom-nav-item">
                    <span class="material-icons">receipt_long</span>
                    <span>구매현황</span>
                </a>
                <a href="/wholesale/mypage" class="bottom-nav-item">
                    <span class="material-icons">business</span>
                    <span>My Page</span>
                </a>
                <a href="#" class="bottom-nav-item" id="bottomNavTopTrigger">
                    <span class="material-icons">arrow_upward</span>
                    <span>Top</span>
                </a>
            `;
        } else {
            mobileNavItemsHTML = `
                <a href="/" class="bottom-nav-item">
                    <span class="material-icons">home</span>
                    <span>Home</span>
                </a>
                <a href="/login" class="bottom-nav-item">
                    <span class="material-icons">login</span>
                    <span>로그인</span>
                </a>
                <a href="#" class="bottom-nav-item" id="bottomNavSearchTrigger">
                    <span class="material-icons">search</span>
                    <span>Search</span>
                </a>
                <a href="#" class="bottom-nav-item" id="bottomNavTopTrigger">
                    <span class="material-icons">arrow_upward</span>
                    <span>Top</span>
                </a>
            `;
        }

        const menuHTML = `
            <div id="globalWholesaleMenuContainer" class="pc-only-wholesale-menu floating-quick-menu">
                <button class="quick-btn search-btn" id="quickSearchBtn">검색</button>
                <div class="diagonal-divider"></div>
                <button class="quick-btn top-btn" id="quickTopBtn">TOP</button>
            </div>
            
            <nav class="mobile-common-bottom-nav">
                ${mobileNavItemsHTML}
            </nav>

            <!-- 글로벌 검색 오버레이 패널 (오른쪽 -> 왼쪽 슬라이드인) -->
            <div id="globalSearchOverlay" class="search-overlay">
                <div class="search-panel">
                    <button class="search-close-btn" id="searchCloseBtn">✕</button>
                    <div style="font-size: 1.5rem; font-weight: 800; color: #0e3a5b; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 1px;">Search Gear</div>
                    <div class="search-input-wrapper">
                        <input type="text" id="globalSearchInput" placeholder="검색어를 입력하세요..." autocomplete="off">
                        <button class="search-submit-btn" id="globalSearchSubmitBtn">검색</button>
                    </div>
                </div>
            </div>

            <style id="mobileBottomNavStyles">
                .cart-count-badge {
                    display: none;
                    position: absolute;
                    top: 2px;
                    right: 9px;
                    color: #d9534f;
                    background: transparent !important;
                    border: none !important;
                    font-size: 0.9rem;
                    font-weight: 800;
                    line-height: 1;
                    padding: 0;
                    min-width: auto;
                    height: auto;
                }
                .mobile-cart-icon-wrapper {
                    position: relative;
                    display: inline-block;
                    width: 24px;
                    height: 24px;
                }
                .cart-count-badge.mobile-cart-badge {
                    position: absolute;
                    top: -3px;
                    right: -7px;
                    margin-left: 0;
                    font-size: 0.7rem;
                }
                @media (max-width: 1024px) {
                    .pc-only-wholesale-menu { display: none !important; }
                }
                /* ==========================================================================
                   🌐 GLOBAL NAVIGATION (Mobile Bottom Nav)
                   - PC: 숨김
                   - Wild Mobile & Mobile: 노출
                   ========================================================================== */
                .mobile-common-bottom-nav {
                    display: none;
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    width: 100%;
                    height: 60px;
                    background: rgba(255, 255, 255, 0.9);
                    backdrop-filter: blur(15px);
                    -webkit-backdrop-filter: blur(15px);
                    border-top: 1px solid rgba(0, 0, 0, 0.05);
                    z-index: 10002 !important;
                    justify-content: space-around;
                    align-items: center;
                    padding-bottom: env(safe-area-inset-bottom);
                    box-shadow: 0 -5px 20px rgba(0,0,0,0.05);
                }
                /* 와일드 모바일 & 모바일 환경 하단 메뉴바 노출 */
                @media (max-width: 1024px) {
                    .mobile-common-bottom-nav { display: flex; z-index: 10025; }
                    body { padding-bottom: 70px !important; }
                }
                .bottom-nav-item {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    text-decoration: none;
                    color: #555;
                    gap: 2px;
                    transition: all 0.2s;
                }
                .bottom-nav-item .material-icons {
                    font-size: 1.5rem;
                }
                .bottom-nav-item span:not(.material-icons) {
                    font-size: 0.72rem;
                    font-weight: 700;
                }
                .bottom-nav-item:active {
                    transform: scale(0.95);
                }
                .ws-modal-overlay {
                    display: none; position: fixed; top: 0; left: 0;
                    width: 100%; height: 100%; background: rgba(0,0,0,0.5);
                    z-index: 11000; justify-content: center; align-items: center;
                    backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px);
                }
                .ws-modal-content {
                    background: white; padding: 40px 30px; border-radius: 20px;
                    box-shadow: 0 20px 50px rgba(0,0,0,0.3); width: 320px; text-align: center;
                    transform: translateY(-20px); animation: wsModalFadeIn 0.3s forwards;
                }
                .ws-btn-primary {
                    width: 100%; padding: 15px; background: #0e3a5b; color: white;
                    border: none; border-radius: 10px; font-size: 1.1rem; font-weight: bold;
                    cursor: pointer; transition: all 0.2s;
                }
                .ws-btn-primary:hover { background: #0b2d47; transform: translateY(-2px); }
                @keyframes menuFadeIn {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes wsModalFadeIn {
                    to { opacity: 1; transform: translateY(0); }
                }
            </style>

            <div id="customGlobalLogoutModal" class="ws-modal-overlay">
                <div class="ws-modal-content">
                    <div style="font-size: 2.5rem; margin-bottom: 15px;">👋</div>
                    <div style="font-size: 1.3rem; font-weight: 800; color: #0e3a5b; margin-bottom: 10px;">로그아웃 완료</div>
                    <div style="font-size: 0.95rem; color: #666; margin-bottom: 30px; line-height: 1.5;">안전하게 로그아웃 되었습니다.<br>메인 화면으로 이동합니다.</div>
                    <button id="globalModalConfirmBtn2" class="ws-btn-primary">확인</button>
                </div>
            </div>
        `;

        const appContainer = document.querySelector('.app-container') || document.body;
        appContainer.insertAdjacentHTML("afterbegin", menuHTML);

        // 🏁 퀵 메뉴 및 검색 오버레이 인터랙션 바인딩
        const quickSearchBtn = document.getElementById("quickSearchBtn");
        const quickTopBtn = document.getElementById("quickTopBtn");
        const searchOverlay = document.getElementById("globalSearchOverlay");
        const searchCloseBtn = document.getElementById("searchCloseBtn");
        const searchInput = document.getElementById("globalSearchInput");

        if (quickSearchBtn && searchOverlay && searchInput) {
            quickSearchBtn.onclick = (e) => {
                e.preventDefault();
                searchOverlay.classList.add("active");
                setTimeout(() => searchInput.focus(), 150); // 패널 미끄러져 들어온 뒤 포커싱
            };
        }
        
        // 🏁 모바일 하단 탭바 검색 및 탑 액션 동시 연동
        const bottomSearchBtn = document.getElementById("bottomNavSearchTrigger");
        if (bottomSearchBtn && searchOverlay && searchInput) {
            bottomSearchBtn.onclick = (e) => {
                e.preventDefault();
                searchOverlay.classList.add("active");
                setTimeout(() => searchInput.focus(), 150);
            };
        }

        if (searchCloseBtn && searchOverlay) {
            searchCloseBtn.onclick = () => {
                searchOverlay.classList.remove("active");
            };
            searchOverlay.onclick = (e) => {
                if (e.target === searchOverlay) {
                    searchOverlay.classList.remove("active");
                }
            };
        }

        // 🏁 전역 검색 제출(Submit) 처리 로직
        const globalSearchSubmitBtn = document.getElementById("globalSearchSubmitBtn");
        const executeGlobalSearch = () => {
            const query = searchInput.value.trim();
            if (query) {
                searchOverlay.classList.remove("active");
                location.href = `/search?q=${encodeURIComponent(query)}`;
            } else {
                alert("검색어를 입력해 주세요.");
            }
        };

        if (globalSearchSubmitBtn && searchInput) {
            globalSearchSubmitBtn.onclick = (e) => {
                e.preventDefault();
                executeGlobalSearch();
            };
            searchInput.onkeypress = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    executeGlobalSearch();
                }
            };
        }

        // 🏁 모바일 사이드바 검색 연동
        const sidebarSearchBtn = document.getElementById("sidebarSearchBtn");
        if (sidebarSearchBtn && searchOverlay && searchInput) {
            sidebarSearchBtn.onclick = (e) => {
                e.preventDefault();
                searchOverlay.classList.add("active");
                setTimeout(() => searchInput.focus(), 150);
            };
        }
        if (quickTopBtn) {
            quickTopBtn.onclick = (e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            };
        }
        const bottomTopBtn = document.getElementById("bottomNavTopTrigger");
        if (bottomTopBtn) {
            bottomTopBtn.onclick = (e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            };
        }

        // 🏁 장바구니 초깃값 백업 (Dirty Checking용)
        const backupInitialCart = (role) => {
            if (role === "guest") {
                sessionStorage.removeItem("initialCartState");
                return;
            }
            if (sessionStorage.getItem("initialCartState")) return;
            
            const cookieName = role === "wholesale" ? "wholesale_cart" : "general_cart";
            const match = document.cookie.match(new RegExp('(^| )' + cookieName + '=([^;]+)'));
            let cart = [];
            if (match) {
                try {
                    cart = JSON.parse(decodeURIComponent(match[2]));
                } catch(e) { cart = []; }
            }
            sessionStorage.setItem("initialCartState", JSON.stringify(cart));
        };

        // 로그아웃 이벤트 전동 바인딩
        document.querySelectorAll(".globalLogoutBtnTrigger").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.preventDefault();
                
                const role = getRoleFromCookie();
                const cookieName = role === "wholesale" ? "wholesale_cart" : "general_cart";
                
                // 1. 현재 쿠키 데이터 읽기
                const match = document.cookie.match(new RegExp('(^| )' + cookieName + '=([^;]+)'));
                let currentCart = [];
                if (match) {
                    try {
                        currentCart = JSON.parse(decodeURIComponent(match[2]));
                    } catch(err) { currentCart = []; }
                }
                
                // 2. 백업된 초깃값 읽기
                let initialCart = [];
                const backup = sessionStorage.getItem("initialCartState");
                if (backup) {
                    try {
                        initialCart = JSON.parse(backup);
                    } catch(err) { initialCart = []; }
                }
                
                // 3. Dirty Checking (내용 및 순서 비교)
                const isDirty = JSON.stringify(currentCart) !== JSON.stringify(initialCart);
                
                const performLogout = () => {
                    fetch('/api/user/logout')
                        .then(res => res.json())
                        .then(logoutData => {
                            if(logoutData.status === 'success') {
                                sessionStorage.removeItem("initialCartState");
                                const modal = document.getElementById('customGlobalLogoutModal');
                                if (modal) {
                                    modal.style.display = 'flex';
                                    document.getElementById('globalModalConfirmBtn2').onclick = () => {
                                        window.location.href = '/';
                                    };
                                } else {
                                    window.location.href = '/';
                                }
                            }
                        });
                };
                
                if (isDirty && role !== "guest") {
                    // 변경사항이 있을 때만 서버에 동기화 API 호출
                    fetch('/api/user/cart/sync', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ cart: currentCart })
                    })
                    .then(res => res.json())
                    .then(syncData => {
                        performLogout();
                    })
                    .catch(err => {
                        console.error("로그아웃 전 장바구니 동기화 실패:", err);
                        performLogout(); // 에러 발생 시에도 안전하게 로그아웃 진행
                    });
                } else {
                    performLogout();
                }
            });
        });
        
        // 초기 로딩 시 즉각 백업 실행
        backupInitialCart(role);
    };

    // 🏁 실시간 장바구니 배지 업데이트 엔진 전역 선언
    window.updateGlobalCartBadge = (role) => {
        if (!role || role === "guest") {
            const pcHeaderBadge = document.getElementById("pcHeaderCartBadge");
            if (pcHeaderBadge) pcHeaderBadge.style.display = "none";
            return;
        }

        const pcBadge = document.getElementById("pcCartBadge");
        const pcHeaderBadge = document.getElementById("pcHeaderCartBadge");
        const mobileBadge = document.getElementById("mobileCartBadge");
        const mobileBottomBadge = document.getElementById("mobileBottomCartBadge");

        const setBadgeText = (count) => {
            if (count > 0) {
                if (pcBadge) {
                    pcBadge.textContent = count;
                    pcBadge.style.display = "inline-flex";
                }
                if (pcHeaderBadge) {
                    pcHeaderBadge.textContent = count;
                    pcHeaderBadge.style.display = "inline-flex";
                }
                if (mobileBadge) {
                    mobileBadge.textContent = count;
                    mobileBadge.style.display = "inline-flex";
                }
                if (mobileBottomBadge) {
                    mobileBottomBadge.textContent = count;
                    mobileBottomBadge.style.display = "inline-flex";
                }
            } else {
                if (pcBadge) pcBadge.style.display = "none";
                if (pcHeaderBadge) pcHeaderBadge.style.display = "none";
                if (mobileBadge) mobileBadge.style.display = "none";
                if (mobileBottomBadge) mobileBottomBadge.style.display = "none";
            }
        };

        // Step 1. 로컬 쿠키 장바구니 개수로 1차 선제 렌더링
        const cookieName = role === "wholesale" ? "wholesale_cart" : "general_cart";
        const match = document.cookie.match(new RegExp('(^| )' + cookieName + '=([^;]+)'));
        let count = 0;
        if (match) {
            try {
                const cart = JSON.parse(decodeURIComponent(match[2]));
                count = Array.isArray(cart) ? cart.length : 0;
            } catch (e) {
                count = 0;
            }
        }
        setBadgeText(count);

        // Step 2. 백그라운드 비동기 통신을 통해 Realtime DB 최신본 패치 및 로컬 캐시/배지 갱신
        fetch("/api/user/cart/load")
            .then(res => res.json())
            .then(data => {
                if (data.status === "success" && Array.isArray(data.cart)) {
                    const latestCount = data.cart.length;
                    setBadgeText(latestCount);
                    // 로컬 쿠키 동기화
                    document.cookie = `${cookieName}=${encodeURIComponent(JSON.stringify(data.cart))}; path=/; max-age=2592000`;
                }
            })
            .catch(err => {
                console.error("실시간 장바구니 데이터 로드 실패:", err);
            });
    };

    // 1단계: 쿠키 값 기준으로 지연 없이 즉각 선제 렌더링
    const initialRole = getRoleFromCookie();
    renderQuickMenu(initialRole);
    reorganizeMobileMenu(initialRole === "wholesale");
    window.updateGlobalCartBadge(initialRole);

    // 2단계: 백그라운드 세션 체크 및 불일치 시 UI 보정
    fetch("/api/user/status")
        .then(res => res.json())
        .then(data => {
            const verifiedRole = data.user_role || "guest";
            // 로컬 캐시와 실제 세션 등급이 다르면 정정 렌더링 수행
            if (verifiedRole !== initialRole) {
                // 쿠키 갱신 (유효기간 30일)
                document.cookie = `amuredo_role=${encodeURIComponent(verifiedRole)}; path=/; max-age=2592000`;
                renderQuickMenu(verifiedRole);
                reorganizeMobileMenu(verifiedRole === "wholesale");
                window.updateGlobalCartBadge(verifiedRole);
            } else {
                // 평상시에도 실시간 DB 수량을 체크하여 쿠키/UI 반영
                window.updateGlobalCartBadge(verifiedRole);
            }
        })
        .catch(err => {
            console.error("로그인 상태 백그라운드 확인 오류:", err);
        });

    // 🏁 회원가입 완료 미니멀 팝업 모듈 (이모티콘/버튼 없이 1.5초 노출 후 메인페이지 자동 전환)
    const checkSignupSuccess = () => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('signup') === 'success') {
            const oldModal = document.getElementById("globalSignupSuccessModal");
            if (oldModal) oldModal.remove();

            // 텍스트 정의 및 개행(\n) 반영
            const contentText = "아무래도 안경 회원가입이\n완료되었습니다.";

            // 기존 .ws-modal-overlay 의 display: none 속성이 영향을 주지 않도록 인라인 스타일을 통해 display: flex !important 와 absolute 레이아웃을 강력하게 강제합니다.
            const signupModalHTML = `
                <div id="globalSignupSuccessModal" style="display: flex !important; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.3); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); z-index: 999999 !important; justify-content: center; align-items: center; opacity: 1; transition: opacity 0.4s ease;">
                    <div style="background: #ffffff; padding: 35px 45px; border-radius: 16px; width: 300px; text-align: center; box-shadow: 0 20px 50px rgba(14, 58, 91, 0.15); animation: wsModalFadeIn 0.3s forwards; box-sizing: border-box;">
                        <div style="font-size: 1.25rem; font-weight: 800; color: #0e3a5b; margin-bottom: 14px; text-align: center; letter-spacing: -0.5px;">
                            회원가입 완료
                        </div>
                        <div style="font-size: 0.95rem; color: #555; line-height: 1.6; text-align: center; white-space: pre-line; word-break: keep-all;">${contentText}</div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML("beforeend", signupModalHTML);

            // 1.5초(1500ms) 동안 띄운 후 페이드아웃 효과와 함께 메인페이지(/)로 자동 이동(switch)
            setTimeout(() => {
                const modal = document.getElementById("globalSignupSuccessModal");
                if (modal) {
                    modal.style.opacity = "0";
                    setTimeout(() => {
                        modal.remove();
                        // 🏁 현재 페이지가 이미 메인이면 페이지 리로드 없이 깔끔하게 URL 파라미터만 정리
                        if (window.location.pathname === "/") {
                            window.history.replaceState({}, document.title, "/");
                        } else {
                            window.location.href = "/"; // 메인 페이지로 이동하면서 URL 쿼리 파라미터 완전 정화
                        }
                    }, 400);
                } else {
                    window.location.href = "/";
                }
            }, 1500);
        }
    };
    checkSignupSuccess();

    // 🏁 모바일 메뉴 재구조화 함수 (모든 상품 도매 판매 통합으로 분리 구분선 제거)
    function reorganizeMobileMenu(isWholesale) {
        const navLinks = document.querySelector(".nav-links");
        if (!navLinks) return;

        // 기존에 추가되었던 도매 구분선 제거
        const oldDivider = navLinks.querySelector(".wholesale-menu-divider");
        if (oldDivider) oldDivider.remove();

        const links = Array.from(navLinks.querySelectorAll("li"));
        let antiochLi = links.find(li => li.innerText.trim().toLowerCase().includes("antioch"));
        
        if (antiochLi) {
            // Antioch 버튼의 스타일을 일반 메뉴와 동일하게 일체화
            const antiochBtn = antiochLi.querySelector("button");
            if (antiochBtn) {
                antiochBtn.style.color = "";
                antiochBtn.style.fontWeight = "";
            }
        }
    }
});
