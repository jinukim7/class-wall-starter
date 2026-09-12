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

// 현재 로그인한 사용자 정보 (null이면 로그인 안 됨)
let currentUser = null;

// 로그인 상태 변경 감시
onAuthStateChanged(auth, function (user) {
  currentUser = user;
  renderUserArea();
  render(); // 로그인 사용자에 따라 본인 메모의 삭제 버튼 표시를 갱신합니다.
});

// --- 메모 목록 ---
let memos = [];

// Firestore의 'memos' 컬렉션을 실시간으로 감시합니다.
// 작성 시간(createdAt) 순서대로 정렬하여 가져옵니다.
const memosQuery = query(collection(db, "memos"), orderBy("createdAt", "asc"));

onSnapshot(memosQuery, function (snapshot) {
  memos = snapshot.docs.map(function (docSnap) {
    return {
      id: docSnap.id,
      ...docSnap.data()
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
    userSpan.innerHTML = `👋 <strong>${escapeHtml(currentUser.displayName || "사용자")}</strong>님으로 로그인됨`;
    userArea.appendChild(userSpan);

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
    userArea.appendChild(logoutBtn);
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
// 백엔드 2: 여기에 "누가 썼는지"(uid)를 함께 저장하게 됩니다.
async function addMemo(text) {
  if (!currentUser) {
    alert("메모를 작성하려면 먼저 Google 로그인을 해 주세요.");
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
      uid: currentUser.uid,
      userName: currentUser.displayName || "익명"
    });
  } catch (error) {
    console.error("메모 저장 실패:", error);
    alert(`메모 저장 실패 (${error.code || error.message})\nFirebase 콘솔에서 Firestore '규칙(Rules)'을 확인해 주세요.`);
  }
}

// 메모를 지웁니다.
// Firestore에서 해당 id의 문서를 삭제합니다.
// 백엔드 2: 남의 메모를 지울 수 없도록 본인 메모인지 확인합니다.
async function deleteMemo(id) {
  const targetMemo = memos.find(function (memo) {
    return memo.id === id;
  });

  // 작성자 uid가 있는 메모는 본인만 삭제 가능
  if (targetMemo && targetMemo.uid && (!currentUser || targetMemo.uid !== currentUser.uid)) {
    alert("본인이 작성한 메모만 삭제할 수 있습니다.");
    return;
  }

  try {
    await deleteDoc(doc(db, "memos", id));
  } catch (error) {
    console.error("메모 삭제 실패:", error);
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

  // 본인 메모인 경우 또는 작성자 정보(uid)가 없는 기존 메모인 경우에만 삭제 버튼 표시
  const isMyMemo = !memo.uid || (currentUser && memo.uid === currentUser.uid);
  if (isMyMemo) {
    const del = document.createElement("button");
    del.textContent = "×";
    del.title = "삭제하기";
    del.onclick = async function () {
      await deleteMemo(memo.id);
    };
    div.appendChild(del);
  }

  const span = document.createElement("span");
  span.textContent = memo.text;
  div.appendChild(span);

  // 작성자 이름이 있으면 하단 메타 정보로 표시
  if (memo.userName) {
    const meta = document.createElement("div");
    meta.className = "memo-meta";
    const author = document.createElement("span");
    author.className = "memo-author";
    author.textContent = memo.userName;
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
