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

    // 이미 메뉴 컨테이너가 존재하는지 확인 (중복 렌더링 방지)
    if (document.getElementById("globalWholesaleMenuContainer")) return;

    fetch("/api/user/status")
        .then(res => res.json())
        .then(data => {
            if (data.is_wholesale) {
                // 1. PC용 우측 퀵 메뉴 주입 (기존 유지)
                const menuHTML = `
                    <div id="globalWholesaleMenuContainer" class="pc-only-wholesale-menu" style="position: absolute; top: 0; left: 50%; margin-left: 530px; height: 100%; z-index: 900; pointer-events: none;">
                        <div class="wholesale-sticky-menu" style="position: sticky; top: 100px; width: 140px; background: #fff; padding: 20px 15px; border-radius: 12px; border: 1px solid #eaeaea; box-shadow: 0 8px 24px rgba(0,0,0,0.08); pointer-events: auto; animation: menuFadeIn 0.5s ease-out forwards;">
                            <div style="font-size: 0.85rem; color: #0e3a5b; font-weight: 800; margin-bottom: 15px; border-bottom: 2px solid #0e3a5b; padding-bottom: 8px; text-align: center; word-break: keep-all;">
                                B2B 파트너
                            </div>
                            <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px;">
                                <li><a href="/wholesale/cart" style="display: block; padding: 10px 5px; background: #f8f9fa; color: #333; text-decoration: none; border-radius: 6px; text-align: center; font-size: 0.9rem; font-weight: 600; transition: background 0.2s;" onmouseover="this.style.background='#e9ecef'" onmouseout="this.style.background='#f8f9fa'">장바구니</a></li>
                                <li><a href="/wholesale/orders" style="display: block; padding: 10px 5px; background: #f8f9fa; color: #333; text-decoration: none; border-radius: 6px; text-align: center; font-size: 0.9rem; font-weight: 600; transition: background 0.2s;" onmouseover="this.style.background='#e9ecef'" onmouseout="this.style.background='#f8f9fa'">주문현황</a></li>
                                <li><a href="/wholesale/mypage" style="display: block; padding: 10px 5px; background: #f8f9fa; color: #333; text-decoration: none; border-radius: 6px; text-align: center; font-size: 0.9rem; font-weight: 600; transition: background 0.2s;" onmouseover="this.style.background='#e9ecef'" onmouseout="this.style.background='#f8f9fa'">마이페이지</a></li>
                                <li><a href="#" class="globalLogoutBtnTrigger" style="display: block; padding: 10px 5px; background: #fff1f1; color: #d32f2f; text-decoration: none; border-radius: 6px; text-align: center; font-size: 0.9rem; font-weight: 600; transition: background 0.2s;" onmouseover="this.style.background='#ffe5e5'" onmouseout="this.style.background='#fff1f1'">로그아웃</a></li>
                            </ul>
                        </div>
                    </div>
                    
                    <!-- 2. 모바일용 하단 탭바 주입 -->
                    <nav class="mobile-wholesale-bottom-nav">
                        <a href="/wholesale/cart" class="nav-item">
                            <img src="/static/img/shopping_cart.svg" alt="Cart">
                            <span>장바구니</span>
                        </a>
                        <a href="/wholesale/orders" class="nav-item">
                            <img src="/static/img/order.svg" alt="Orders">
                            <span>주문현황</span>
                        </a>
                        <a href="/wholesale/mypage" class="nav-item">
                            <img src="/static/img/my_page.svg" alt="Mypage">
                            <span>마이페이지</span>
                        </a>
                        <a href="#" class="nav-item globalLogoutBtnTrigger" id="mobileBottomLogoutBtn">
                            <img src="/static/img/logout.svg" alt="Logout">
                            <span style="color: #d32f2f;">로그아웃</span>
                        </a>
                    </nav>

                    <style>
                        /* PC 퀵메뉴 숨김 처리 (모바일 전용 탭바와의 중복 방지) */
                        @media (max-width: 1024px) {
                            .pc-only-wholesale-menu { display: none !important; }
                        }

                        /* 📱 모바일 하단 탭바 스타일 */
                        .mobile-wholesale-bottom-nav {
                            display: none; /* 기본 숨김 */
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
                            padding-bottom: env(safe-area-inset-bottom); /* 아이폰 노치 대응 */
                            box-shadow: 0 -5px 20px rgba(0,0,0,0.05);
                        }

                        @media (max-width: 768px) {
                            .mobile-wholesale-bottom-nav { display: flex; }
                            body { padding-bottom: 80px !important; } /* 탭바 높이만큼 본문 여백 확보 */
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

                        .mobile-wholesale-bottom-nav .nav-item img {
                            width: 24px;
                            height: 24px;
                            opacity: 0.7;
                            transition: opacity 0.2s;
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

                // 로그아웃 이벤트 바인딩 (PC/모바일 공통)
                document.querySelectorAll(".globalLogoutBtnTrigger").forEach(btn => {
                    btn.addEventListener("click", (e) => {
                        e.preventDefault();
                        fetch('/api/user/logout')
                            .then(res => res.json())
                            .then(logoutData => {
                                if(logoutData.status === 'success') {
                                    const modal = document.getElementById('customGlobalLogoutModal');
                                    modal.style.display = 'flex';
                                    document.getElementById('globalModalConfirmBtn2').onclick = () => {
                                        window.location.href = '/';
                                    };
                                }
                            });
                    });
                });

                // 사용자 상태 확인 후 메뉴 재구조화 실행
                reorganizeMobileMenu(true); 
            } else {
                // 일반 사용자인 경우에도 메뉴 재구조화 실행
                reorganizeMobileMenu(false);
            }
        })
        .catch(err => {
            console.error("로그인 상태 확인 오류:", err);
        });

    // 🏁 모바일 메뉴 재구조화 함수 (Antioch 이동 및 도매 섹션 처리)
    function reorganizeMobileMenu(isWholesale) {
        const navLinks = document.querySelector(".nav-links");
        if (!navLinks) return;

        const links = Array.from(navLinks.querySelectorAll("li"));
        let antiochLi = links.find(li => li.innerText.trim().toLowerCase().includes("antioch"));
        
        if (antiochLi) {
            // 기존 위치에서 제거
            antiochLi.remove();

            // 도매 섹션 구분선 및 텍스트 생성
            const wholesaleDivider = document.createElement("li");
            wholesaleDivider.className = "wholesale-menu-divider";
            wholesaleDivider.style.cssText = "margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px; margin-bottom: 10px;";
            wholesaleDivider.innerHTML = `
                <span style="font-size: 0.75rem; color: #aaa; margin-left: 10px; font-weight: 700; letter-spacing: 1px;">도매 (WHOLESALE)</span>
            `;

            // 최하단에 순서대로 추가
            navLinks.appendChild(wholesaleDivider);
            navLinks.appendChild(antiochLi);

            // Antioch 버튼 스타일 조정
            const antiochBtn = antiochLi.querySelector("button");
            if (antiochBtn) {
                antiochBtn.style.color = "#0e3a5b";
                antiochBtn.style.fontWeight = "800";
            }
        }
    }
});
