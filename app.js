// ===================================================
// 우리 반 담벼락 - 백엔드 1 (Firestore 연동)
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

// Firebase 설정 정보
const firebaseConfig = {
  apiKey: "AIzaSyAvfFhBRO3sqECa7eTjl0Y5Y0jivMV4Rx4",
  authDomain: "leo037-8d694.firebaseapp.com",
  projectId: "leo037-8d694",
  storageBucket: "leo037-8d694.firebasestorage.app",
  messagingSenderId: "477865704255",
  appId: "1:477865704255:web:6e4699b890f4202e98f18a"
};

// Firebase 및 Firestore 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

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
  try {
    await addDoc(collection(db, "memos"), {
      text: text,
      createdAt: Date.now()
    });
  } catch (error) {
    console.error("메모 저장 실패:", error);
    alert("메모 저장에 실패했습니다. Firestore 보안 규칙이나 설정을 확인해 주세요.");
  }
}

// 메모를 지웁니다.
// Firestore에서 해당 id의 문서를 삭제합니다.
// 백엔드 2: 지금은 누구든 남의 메모를 지울 수 있습니다. 이걸 막는 것이 과제입니다.
async function deleteMemo(id) {
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

  const del = document.createElement("button");
  del.textContent = "×";
  del.onclick = async function () {
    await deleteMemo(memo.id);
  };
  div.appendChild(del);

  const span = document.createElement("span");
  span.textContent = memo.text;
  div.appendChild(span);

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
render();
input.focus();
