// HTML 문서 전체 로딩(DOM 인식) 후 스크립트 실행
document.addEventListener("DOMContentLoaded", () => {
    
    /* ====================================================
       1. 메인 베스트 상품 탭(Tab) 전환 및 데이터 로딩 로직
       ==================================================== */
    const bestTabs = document.querySelectorAll(".best-tab");
    const bestItemsGrid = document.getElementById("bestItemsGrid");
    const bestHashtags = document.getElementById("bestHashtags");
    const bestMainBanner = document.getElementById("bestMainBanner");
    
    // 탭별 해시태그 정의
    const hashtagData = {
        focus: ["# 초경량 기어", "# 시각 노이즈 차단", "# 12g의 혁신", "# 오피스 셋업"],
        meeting: ["# 프로페셔널", "# 신뢰의 완성", "# 비즈니스 에디션", "# 완벽한 핏"],
        drive: ["# 시야 확보", "# 자외선 차단", "# 필드 워커", "# 야외 활동"],
        holiday: ["# 바캉스 필수", "# 휴가 스타일링", "# 시선 집중", "# 휴일 컬렉션"]
    };

    // 탭별 메인 화보 이미지 매칭
    const bannerImageData = {
        focus: "/static/img/main01.webp",
        meeting: "/static/img/main02.webp",
        drive: "/static/img/main03.webp",
        holiday: "/static/img/main04.webp"
    };

    /**
     * 특정 이벤트 타입의 베스트 아이템을 불러와 렌더링하는 함수
     */
    function loadBestItems(eventType) {
        fetch(`/api/items/best/${eventType}`)
            .then(response => response.json())
            .then(data => {
                const items = data.items || [];
                renderBestGearItems(bestItemsGrid, items);
                
                // 해시태그 업데이트
                if (bestHashtags && hashtagData[eventType]) {
                    bestHashtags.innerHTML = hashtagData[eventType]
                        .map(tag => `<span class="hashtag-text">${tag}</span>`)
                        .join("");
                }

                // 메인 화보 이미지 업데이트
                if (bestMainBanner && bannerImageData[eventType]) {
                    bestMainBanner.src = bannerImageData[eventType];
                }
            })
            .catch(error => console.error(`Best Items(${eventType}) 통신 오류:`, error));
    }

    // 탭 클릭 이벤트 바인딩
    bestTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            // 활성화 스타일 전환
            bestTabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");

            // 데이터 로드
            const eventType = tab.getAttribute("data-event");
            loadBestItems(eventType);
        });
    });

    // 초기 로딩 (Focus 탭 기본 활성화)
    loadBestItems("focus");

    /* ====================================================
       3. 브랜드 채널(About) URL 동적 바인딩 로직
       ==================================================== */
    const naverStoreLink = document.getElementById("naverStoreLink");
    const naverBlogLink = document.getElementById("naverBlogLink");
    const instagramLink = document.getElementById("instagramLink");

    fetch('/api/about')
        .then(response => response.json())
        .then(data => {
            if (data.naverStore) naverStoreLink.href = data.naverStore;
            else naverStoreLink.style.display = 'none';

            if (data.blog) naverBlogLink.href = data.blog;
            else naverBlogLink.style.display = 'none';

            if (data.instargram) instagramLink.href = data.instargram;
            else instagramLink.style.display = 'none';
        })
        .catch(error => console.error("About 정보 로딩 실패:", error));

    /**
     * 상품 리스트를 받아서 가로형 '기어 카드' 레이아웃(이미지 2: 정보 1)으로 렌더링
     */
    function renderBestGearItems(container, items) {
        container.innerHTML = ''; 
        
        // 추천된 대로 상위 3개 아이템만 노출
        const displayItems = items.slice(0, 3);

        displayItems.forEach(item => {
            const card = document.createElement('article');
            card.className = 'best-gear-card';

            // 왼쪽: 이미지 영역 (비중 2)
            const imgSide = document.createElement('div');
            imgSide.className = 'gear-image-side';
            imgSide.addEventListener('click', () => { location.href = `/item/${item.id}`; });
            
            const img = document.createElement('img');
            img.src = item.image_url;
            img.alt = item.name;
            imgSide.appendChild(img);

            // 오른쪽: 정보 영역 (비중 1)
            const infoSide = document.createElement('div');
            infoSide.className = 'gear-info-side';

            const specLabel = document.createElement('span');
            specLabel.className = 'gear-spec-label';
            specLabel.textContent = 'OFFICE GEAR SPEC';

            const nameEl = document.createElement('h3');
            nameEl.className = 'gear-name';
            nameEl.textContent = item.name;
            nameEl.addEventListener('click', () => { location.href = `/item/${item.id}`; });

            // 태그 정보 (소재/특징)
            const tagsWrap = document.createElement('div');
            tagsWrap.className = 'gear-tags';
            const tags = item.category ? item.category.split(',') : ['Premium', 'Lightweight'];
            tags.forEach(tag => {
                const tagSpan = document.createElement('span');
                tagSpan.className = 'gear-tag';
                tagSpan.textContent = `# ${tag.trim()}`;
                tagsWrap.appendChild(tagSpan);
            });

            const priceEl = document.createElement('p');
            priceEl.className = 'gear-price';
            priceEl.textContent = `₩ ${item.price}`;

            const actionBtn = document.createElement('a');
            actionBtn.className = 'gear-action-btn';
            actionBtn.href = `/item/${item.id}`;
            actionBtn.textContent = '장비 상세보기';

            infoSide.appendChild(specLabel);
            infoSide.appendChild(nameEl);
            infoSide.appendChild(tagsWrap);
            infoSide.appendChild(priceEl);
            infoSide.appendChild(actionBtn);

            card.appendChild(imgSide);
            card.appendChild(infoSide);
            container.appendChild(card);
        });
    }



    /* ====================================================
       🏁 5. 피팅 서비스 리뷰(후기) 동적 로딩 및 렌더링 로직
       ==================================================== */
    const reviewsContainer = document.getElementById("reviewsContainer");

    function loadReviews() {
        if (!reviewsContainer) return; // index.html이 아닐 경우 리턴

        fetch("/api/payment/fitting_reviews?limit=30")
            .then(response => response.json())
            .then(data => {
                if (data.status === "success" && data.reviews) {
                    renderReviews(data.reviews);
                    setupSliderLogic();
                } else {
                    renderReviewsEmpty();
                }
            })
            .catch(error => {
                console.error("피팅 후기 로딩 실패:", error);
                renderReviewsEmpty();
            });
    }

    function renderReviews(reviews) {
        reviewsContainer.innerHTML = "";
        
        if (reviews.length === 0) {
            renderReviewsEmpty();
            return;
        }

        reviews.forEach(review => {
            const card = document.createElement("div");
            card.className = "review-card";

            // 별 아이콘 생성
            const starText = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);

            // 날짜 포맷 (YYYY-MM-DD -> YY.MM.DD)
            let displayDate = "";
            if (review.reservedDate) {
                const parts = review.reservedDate.split("-");
                if (parts.length === 3) {
                    displayDate = `${parts[0].slice(-2)}.${parts[1]}.${parts[2]}`;
                } else {
                    displayDate = review.reservedDate;
                }
            }

            // 구매 완료 스티커 이미지 태그
            let stickerHTML = "";
            if (review.is_purchased) {
                stickerHTML = `<span class="material-icons purchase-sticker" title="구매 완료">receipt</span>`;
            }

            card.innerHTML = `
                ${stickerHTML}
                <div class="review-header-info">
                    <span class="review-stars fs-sm">${starText}</span>
                    <span class="review-date fs-s">${displayDate} 피팅</span>
                </div>
                <p class="review-body fs-m">${escapeHTML(review.content || "")}</p>
                <div class="review-footer">
                    <span class="review-author fs-sm">${review.customerName} 고객님</span>
                    <span class="review-badge fs-s">피팅 후기</span>
                </div>
            `;
            reviewsContainer.appendChild(card);
        });
    }

    function setupSliderLogic() {
        const prevBtn = document.getElementById("reviewPrevBtn");
        const nextBtn = document.getElementById("reviewNextBtn");
        if (!prevBtn || !nextBtn) return;

        let currentIdx = 0;

        function updateSlider() {
            const cards = reviewsContainer.querySelectorAll(".review-card");
            const total = cards.length;
            if (total === 0) return;

            // 모든 카드의 3D 클래스 초기화
            cards.forEach(card => {
                card.classList.remove("active", "prev-card", "next-card");
            });

            if (total === 1) {
                cards[0].classList.add("active");
            } else if (total === 2) {
                cards[currentIdx].classList.add("active");
                const nextIdx = (currentIdx + 1) % total;
                cards[nextIdx].classList.add("next-card");
            } else {
                const prevIdx = (currentIdx - 1 + total) % total;
                const nextIdx = (currentIdx + 1) % total;

                cards[currentIdx].classList.add("active");
                cards[prevIdx].classList.add("prev-card");
                cards[nextIdx].classList.add("next-card");
            }
        }

        prevBtn.addEventListener("click", () => {
            const cards = reviewsContainer.querySelectorAll(".review-card");
            const total = cards.length;
            if (total <= 1) return;
            currentIdx = (currentIdx - 1 + total) % total;
            updateSlider();
        });

        nextBtn.addEventListener("click", () => {
            const cards = reviewsContainer.querySelectorAll(".review-card");
            const total = cards.length;
            if (total <= 1) return;
            currentIdx = (currentIdx + 1) % total;
            updateSlider();
        });

        updateSlider();
    }

    function renderReviewsEmpty() {
        if (reviewsContainer) {
            reviewsContainer.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; background: rgba(255, 255, 255, 0.5); border-radius: 16px; border: 1px dashed #ddd; color: #888;">
                    <p style="font-weight: 700; margin-bottom: 5px;">등록된 피팅 후기가 없습니다.</p>
                    <p style="font-size: 0.9rem;">아무래도 안경의 첫 번째 피팅 후기 주인공이 되어보세요!</p>
                </div>
            `;
        }
    }

    function escapeHTML(str) {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // 리뷰 로드 실행
    loadReviews();

    /* ====================================================
       🏁 6. 메인 비디오 배너 반응형 로딩 및 순차 재생 로직
       ==================================================== */
    let currentEnv = null; // 'mo' 또는 'pc'
    let activeVideos = [];
    let activeVideoUrls = [];
    let resizeTimer = null;

    const setupResponsiveBanner = () => {
        const bannerCell = document.querySelector('.banner-cell');
        if (!bannerCell) return;

        const isMobileOrTablet = window.innerWidth <= 1024;
        const env = isMobileOrTablet ? 'mo' : 'pc';

        // 이미 동일한 환경의 비디오가 로딩 중이거나 로드된 경우 리턴 (불필요한 리로드 방지)
        if (currentEnv === env) return;
        currentEnv = env;

        // 비디오 컨테이너 초기화
        const videoContainer = bannerCell.querySelector('.video-container');
        if (!videoContainer) return;
        videoContainer.innerHTML = '';
        activeVideos = [];

        // 이미지 복구 (영상 로딩 중 이미지 보이기)
        const fallbackImg = bannerCell.querySelector('.banner-fallback-img');
        if (fallbackImg) {
            fallbackImg.style.opacity = '1';
            fallbackImg.style.display = 'block';
        }

        const suffix = env === 'mo' ? '_mo' : '_pc';
        activeVideoUrls = [
            `/static/img/00_bn01${suffix}.mp4`,
            `/static/img/00_bn02${suffix}.mp4`,
            `/static/img/00_bn03${suffix}.mp4`
        ];

        let loadedCount = 0;
        const totalVideos = activeVideoUrls.length;

        // 비디오가 모두 로딩(canplay)되었을 때 첫 비디오 재생 및 이미지 페이드아웃
        const onAllVideosLoaded = () => {
            // 이번에 로드된 환경이 여전히 현재 환경과 같은지 최종 확인
            if (currentEnv !== env) return;

            if (fallbackImg) {
                fallbackImg.style.opacity = '0';
                setTimeout(() => {
                    if (currentEnv === env) fallbackImg.style.display = 'none';
                }, 800); // transition 시간만큼 대기 후 숨김
            }
            playVideoSequence(0);
        };

        const playVideoSequence = (index) => {
            if (currentEnv !== env) return;

            activeVideos.forEach((v, idx) => {
                if (idx === index) {
                    v.style.display = 'block';
                    v.currentTime = 0;
                    v.play().catch(err => {
                        console.log("비디오 자동재생 시도 실패:", err);
                    });
                } else {
                    v.style.display = 'none';
                    v.pause();
                }
            });

            const activeVideo = activeVideos[index];
            if (activeVideo) {
                activeVideo.onended = () => {
                    const nextIndex = (index + 1) % totalVideos;
                    playVideoSequence(nextIndex);
                };
            }
        };

        activeVideoUrls.forEach((url, index) => {
            const video = document.createElement('video');
            video.src = url;
            video.muted = true;
            video.playsInline = true;
            video.autoplay = false;
            video.controls = false;
            video.style.display = 'none';
            video.style.width = '100%';
            video.style.height = '100%';
            video.style.objectFit = 'cover';

            // 00_bn03_pc / 00_bn03_mo 비디오는 상단 기준으로 맞춰 안경이 잘려 나가는 것을 방지
            if (index === 2) {
                video.style.objectPosition = 'top center';
            }

            const handleLoad = () => {
                if (video.dataset.loaded) return;
                video.dataset.loaded = 'true';
                loadedCount++;
                if (loadedCount === totalVideos) {
                    onAllVideosLoaded();
                }
            };

            // canplay 및 loadeddata 모두 등록하여 안전하게 확인
            video.addEventListener('canplay', handleLoad);
            video.addEventListener('loadeddata', handleLoad);

            videoContainer.appendChild(video);
            activeVideos.push(video);
            video.load();
        });
    };

    // 초기 실행
    setupResponsiveBanner();

    // 윈도우 리사이즈 이벤트 바인딩 (디바운스 적용하여 과도한 실행 차단)
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            setupResponsiveBanner();
        }, 250);
    });
});
