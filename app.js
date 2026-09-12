// ===================================================
// 우리 반 담벼락 - 백엔드 2 (Google 로그인 & Firestore 연동)
// ===================================================

// Firebase SDK 모듈 불러오기
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

// Firebase 설정 정보
const firebaseConfig = {
  apiKey: "AIzaSyAvfFhBRO3sqECa7eTjl0Y5Y0jivMV4Rx4",
  authDomain: "leo037-8d694.firebaseapp.com",
  projectId: "leo037-8d694",
  storageBucket: "leo037-8d694.firebasestorage.app",
  messagingSenderId: "477865704255",
  appId: "1:477865704255:web:6e4699b890f4202e98f18a"
};

// Firebase, Firestore 및 Auth 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// 현재 로그인한 사용자 및 역할 정보
let currentUser = null;
let currentRole = localStorage.getItem("user_role") || "student"; // 기본값 student, 로컬 캐시 우선 사용

// 로그인 상태 변경 감시 (사용자 역할 확인)
onAuthStateChanged(auth, async function (user) {
  currentUser = user;
  if (user) {
    const savedRole = localStorage.getItem("user_role");
    if (savedRole) {
      currentRole = savedRole;
    }
    try {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        currentRole = userSnap.data().role || currentRole || "student";
      } else {
        await setDoc(userRef, {
          uid: user.uid,
          displayName: user.displayName || "사용자",
          role: currentRole
        }, { merge: true });
      }
      localStorage.setItem("user_role", currentRole);
    } catch (err) {
      console.warn("사용자 역할 Firestore 조회 실패 (로컬 역할 유지):", err);
    }
  } else {
    currentRole = "student";
  }

  renderUserArea();
  render(); // 로그인 사용자와 역할에 따라 삭제 버튼 표시 갱신
});

// --- 메모 목록 ---
let memos = [];

// Firestore의 'memos' 컬렉션을 실시간으로 감시합니다.
// 메모를 불러올 때 작성자의 uid와 글쓴이(userName) 정보를 함께 가져옵니다.
const memosQuery = query(collection(db, "memos"), orderBy("createdAt", "asc"));

onSnapshot(memosQuery, function (snapshot) {
  memos = snapshot.docs.map(function (docSnap) {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      text: data.text,
      createdAt: data.createdAt,
      uid: data.uid || null,                     // 메모를 불러올 때 uid를 함께 가져옵니다
      userName: data.userName || "익명",          // 글쓴이 이름
      role: data.role || "student",
      ...data
    };
  });
  render(); // 데이터가 변경되면 화면을 다시 그립니다.
});


// ===================================================
// 사용자 영역(로그인/로그아웃) 그리기
// ===================================================

function renderUserArea() {
  const userArea = document.getElementById("userArea");
  if (!userArea) return;

  if (currentUser) {
    userArea.innerHTML = "";

    const userSpan = document.createElement("span");
    const roleBadge = currentRole === "teacher"
      ? `<span class="badge teacher">👩‍🏫 교사 (모든 권한)</span>`
      : `<span class="badge student">🧑‍🎓 학생 (본인 생성 전용)</span>`;

    userSpan.innerHTML = `👋 <strong>${escapeHtml(currentUser.displayName || "사용자")}</strong>님 ${roleBadge}`;
    userArea.appendChild(userSpan);

    // 버튼 그룹 (역할 전환 및 로그아웃)
    const btnGroup = document.createElement("div");
    btnGroup.style.display = "flex";
    btnGroup.style.alignItems = "center";
    btnGroup.style.gap = "8px";

    // 실습 테스트용 역할 전환 버튼
    const toggleBtn = document.createElement("button");
    toggleBtn.className = "role-toggle-btn";
    toggleBtn.textContent = currentRole === "teacher" ? "학생으로 전환" : "교사로 전환";
    toggleBtn.title = "실습을 위해 교사/학생 역할을 전환합니다";
    toggleBtn.onclick = async function () {
      const nextRole = currentRole === "teacher" ? "student" : "teacher";
      currentRole = nextRole;
      localStorage.setItem("user_role", nextRole);
      renderUserArea();
      render();

      // Firestore 동기화 (merge: true로 문서가 없어도 안전하게 생성/업데이트)
      try {
        await setDoc(doc(db, "users", currentUser.uid), {
          uid: currentUser.uid,
          displayName: currentUser.displayName || "사용자",
          role: nextRole
        }, { merge: true });
      } catch (err) {
        console.warn("Firestore 역할 저장 실패 (로컬 역할로 정상 동작):", err);
      }
    };
    btnGroup.appendChild(toggleBtn);

    // 교사일 때: 전체 AI 피드백 일괄 생성 버튼
    if (currentRole === "teacher") {
      const batchAiBtn = document.createElement("button");
      batchAiBtn.className = "all-ai-btn";
      batchAiBtn.textContent = "🤖 전체 AI 피드백";
      batchAiBtn.title = "피드백이 없는 메모에 AI 코멘트를 일괄 남깁니다";
      batchAiBtn.onclick = async function () {
        const targetMemos = memos.filter(function (m) { return !m.aiComment; });
        if (targetMemos.length === 0) {
          alert("피드백을 남길 새로운 메모가 없습니다.");
          return;
        }
        batchAiBtn.disabled = true;
        batchAiBtn.textContent = "🤖 작성 중...";
        for (const m of targetMemos) {
          await generateAiComment(m.id);
        }
        batchAiBtn.disabled = false;
        batchAiBtn.textContent = "🤖 전체 AI 피드백";
      };
      btnGroup.appendChild(batchAiBtn);
    }

    const logoutBtn = document.createElement("button");
    logoutBtn.className = "auth-btn logout";
    logoutBtn.textContent = "로그아웃";
    logoutBtn.onclick = async function () {
      try {
        await signOut(auth);
      } catch (err) {
        console.error("로그아웃 오류:", err);
      }
    };
    btnGroup.appendChild(logoutBtn);

    userArea.appendChild(btnGroup);

    // 로그인 상태: 메모 입력창 활성화
    const inputEl = document.getElementById("input");
    if (inputEl) {
      inputEl.disabled = false;
      inputEl.placeholder = "메모를 작성해보세요... (엔터를 누르면 등록)";
    }
  } else {
    userArea.innerHTML = "";

    const noticeSpan = document.createElement("span");
    noticeSpan.textContent = "메모를 작성하려면 먼저 로그인해 주세요.";
    userArea.appendChild(noticeSpan);

    const loginBtn = document.createElement("button");
    loginBtn.className = "auth-btn";
    loginBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
      </svg>
      Google 로그인
    `;
    loginBtn.onclick = async function () {
      try {
        await signInWithPopup(auth, provider);
      } catch (err) {
        console.error("구글 로그인 실패:", err);
        alert("로그인 중 오류가 발생했습니다: " + err.message);
      }
    };
    userArea.appendChild(loginBtn);

    // 미로그인 상태: 메모 입력창 비활성화하여 아예 작성하지 못하게 방어
    const inputEl = document.getElementById("input");
    if (inputEl) {
      inputEl.disabled = true;
      inputEl.placeholder = "로그인하지 않은 사람은 메모를 쓸 수 없습니다.";
    }
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}


// ===================================================
// 데이터를 다루는 함수 세 개
// Firestore를 사용하여 데이터를 저장, 조회, 삭제합니다.
// ===================================================

// 메모를 읽어 옵니다.
function loadMemos() {
  return memos;
}

// 메모를 새로 씁니다.
// Firestore의 'memos' 컬렉션에 새 문서를 추가합니다.
// 로그인한 사람만 쓸 수 있으며, 글쓴이의 uid와 이름을 함께 저장합니다.
async function addMemo(text) {
  // 로그인하지 않은 사람은 메모를 아예 못 쓰게 막습니다
  if (!currentUser) {
    alert("로그인하지 않은 사람은 메모를 쓸 수 없습니다. 먼저 로그인해 주세요.");
    return;
  }

  // 5글자 이상 입력 규칙 검사
  if (text.length < 5) {
    alert("메모는 5글자 이상 입력해 주세요.");
    return;
  }

  try {
    await addDoc(collection(db, "memos"), {
      text: text,
      createdAt: Date.now(),
      uid: currentUser.uid,                     // 로그인한 사람의 uid를 함께 저장
      userName: currentUser.displayName || "익명", // 글쓴이 이름을 함께 저장
      role: currentRole
    });
  } catch (error) {
    console.error("메모 저장 실패:", error);
    alert(`메모 저장 실패 (${error.code || error.message})\nFirebase 콘솔에서 Firestore '규칙(Rules)'을 확인해 주세요.`);
  }
}

// 메모를 지웁니다.
// Firestore에서 해당 id의 문서를 삭제합니다.
// 교사는 모든 메모를 지울 수 있고, 학생은 본인이 작성한 메모만 지울 수 있습니다 (타인 메모 조작 방지).
async function deleteMemo(id) {
  const targetMemo = memos.find(function (memo) {
    return memo.id === id;
  });

  const isTeacher = currentRole === "teacher";
  const isOwner = currentUser && targetMemo && targetMemo.uid === currentUser.uid;

  // 학생은 다른 사람의 메모를 삭제할 수 없음
  if (!isTeacher && targetMemo && targetMemo.uid && !isOwner) {
    alert("학생은 본인이 작성한 메모만 삭제할 수 있습니다. 다른 사람의 메모는 건드릴 수 없습니다.");
    return;
  }

  try {
    await deleteDoc(doc(db, "memos", id));
  } catch (error) {
    console.error("메모 삭제 실패:", error);
    alert(`메모 삭제 실패 (${error.code || error.message})`);
  }
}


// ===================================================
// AI 코멘트 생성 및 관리 (교사 전용)
// ===================================================

// AI 코멘트 생성 (Vercel 서버리스 함수 /api/gemini 호출)
async function generateAiComment(memoId) {
  if (currentRole !== "teacher") {
    alert("AI 코멘트는 교사만 생성할 수 있습니다.");
    return;
  }

  const memo = memos.find(function (m) { return m.id === memoId; });
  if (!memo) return;

  try {
    const headers = { "Content-Type": "application/json" };
    let savedKey = sessionStorage.getItem("GEMINI_KEY") || "";
    if (savedKey) {
      headers["x-gemini-key"] = savedKey;
    }

    // Vercel 서버리스 함수 /api/gemini 호출 (개인정보인 uid/작성자명은 제외하고 메모 내용만 전달)
    let res = await fetch("/api/gemini", {
      method: "POST",
      headers: headers,
      body: JSON.stringify({ text: memo.text })
    });

    let data = await res.json().catch(() => ({}));

    // 만약 Vercel 환경변수 GEMINI_API_KEY가 아직 없을 경우, 직접 입력받아 세션에 임시 보관
    if (res.status === 500 && data.error === "GEMINI_API_KEY_REQUIRED") {
      const inputKey = prompt("Vercel 환경변수에 GEMINI_API_KEY가 아직 설정되지 않았습니다.\n\n테스트용 Google Gemini API 키를 입력해 주세요 (https://aistudio.google.com/ 에서 무료 발급):");
      if (!inputKey || inputKey.trim() === "") return;
      savedKey = inputKey.trim();
      sessionStorage.setItem("GEMINI_KEY", savedKey);
      headers["x-gemini-key"] = savedKey;

      res = await fetch("/api/gemini", {
        method: "POST",
        headers: headers,
        body: JSON.stringify({ text: memo.text, apiKey: savedKey })
      });
      data = await res.json().catch(() => ({}));
    }

    if (!res.ok) {
      throw new Error(data.error || "코멘트 생성에 실패했습니다.");
    }

    // Firestore에 생성된 AI 코멘트 저장
    await updateDoc(doc(db, "memos", memoId), {
      aiComment: data.comment
    });
  } catch (error) {
    console.error("AI 코멘트 생성 오류:", error);
    alert("AI 코멘트 생성 실패: " + error.message);
  }
}

// AI 코멘트 삭제 (교사 전용)
async function deleteAiComment(memoId) {
  if (currentRole !== "teacher") {
    alert("AI 코멘트는 교사만 삭제할 수 있습니다.");
    return;
  }
  try {
    await updateDoc(doc(db, "memos", memoId), {
      aiComment: ""
    });
  } catch (error) {
    console.error("AI 코멘트 삭제 오류:", error);
  }
}


// ===================================================
// 화면 그리기
// ===================================================

function render() {
  const wall = document.getElementById("wall");
  wall.innerHTML = "";

  loadMemos().forEach(function (memo) {
    wall.appendChild(makeMemo(memo));
  });
}

// 메모 한 장 만들기
function makeMemo(memo) {
  const div = document.createElement("div");
  div.className = "memo";

  // 삭제 버튼 표시: 교사는 모든 메모 삭제 가능, 학생은 본인 메모만 삭제 가능
  const isTeacher = currentRole === "teacher";
  const isOwner = currentUser && memo.uid === currentUser.uid;
  const canDelete = isTeacher || isOwner || !memo.uid;

  if (canDelete) {
    const del = document.createElement("button");
    del.textContent = "×";
    del.title = isTeacher ? "교사 권한으로 삭제" : "내 메모 삭제";
    del.onclick = async function () {
      await deleteMemo(memo.id);
    };
    div.appendChild(del);
  }

  const span = document.createElement("span");
  span.textContent = memo.text;
  div.appendChild(span);

  // AI 코멘트 박스 표시 (있을 경우)
  if (memo.aiComment) {
    const aiBox = document.createElement("div");
    aiBox.className = "ai-comment-box";

    const aiHeader = document.createElement("div");
    aiHeader.className = "ai-comment-header";

    const aiTag = document.createElement("span");
    aiTag.className = "ai-comment-tag";
    aiTag.textContent = "🤖 AI 선생님 한줄평";
    aiHeader.appendChild(aiTag);

    // 교사는 AI 코멘트 삭제 가능
    if (isTeacher) {
      const delAi = document.createElement("button");
      delAi.className = "ai-comment-del";
      delAi.textContent = "×";
      delAi.title = "AI 피드백 삭제";
      delAi.onclick = async function () {
        await deleteAiComment(memo.id);
      };
      aiHeader.appendChild(delAi);
    }

    aiBox.appendChild(aiHeader);

    const aiP = document.createElement("p");
    aiP.className = "ai-comment-content";
    aiP.textContent = memo.aiComment;
    aiBox.appendChild(aiP);

    div.appendChild(aiBox);
  }

  // 교사(teacher) 전용: AI 피드백 남기기 / 재생성 버튼
  if (isTeacher) {
    const aiBtn = document.createElement("button");
    aiBtn.className = "ai-btn";
    aiBtn.textContent = memo.aiComment ? "🤖 AI 피드백 재생성" : "🤖 AI 피드백 남기기";
    aiBtn.onclick = async function () {
      aiBtn.disabled = true;
      aiBtn.textContent = "🤖 작성 중...";
      await generateAiComment(memo.id);
      aiBtn.disabled = false;
      aiBtn.textContent = memo.aiComment ? "🤖 AI 피드백 재생성" : "🤖 AI 피드백 남기기";
    };
    div.appendChild(aiBtn);
  }

  // 작성자 정보 표시 (역할 뱃지 포함)
  if (memo.userName) {
    const meta = document.createElement("div");
    meta.className = "memo-meta";
    const author = document.createElement("span");
    author.className = "memo-author";
    const roleText = memo.role === "teacher" ? " (교사)" : "";
    author.textContent = memo.userName + roleText;
    meta.appendChild(author);
    div.appendChild(meta);
  }

  return div;
}


// ===================================================
// 메모 쓰는 칸
// 엔터를 누르면 담벼락에 붙습니다 (줄바꿈은 Shift + 엔터)
// ===================================================

const input = document.getElementById("input");

input.onkeydown = async function (e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();

    // 로그인하지 않은 경우 메모 작성 차단
    if (!currentUser) {
      alert("로그인하지 않은 사람은 메모를 쓸 수 없습니다. 먼저 로그인해 주세요.");
      return;
    }

    const text = input.value.trim();
    if (text === "") return;

    input.value = "";
    await addMemo(text);
  }
};


// 첫 화면 그리기
renderUserArea();
render();
input.focus();
