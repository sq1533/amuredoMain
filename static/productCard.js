/**
 * amuredo 글로벌 상품 카드 컴포넌트 생성 함수
 * @param {Object} item - 상품 데이터 객체 { id, name, price, image_url }
 * @param {number} cardVersion - 카드 디자인 버전 (1: 기존 수직형, 2: 가로 1:1 대칭형)
 * @returns {HTMLElement} 조립된 상품 카드 DOM 객체 (article)
 */
function createProductCard(item, cardVersion = 1) {
    // 1. 카드 컨테이너 생성
    const card = document.createElement('article');
    card.className = `category-item-card card-version-${cardVersion}`;

    // 2. 이미지 래퍼 생성
    const imgWrapper = document.createElement('div');
    imgWrapper.className = 'category-image-wrapper';
    
    // 이미지 클릭 시 상세페이지 이동 이벤트 연결
    imgWrapper.addEventListener('click', () => {
        location.href = `/item/${item.id}`;
    });

    // 썸네일 이미지 생성 및 부착
    const img = document.createElement('img');
    img.src = item.image_url || "/static/img/ready.webp";
    img.className = 'category-image';
    img.loading = 'lazy'; // 이미지 lazy loading 기본 적용
    imgWrapper.appendChild(img);

    // 3. 텍스트 정보 래퍼 생성
    const infoWrapper = document.createElement('div');
    infoWrapper.className = 'category-info-wrapper';
    
    // 버전 2 가로 배치 구조일 때는 텍스트 카드를 터치/클릭해도 상세페이지로 이동되게 처리
    if (Number(cardVersion) === 2) {
        infoWrapper.style.cursor = 'pointer';
        infoWrapper.addEventListener('click', () => {
            location.href = `/item/${item.id}`;
        });
    }

    // 상품명 엘리먼트 생성 (글로벌 폰트 크기 fs-sm 적용)
    const itemName = document.createElement('h3');
    itemName.className = 'category-item-name fs-sm';
    itemName.textContent = item.name;

    // 가격 엘리먼트 생성 (글로벌 폰트 크기 fs-s 적용)
    const itemPrice = document.createElement('p');
    itemPrice.className = 'category-item-price fs-s';
    itemPrice.textContent = `₩ ${item.price}`;

    // 4. 구조 조립 및 반환
    infoWrapper.appendChild(itemName);
    infoWrapper.appendChild(itemPrice);
    card.appendChild(imgWrapper);
    card.appendChild(infoWrapper);

    return card;
}
