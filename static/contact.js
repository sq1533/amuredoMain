document.addEventListener("DOMContentLoaded", () => {
    const contactForm = document.getElementById("contactForm");
    const emailInput = document.getElementById("email");
    const messageInput = document.getElementById("message");
    const imageInput = document.getElementById("images");
    const consentCheckbox = document.getElementById("consent");
    const submitBtn = document.getElementById("submitBtn");
    const filePreview = document.getElementById("filePreview");

    // [상태 관리] 현재 선택된 파일들을 담는 전용 배열
    let selectedFiles = [];

    // 1. 전송 버튼 제어 (체크박스 및 필수 입력값 기반)
    function updateSubmitBtnState() {
        const isEmailValid = emailInput.value.includes("@"); // 간단한 클라이언트 체크
        if (consentCheckbox.checked && isEmailValid && messageInput.value.trim().length > 0) {
            submitBtn.disabled = false;
        } else {
            submitBtn.disabled = true;
        }
    }

    consentCheckbox.addEventListener("change", updateSubmitBtnState);
    emailInput.addEventListener("input", updateSubmitBtnState);
    messageInput.addEventListener("input", updateSubmitBtnState);

    // 🏁 [신규] 로그인 이메일 자동 삽입 및 예약 수정 템플릿 연동 엔진
    const urlParams = new URLSearchParams(window.location.search);
    const modifyBookingId = urlParams.get("modify_booking");

    fetch("/api/user/status")
        .then(res => res.json())
        .then(data => {
            // 로그인 상태인 경우 이메일 자동 주입 (Auto-fill)
            if (data.user_email) {
                emailInput.value = data.user_email;
                // 이메일이 입력되었으므로 제출 가능 상태 갱신
                updateSubmitBtnState();
            }
            
            // 만약 예약 확인 페이지에서 '예약 수정' 클릭으로 들어온 경우
            if (modifyBookingId) {
                messageInput.value = `[매장 피팅 예약 수정 요청]\n- 예약번호: ${modifyBookingId}\n- 수정 요청 세부 사항 (매장/품목/일정 변경 등):\n  `;
                messageInput.focus();
                
                // 가이드 양식이 채워졌으므로 즉시 폼 활성화 트리거
                updateSubmitBtnState();
            }
        })
        .catch(err => {
            console.error("로그인 상태 로드 실패 (비로그인 모드로 동작):", err);
        });

    // 2. 파일명 리스트 렌더링 함수 (단순 파일명 표시 버전)
    function renderPreviews() {
        filePreview.innerHTML = ""; // 기존 UI 초기화
        
        selectedFiles.forEach((file, index) => {
            const itemWrap = document.createElement("div");
            itemWrap.className = "file-info-item";
            itemWrap.style.display = "flex";
            itemWrap.style.alignItems = "center";
            itemWrap.style.gap = "10px";
            itemWrap.style.marginTop = "8px";
            itemWrap.style.fontSize = "0.9rem";
            itemWrap.style.color = "#555";

            itemWrap.innerHTML = `
                <span class="file-name">${file.name}</span>
                <span class="btn-remove-file" data-index="${index}" style="cursor:pointer; color:#ff4d4d; font-weight:bold;">✕</span>
            `;
            filePreview.appendChild(itemWrap);

            // 삭제 버튼 이벤트 연결
            itemWrap.querySelector(".btn-remove-file").addEventListener("click", () => {
                removeFile(index);
            });
        });
    }

    // 3. 파일 개별 삭제 로직
    function removeFile(index) {
        selectedFiles.splice(index, 1); // 배열에서 해당 인덱스 제거
        renderPreviews(); // 다시 그리기
    }

    // 4. 이미지 파일 추가 이벤트
    imageInput.addEventListener("change", (e) => {
        const newFiles = Array.from(e.target.files);
        const allowedExtensions = ["jpg", "jpeg", "png", "webp"];
        const maxSize = 2 * 1024 * 1024; // 2MB

        for (const file of newFiles) {
            // 5장 제한 체크
            if (selectedFiles.length >= 5) {
                alert("이미지는 최대 5개까지만 첨부할 수 있습니다.");
                break;
            }

            // 확장자 및 크기 검사
            const ext = file.name.split(".").pop().toLowerCase();
            if (!allowedExtensions.includes(ext)) {
                alert(`허용되지 않은 파일 형식입니다: ${file.name}`);
                continue;
            }
            if (file.size > maxSize) {
                alert(`파일 크기가 2MB를 초과합니다: ${file.name}`);
                continue;
            }

            // 모든 통과 시 배열에 추가
            selectedFiles.push(file);
        }

        renderPreviews();
        imageInput.value = ""; // 동일 파일 다시 올리기 가능하도록 인풋 리셋
    });

    // 5. 폼 전송 처리 (AJAX)
    contactForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        // 중복 전송 방지 및 시각적 피드백
        submitBtn.disabled = true;
        const originalText = submitBtn.innerText;
        submitBtn.innerText = "전송 중...";

        const formData = new FormData();
        formData.append("email", emailInput.value);
        formData.append("message", messageInput.value);
        formData.append("consent", consentCheckbox.checked);

        // [핵심] selectedFiles 배열에 담긴 실제 파일을 FormData에 추가
        selectedFiles.forEach(file => {
            formData.append("images", file);
        });

        try {
            const response = await fetch("/api/contact", {
                method: "POST",
                body: formData
            });

            const result = await response.json();

            if (result.status === "success") {
                alert("문의가 성공적으로 전달되었습니다. 감사합니다!");
                contactForm.reset();
                selectedFiles = []; // 상태 초기화
                renderPreviews();
                updateSubmitBtnState();
            } else {
                alert(`전송 실패: ${result.message}`);
                submitBtn.disabled = false;
            }
        } catch (error) {
            console.error("Error submitting form:", error);
            alert("서버 통신 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
            submitBtn.disabled = false;
        } finally {
            submitBtn.innerText = originalText;
        }
    });
});
