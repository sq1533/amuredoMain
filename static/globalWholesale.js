document.addEventListener("DOMContentLoaded", () => {
    // 이미 메뉴가 존재하는지 확인 (중복 렌더링 방지)
    if (document.getElementById("globalWholesaleMenuContainer")) return;

    fetch("/api/user/status")
        .then(res => res.json())
        .then(data => {
            if (data.is_wholesale) {
                // 🏁 1024px 외부 우측 스티키 플로팅 트랙 컨테이너 주입
                const menuHTML = `
                    <div id="globalWholesaleMenuContainer" style="position: absolute; top: 0; left: 50%; margin-left: 530px; height: 100%; z-index: 900; pointer-events: none;">
                        <div class="wholesale-sticky-menu" style="position: sticky; top: 100px; width: 140px; background: #fff; padding: 20px 15px; border-radius: 12px; border: 1px solid #eaeaea; box-shadow: 0 8px 24px rgba(0,0,0,0.08); pointer-events: auto; animation: menuFadeIn 0.5s ease-out forwards;">
                            <div style="font-size: 0.85rem; color: #0e3a5b; font-weight: 800; margin-bottom: 15px; border-bottom: 2px solid #0e3a5b; padding-bottom: 8px; text-align: center; word-break: keep-all;">
                                B2B 파트너
                            </div>
                            <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px;">
                                <li><a href="/wholesale/cart" style="display: block; padding: 10px 5px; background: #f8f9fa; color: #333; text-decoration: none; border-radius: 6px; text-align: center; font-size: 0.9rem; font-weight: 600; transition: background 0.2s;" onmouseover="this.style.background='#e9ecef'" onmouseout="this.style.background='#f8f9fa'">장바구니</a></li>
                                <li><a href="/wholesale/orders" style="display: block; padding: 10px 5px; background: #f8f9fa; color: #333; text-decoration: none; border-radius: 6px; text-align: center; font-size: 0.9rem; font-weight: 600; transition: background 0.2s;" onmouseover="this.style.background='#e9ecef'" onmouseout="this.style.background='#f8f9fa'">주문현황</a></li>
                                <li><a href="/wholesale/mypage" style="display: block; padding: 10px 5px; background: #f8f9fa; color: #333; text-decoration: none; border-radius: 6px; text-align: center; font-size: 0.9rem; font-weight: 600; transition: background 0.2s;" onmouseover="this.style.background='#e9ecef'" onmouseout="this.style.background='#f8f9fa'">마이페이지</a></li>
                                <li><a href="#" id="globalLogoutBtn" style="display: block; padding: 10px 5px; background: #fff1f1; color: #d32f2f; text-decoration: none; border-radius: 6px; text-align: center; font-size: 0.9rem; font-weight: 600; transition: background 0.2s;" onmouseover="this.style.background='#ffe5e5'" onmouseout="this.style.background='#fff1f1'">로그아웃</a></li>
                            </ul>
                        </div>
                    </div>
                    
                    <!-- 🏁 커스텀 로그아웃 팝업 (모달) UI -->
                    <div id="customGlobalLogoutModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; justify-content: center; align-items: center; backdrop-filter: blur(3px);">
                        <div style="background: white; padding: 40px 30px; border-radius: 16px; box-shadow: 0 15px 40px rgba(0,0,0,0.2); width: 320px; text-align: center; transform: translateY(-20px); animation: modalFadeIn 0.3s forwards;">
                            <div style="font-size: 2.5rem; margin-bottom: 15px;">👋</div>
                            <div style="font-size: 1.3rem; font-weight: 800; color: #0e3a5b; margin-bottom: 10px;">로그아웃 완료</div>
                            <div style="font-size: 0.95rem; color: #666; margin-bottom: 30px; line-height: 1.5;">안전하게 로그아웃 되었습니다.<br>메인 화면으로 이동합니다.</div>
                            <button id="globalModalConfirmBtn2" style="width: 100%; padding: 14px; background: #0e3a5b; color: white; border: none; border-radius: 8px; font-size: 1.05rem; font-weight: bold; cursor: pointer; transition: background 0.3s;">확인</button>
                        </div>
                    </div>

                    <style>
                        @keyframes menuFadeIn {
                            from { opacity: 0; transform: translateY(-10px); }
                            to { opacity: 1; transform: translateY(0); }
                        }
                        @keyframes modalFadeIn {
                            to { opacity: 1; transform: translateY(0); }
                        }
                    </style>
                `;

                // .app-container 가 있으면 그 안에, 없으면 body 맨 끝에 주입
                const appContainer = document.querySelector('.app-container') || document.body;
                appContainer.insertAdjacentHTML("afterbegin", menuHTML);

                // [신규] 모바일 드로어에도 퀵 메뉴 주입
                injectMobileQuickMenu();

                // 로그아웃 버튼 이벤트 리스너 바인딩
                const logoutBtn = document.getElementById("globalLogoutBtn");
                if (logoutBtn) {
                    logoutBtn.addEventListener("click", (e) => {
                        e.preventDefault();
                        fetch('/api/user/logout')
                            .then(res => res.json())
                            .then(logoutData => {
                                if(logoutData.status === 'success') {
                                    const modal = document.getElementById('customGlobalLogoutModal');
                                    modal.style.display = 'flex';
                                    
                                    document.getElementById('globalModalConfirmBtn2').addEventListener('click', () => {
                                        window.location.href = '/';
                                    });
                                }
                            })
                            .catch(err => {
                                console.error("로그아웃 오류:", err);
                            });
                    });
                }
            }
        })
        .catch(err => {
            console.error("로그인 상태 확인 오류:", err);
        });

    reorganizeMobileMenu();

    // 🏁 [추가] 모바일 환경에서 PC용 퀵바 숨김 처리
    const hideQuickStyle = document.createElement("style");
    hideQuickStyle.innerHTML = `
        @media (max-width: 1024px) {
            #globalWholesaleMenuContainer { display: none !important; }
        }
    `;
    document.head.appendChild(hideQuickStyle);

    function reorganizeMobileMenu() {
        const navLinks = document.querySelector(".nav-links");
        if (!navLinks) return;

        // 1. Antioch 메뉴 찾기 및 Connect 뒤로 이동
        const links = Array.from(navLinks.querySelectorAll("li"));
        let antiochLi = null;
        let connectLi = null;

        links.forEach(li => {
            const btnText = li.innerText.trim().toLowerCase();
            if (btnText.includes("antioch")) antiochLi = li;
            if (btnText.includes("connect")) connectLi = li;
        });

        if (antiochLi && connectLi) {
            // 도매 섹션 헤더 생성
            const wholesaleHeader = document.createElement("li");
            wholesaleHeader.style.cssText = "margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; margin-bottom: 5px;";
            wholesaleHeader.innerHTML = `<span style="font-size: 0.75rem; color: #999; margin-left: 15px; letter-spacing: 1px; font-weight: 600;">도매</span>`;
            
            // 기존 위치에서 제거 후 Connect 뒤에 삽입
            antiochLi.remove();
            connectLi.after(wholesaleHeader);
            wholesaleHeader.after(antiochLi);
            
            // Antioch 버튼 스타일 살짝 조정 (간격)
            const antiochBtn = antiochLi.querySelector("button");
            if (antiochBtn) antiochBtn.style.marginTop = "0";
        }
    }

    // 로그인 성공 시 호출되어 모바일 퀵 메뉴를 추가로 주입하는 함수
    function injectMobileQuickMenu() {
        const navLinks = document.querySelector(".nav-links");
        if (!navLinks) return;

        // 이미 추가되었는지 확인
        if (document.getElementById("mobileQuickMenuSection")) return;

        // Antioch 메뉴 찾기 (이후에 삽입하기 위함)
        const links = Array.from(navLinks.querySelectorAll("li"));
        let antiochLi = links.find(li => li.innerText.trim().toLowerCase().includes("antioch"));

        if (antiochLi) {
            const quickMenuLi = document.createElement("li");
            quickMenuLi.id = "mobileQuickMenuSection";
            quickMenuLi.style.cssText = "margin-top: 15px; border-top: 1px dashed #eee; padding-top: 20px; padding-bottom: 20px; padding-right: 20px;";
            
            // PC 스타일과 동일한 버튼 UI 구성
            quickMenuLi.innerHTML = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-left: 15px;">
                    <a href="/wholesale/cart" style="display: block; padding: 12px 5px; background: #f8f9fa; color: #333; text-decoration: none; border-radius: 8px; text-align: center; font-size: 0.85rem; font-weight: 700; border: 1px solid #eee;">장바구니</a>
                    <a href="/wholesale/orders" style="display: block; padding: 12px 5px; background: #f8f9fa; color: #333; text-decoration: none; border-radius: 8px; text-align: center; font-size: 0.85rem; font-weight: 700; border: 1px solid #eee;">주문현황</a>
                    <a href="/wholesale/mypage" style="display: block; padding: 12px 5px; background: #f8f9fa; color: #333; text-decoration: none; border-radius: 8px; text-align: center; font-size: 0.85rem; font-weight: 700; border: 1px solid #eee;">마이페이지</a>
                    <a href="#" id="mobileLogoutBtn" style="display: block; padding: 12px 5px; background: #fff1f1; color: #d32f2f; text-decoration: none; border-radius: 8px; text-align: center; font-size: 0.85rem; font-weight: 700; border: 1px solid #ffe5e5;">로그아웃</a>
                </div>
            `;
            antiochLi.after(quickMenuLi);

            // 모바일 로그아웃 버튼 이벤트 바인딩
            const mobLogout = document.getElementById("mobileLogoutBtn");
            if (mobLogout) {
                mobLogout.addEventListener("click", (e) => {
                    e.preventDefault();
                    // PC 로그아웃 버튼과 동일한 모달 로직 트리거
                    const pcLogoutBtn = document.getElementById("globalLogoutBtn");
                    if (pcLogoutBtn) pcLogoutBtn.click();
                });
            }
        }
    }
});
