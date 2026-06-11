// 🏁 전역 유틸리티 함수: 금액 포맷팅 (3자리 콤마 + ₩)
window.formatWon = function(num) {
    if (num === undefined || num === null) return "₩ 0";
    return "₩ " + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

document.addEventListener("DOMContentLoaded", () => {
    // 🏁 전역 공통 헤더 주입 로직
    const injectGlobalHeader = () => {
        // 기존 헤더가 있으면 제거 (구식 헤더와의 충돌 방지)
        const existingHeader = document.querySelector(".main-header");
        if (existingHeader) existingHeader.remove();

        const headerHTML = `
            <style id="globalWholesaleStyles">
                /* 🏁 전역 헤더 & 햄버거 메뉴 필수 스타일 */
                .main-header {
                    position: fixed; top: 0; left: 0; width: 100%; height: 70px;
                    background: rgba(255,255,255,0.95); backdrop-filter: blur(10px);
                    display: flex; justify-content: space-between; align-items: center;
                    padding: 0 20px; z-index: 10000 !important; border-bottom: 1px solid #eee;
                }
                .logo { height: 30px; display: block; }
                
                /* PC 네비게이션 */
                .pc-nav-left, .pc-nav-right { display: flex; gap: 20px; align-items: center; }
                .nav-switch-btn { 
                    background: none; border: none; font-size: 0.95rem; font-weight: 600; 
                    color: #333; cursor: pointer; transition: color 0.2s;
                }
                .nav-switch-btn:hover { color: #0e3a5b; }

                /* 햄버거 버튼 (강제 노출 설정) */
                .menu-toggle-btn {
                    display: none; background: none; border: none; cursor: pointer;
                    padding: 10px; z-index: 10005 !important;
                }
                .hamburger-box {
                    display: block; width: 24px; height: 2px; background: #333;
                    position: relative; transition: background 0.3s;
                }
                .hamburger-box::before, .hamburger-box::after {
                    content: ""; position: absolute; width: 24px; height: 2px; background: #333;
                    left: 0; transition: all 0.3s;
                }
                .hamburger-box::before { top: -7px; }
                .hamburger-box::after { top: 7px; }

                /* 모바일 메뉴바 (전체 높이 및 배경 강제) */
                .page-nav {
                    position: fixed; top: 0; right: -100%; width: 280px; height: 100vh !important;
                    background: #ffffff !important; z-index: 10010 !important; 
                    transition: right 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
                    padding: 80px 0 40px 0; /* 좌우 패딩은 nav-links에서 조절 */
                    box-shadow: -10px 0 30px rgba(0,0,0,0.1);
                    overflow-y: auto; /* 메뉴가 길어질 경우 스크롤 허용 */
                    display: block !important;
                }
                .page-nav.open { right: 0 !important; }
                
                .nav-overlay {
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(0,0,0,0.5); z-index: 10008 !important; display: none; opacity: 0; transition: opacity 0.3s;
                }
                .nav-overlay.active { display: block; opacity: 1; }
                
                .close-menu-btn {
                    position: absolute; top: 20px; right: 20px; font-size: 1.8rem;
                    background: none; border: none; cursor: pointer; color: #333;
                    padding: 10px; z-index: 10011;
                }
                .nav-links { 
                    list-style: none; padding: 0 30px; margin: 0; 
                    display: flex; flex-direction: column; gap: 5px; 
                }
                .nav-links li { width: 100%; }
                .nav-links .nav-switch-btn {
                    width: 100%; text-align: left; padding: 15px 10px;
                    font-size: 1.1rem; border-bottom: 1px solid #f5f5f5;
                }

                /* 📱 모바일 반응형 처리 */
                @media (max-width: 768px) {
                    .pc-nav-left, .pc-nav-right { display: none !important; }
                    .menu-toggle-btn { display: block !important; }
                    .logo-wrapper { position: absolute; left: 50%; transform: translateX(-50%); }
                }
            </style>
            <header class="main-header">
                <nav class="pc-nav-left">
                    <button class="nav-switch-btn" onclick="location.href='/about'">About</button>
                    <button class="nav-switch-btn" onclick="location.href='/partners'">Partners</button>
                    <button class="nav-switch-btn" onclick="location.href='/contact'">Connect</button>
                </nav>
                <button class="menu-toggle-btn" id="menuToggleBtn" aria-label="메뉴 열기">
                    <span class="hamburger-box"></span>
                </button>
                <div class="logo-wrapper">
                    <img src="/static/img/logo.png" alt="amuredo Logo" class="logo" style="cursor: pointer;" onclick="location.href='/'">
                </div>
                <nav class="pc-nav-right">
                    <button class="nav-switch-btn" onclick="location.href='/glasses'">Glasses</button>
                    <button class="nav-switch-btn" onclick="location.href='/sunglasses'">Sunwear</button>
                    <button class="nav-switch-btn" onclick="location.href='/antioch'">Antioch</button>
                </nav>
                <nav class="page-nav" id="pageNav">
                    <button class="close-menu-btn" id="closeMenuBtn" aria-label="메뉴 닫기">✕</button>
                    <ul class="nav-links">
                        <li><button class="nav-switch-btn" onclick="location.href='/glasses'">Glasses</button></li>
                        <li><button class="nav-switch-btn" onclick="location.href='/sunglasses'">Sunwear</button></li>
                        <li><button class="nav-switch-btn" onclick="location.href='/antioch'">Antioch</button></li>
                        <li><button class="nav-switch-btn" onclick="location.href='/about'">About</button></li>
                        <li><button class="nav-switch-btn" onclick="location.href='/partners'">Partners</button></li>
                        <li><button class="nav-switch-btn" onclick="location.href='/contact'">Connect</button></li>
                    </ul>
                </nav>
                <div class="nav-overlay" id="navOverlay"></div>
            </header>
        `;
        document.body.insertAdjacentHTML("afterbegin", headerHTML);
    };

    injectGlobalHeader();

    // 🏁 햄버거 메뉴 토글 이벤트 전역 바인딩
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

    // 🏁 하이브리드 캐싱: 로컬 쿠키 검사 후 즉시 선제 렌더링 (깜빡임 제로)
    const getRoleFromCookie = () => {
        const match = document.cookie.match(new RegExp('(^| )amuredo_role=([^;]+)'));
        if (match) {
            return decodeURIComponent(match[2]);
        }
        return "guest"; // 쿠키가 없으면 비로그인(guest)이 기본값
    };

    const renderQuickMenu = (role) => {
        // 기존 퀵 메뉴 및 모바일 탭바, 모달창이 있다면 중복 렌더링 방지를 위해 말끔히 청소
        const oldPcMenu = document.getElementById("globalWholesaleMenuContainer");
        if (oldPcMenu) oldPcMenu.remove();
        const oldMobileBar = document.querySelector(".mobile-wholesale-bottom-nav");
        if (oldMobileBar) oldMobileBar.remove();
        const oldMobileStyle = document.getElementById("mobileBottomNavStyles");
        if (oldMobileStyle) oldMobileStyle.remove();
        const oldLogoutModal = document.getElementById("customGlobalLogoutModal");
        if (oldLogoutModal) oldLogoutModal.remove();

        let menuItemsHTML = "";
        let bottomNavHTML = "";
        let headerTitle = "";

        if (role === "wholesale") {
            headerTitle = "B2B 파트너";
            menuItemsHTML = `
                <li><a href="/wholesale/cart" style="display: block; padding: 10px 5px; background: #f8f9fa; color: #333; text-decoration: none; border-radius: 6px; text-align: center; font-size: 0.9rem; font-weight: 600; transition: background 0.2s;" onmouseover="this.style.background='#e9ecef'" onmouseout="this.style.background='#f8f9fa'">장바구니<span class="cart-count-badge" id="pcCartBadge" style="display: none;">0</span></a></li>
                <li><a href="/wholesale/orders" style="display: block; padding: 10px 5px; background: #f8f9fa; color: #333; text-decoration: none; border-radius: 6px; text-align: center; font-size: 0.9rem; font-weight: 600; transition: background 0.2s;" onmouseover="this.style.background='#e9ecef'" onmouseout="this.style.background='#f8f9fa'">주문현황</a></li>
                <li><a href="/wholesale/mypage" style="display: block; padding: 10px 5px; background: #f8f9fa; color: #333; text-decoration: none; border-radius: 6px; text-align: center; font-size: 0.9rem; font-weight: 600; transition: background 0.2s;" onmouseover="this.style.background='#e9ecef'" onmouseout="this.style.background='#f8f9fa'">마이페이지</a></li>
                <li><a href="/partners" style="display: block; padding: 10px 5px; background: #f8f9fa; color: #333; text-decoration: none; border-radius: 6px; text-align: center; font-size: 0.9rem; font-weight: 600; transition: background 0.2s;" onmouseover="this.style.background='#e9ecef'" onmouseout="this.style.background='#f8f9fa'">파트너 안경점</a></li>
                <li><a href="#" class="globalLogoutBtnTrigger" style="display: block; padding: 10px 5px; background: #fff1f1; color: #d32f2f; text-decoration: none; border-radius: 6px; text-align: center; font-size: 0.9rem; font-weight: 600; transition: background 0.2s;" onmouseover="this.style.background='#ffe5e5'" onmouseout="this.style.background='#fff1f1'">로그아웃</a></li>
            `;
            bottomNavHTML = `
                <a href="/wholesale/cart" class="nav-item">
                    <div class="mobile-cart-icon-wrapper">
                        <img src="/static/img/shopping_cart.svg" alt="Cart" style="width:24px;height:24px;opacity:0.7;display:block;">
                        <span class="cart-count-badge mobile-cart-badge" id="mobileCartBadge" style="display: none;">0</span>
                    </div>
                    <span>장바구니</span>
                </a>
                <a href="/wholesale/orders" class="nav-item">
                    <img src="/static/img/order.svg" alt="Orders" style="width:24px;height:24px;opacity:0.7;">
                    <span>주문현황</span>
                </a>
                <a href="/partners" class="nav-item">
                    <img src="/static/img/partner.svg" alt="Partners" style="width:24px;height:24px;opacity:0.7;">
                    <span>파트너 안경점</span>
                </a>
                <a href="/wholesale/mypage" class="nav-item">
                    <img src="/static/img/my_page.svg" alt="Mypage" style="width:24px;height:24px;opacity:0.7;">
                    <span>마이페이지</span>
                </a>
            `;
        } else if (role === "general") {
            headerTitle = "멤버십";
            menuItemsHTML = `
                <li><a href="/general/cart" style="display: block; padding: 10px 5px; background: #f8f9fa; color: #333; text-decoration: none; border-radius: 6px; text-align: center; font-size: 0.9rem; font-weight: 600; transition: background 0.2s;" onmouseover="this.style.background='#e9ecef'" onmouseout="this.style.background='#f8f9fa'">장바구니<span class="cart-count-badge" id="pcCartBadge" style="display: none;">0</span></a></li>
                <li><a href="/general/bookings" style="display: block; padding: 10px 5px; background: #f8f9fa; color: #333; text-decoration: none; border-radius: 6px; text-align: center; font-size: 0.9rem; font-weight: 600; transition: background 0.2s;" onmouseover="this.style.background='#e9ecef'" onmouseout="this.style.background='#f8f9fa'">예약확인</a></li>
                <li><a href="/general/mypage" style="display: block; padding: 10px 5px; background: #f8f9fa; color: #333; text-decoration: none; border-radius: 6px; text-align: center; font-size: 0.9rem; font-weight: 600; transition: background 0.2s;" onmouseover="this.style.background='#e9ecef'" onmouseout="this.style.background='#f8f9fa'">마이페이지</a></li>
                <li><a href="/partners" style="display: block; padding: 10px 5px; background: #f8f9fa; color: #333; text-decoration: none; border-radius: 6px; text-align: center; font-size: 0.9rem; font-weight: 600; transition: background 0.2s;" onmouseover="this.style.background='#e9ecef'" onmouseout="this.style.background='#f8f9fa'">파트너 안경점</a></li>
                <li><a href="#" class="globalLogoutBtnTrigger" style="display: block; padding: 10px 5px; background: #fff1f1; color: #d32f2f; text-decoration: none; border-radius: 6px; text-align: center; font-size: 0.9rem; font-weight: 600; transition: background 0.2s;" onmouseover="this.style.background='#ffe5e5'" onmouseout="this.style.background='#fff1f1'">로그아웃</a></li>
            `;
            bottomNavHTML = `
                <a href="/general/cart" class="nav-item">
                    <div class="mobile-cart-icon-wrapper">
                        <img src="/static/img/shopping_cart.svg" alt="Cart" style="width:24px;height:24px;opacity:0.7;display:block;">
                        <span class="cart-count-badge mobile-cart-badge" id="mobileCartBadge" style="display: none;">0</span>
                    </div>
                    <span>장바구니</span>
                </a>
                <a href="/general/bookings" class="nav-item">
                    <img src="/static/img/order.svg" alt="Reservations" style="width:24px;height:24px;opacity:0.7;">
                    <span>예약확인</span>
                </a>
                <a href="/partners" class="nav-item">
                    <img src="/static/img/partner.svg" alt="Partners" style="width:24px;height:24px;opacity:0.7;">
                    <span>파트너 안경점</span>
                </a>
                <a href="/general/mypage" class="nav-item">
                    <img src="/static/img/my_page.svg" alt="Mypage" style="width:24px;height:24px;opacity:0.7;">
                    <span>마이페이지</span>
                </a>
            `;
        } else { // guest (비로그인 상태)
            headerTitle = "QUICK MENU";
            menuItemsHTML = `
                <li><a href="/login" style="display: block; padding: 10px 5px; background: #f8f9fa; color: #333; text-decoration: none; border-radius: 6px; text-align: center; font-size: 0.9rem; font-weight: 600; transition: background 0.2s;" onmouseover="this.style.background='#e9ecef'" onmouseout="this.style.background='#f8f9fa'">로그인</a></li>
                <li><a href="/register" style="display: block; padding: 10px 5px; background: #f8f9fa; color: #333; text-decoration: none; border-radius: 6px; text-align: center; font-size: 0.9rem; font-weight: 600; transition: background 0.2s;" onmouseover="this.style.background='#e9ecef'" onmouseout="this.style.background='#f8f9fa'">회원가입</a></li>
                <li><a href="/partners" style="display: block; padding: 10px 5px; background: #f8f9fa; color: #333; text-decoration: none; border-radius: 6px; text-align: center; font-size: 0.9rem; font-weight: 600; transition: background 0.2s;" onmouseover="this.style.background='#e9ecef'" onmouseout="this.style.background='#f8f9fa'">파트너 안경점</a></li>
                <li><a href="/contact" style="display: block; padding: 10px 5px; background: #0e3a5b; color: #fff; text-decoration: none; border-radius: 6px; text-align: center; font-size: 0.9rem; font-weight: 600; transition: background 0.2s;" onmouseover="this.style.background='#0b2d47'" onmouseout="this.style.background='#0e3a5b'">입점 문의</a></li>
            `;
            bottomNavHTML = `
                <a href="/login" class="nav-item">
                    <img src="/static/img/my_page.svg" alt="Login" style="width:24px;height:24px;opacity:0.7;">
                    <span>로그인</span>
                </a>
                <a href="/register" class="nav-item">
                    <img src="/static/img/order.svg" alt="Register" style="width:24px;height:24px;opacity:0.7;">
                    <span>회원가입</span>
                </a>
                <a href="/partners" class="nav-item">
                    <img src="/static/img/partner.svg" alt="Partners" style="width:24px;height:24px;opacity:0.7;">
                    <span>안경점 안내</span>
                </a>
                <a href="/contact" class="nav-item">
                    <img src="/static/img/logout.svg" alt="Contact" style="width:24px;height:24px;opacity:0.7;">
                    <span style="color: #0e3a5b;">입점 문의</span>
                </a>
            `;
        }

        const menuHTML = `
            <div id="globalWholesaleMenuContainer" class="pc-only-wholesale-menu" style="position: absolute; top: 0; left: 50%; margin-left: 530px; height: 100%; z-index: 900; pointer-events: none;">
                <div class="wholesale-sticky-menu" style="position: sticky; top: 100px; width: 140px; background: #fff; padding: 20px 15px; border-radius: 12px; border: 1px solid #eaeaea; box-shadow: 0 8px 24px rgba(0,0,0,0.08); pointer-events: auto; animation: menuFadeIn 0.5s ease-out forwards;">
                    <div style="font-size: 0.85rem; color: #0e3a5b; font-weight: 800; margin-bottom: 15px; border-bottom: 2px solid #0e3a5b; padding-bottom: 8px; text-align: center; word-break: keep-all;">
                        ${headerTitle}
                    </div>
                    <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px;">
                        ${menuItemsHTML}
                    </ul>
                </div>
            </div>
            
            <nav class="mobile-wholesale-bottom-nav">
                ${bottomNavHTML}
            </nav>

            <style id="mobileBottomNavStyles">
                .cart-count-badge {
                    display: none;
                    align-items: center;
                    justify-content: center;
                    background-color: #d9534f;
                    color: #ffffff;
                    font-size: 0.65rem;
                    font-weight: 800;
                    border-radius: 50%;
                    min-width: 15px;
                    height: 15px;
                    padding: 0 3px;
                    box-sizing: border-box;
                    line-height: 1;
                    vertical-align: middle;
                    margin-left: 6px;
                }
                .mobile-cart-icon-wrapper {
                    position: relative;
                    display: inline-block;
                    width: 24px;
                    height: 24px;
                }
                .cart-count-badge.mobile-cart-badge {
                    position: absolute;
                    top: -4px;
                    right: -8px;
                    margin-left: 0;
                }
                @media (max-width: 1024px) {
                    .pc-only-wholesale-menu { display: none !important; }
                }
                .mobile-wholesale-bottom-nav {
                    display: none;
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    width: 100%;
                    height: 70px;
                    background: rgba(255, 255, 255, 0.85);
                    backdrop-filter: blur(15px);
                    -webkit-backdrop-filter: blur(15px);
                    border-top: 1px solid rgba(0, 0, 0, 0.05);
                    z-index: 10002;
                    justify-content: space-around;
                    align-items: center;
                    padding-bottom: env(safe-area-inset-bottom);
                    box-shadow: 0 -5px 20px rgba(0,0,0,0.05);
                }
                @media (max-width: 768px) {
                    .mobile-wholesale-bottom-nav { display: flex; }
                    body { padding-bottom: 80px !important; }
                }
                .mobile-wholesale-bottom-nav .nav-item {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    text-decoration: none;
                    color: #666;
                    gap: 4px;
                    transition: all 0.2s;
                }
                .mobile-wholesale-bottom-nav .nav-item span {
                    font-size: 0.7rem;
                    font-weight: 700;
                }
                .mobile-wholesale-bottom-nav .nav-item:active {
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
            return;
        }

        const pcBadge = document.getElementById("pcCartBadge");
        const mobileBadge = document.getElementById("mobileCartBadge");

        const setBadgeText = (count) => {
            if (count > 0) {
                if (pcBadge) {
                    pcBadge.textContent = count;
                    pcBadge.style.display = "inline-flex";
                }
                if (mobileBadge) {
                    mobileBadge.textContent = count;
                    mobileBadge.style.display = "inline-flex";
                }
            } else {
                if (pcBadge) pcBadge.style.display = "none";
                if (mobileBadge) mobileBadge.style.display = "none";
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

    // 🏁 모바일 메뉴 재구조화 함수 (Antioch 이동 및 도매 섹션 처리)
    function reorganizeMobileMenu(isWholesale) {
        const navLinks = document.querySelector(".nav-links");
        if (!navLinks) return;

        // 기존에 추가되었던 도매 구분선 제거
        const oldDivider = navLinks.querySelector(".wholesale-menu-divider");
        if (oldDivider) oldDivider.remove();

        const links = Array.from(navLinks.querySelectorAll("li"));
        let antiochLi = links.find(li => li.innerText.trim().toLowerCase().includes("antioch"));
        
        if (antiochLi) {
            if (isWholesale) {
                // 도매 회원인 경우 최하단에 구분선과 함께 재배치
                antiochLi.remove();
                const wholesaleDivider = document.createElement("li");
                wholesaleDivider.className = "wholesale-menu-divider";
                wholesaleDivider.style.cssText = "margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px; margin-bottom: 10px;";
                wholesaleDivider.innerHTML = `
                    <span style="font-size: 0.75rem; color: #aaa; margin-left: 10px; font-weight: 700; letter-spacing: 1px;">도매 (WHOLESALE)</span>
                `;
                navLinks.appendChild(wholesaleDivider);
                navLinks.appendChild(antiochLi);

                const antiochBtn = antiochLi.querySelector("button");
                if (antiochBtn) {
                    antiochBtn.style.color = "#0e3a5b";
                    antiochBtn.style.fontWeight = "800";
                }
            } else {
                // 도매 회원이 아닌 경우 일반적인 메뉴 스타일로 리셋
                const antiochBtn = antiochLi.querySelector("button");
                if (antiochBtn) {
                    antiochBtn.style.color = "";
                    antiochBtn.style.fontWeight = "";
                }
            }
        }
    }
});
