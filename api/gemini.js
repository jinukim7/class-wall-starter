// ===================================================
// Gemini API 호출을 위한 Vercel 서버리스 함수
//
// 주의:
// 1. API 키는 process.env.GEMINI_API_KEY 환경변수에서 읽습니다.
// 2. 학생 개인정보(이름, uid, 학교명 등)는 절대 모델에 전달하지 않습니다.
// 3. 무료 티어 모델(gemini-1.5-flash)을 사용합니다.
// ===================================================

export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-gemini-key");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST 요청만 지원합니다." });
  }

  // 요청 본문 파싱
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  const { text } = body || {};
  if (!text || typeof text !== "string" || text.trim() === "") {
    return res.status(400).json({ error: "코멘트를 생성할 메모 내용(text)이 필요합니다." });
  }

  // 1순위: Vercel/서버 환경변수, 2순위: 헤더 또는 요청 본문 (로컬 실습 편의용)
  const apiKey = process.env.GEMINI_API_KEY || req.headers["x-gemini-key"] || body?.apiKey;
  if (!apiKey) {
    return res.status(500).json({
      error: "GEMINI_API_KEY_REQUIRED",
      message: "GEMINI_API_KEY 환경변수가 설정되지 않았습니다."
    });
  }

  try {
    // 무료 티어로 제공되는 gemini-1.5-flash 모델 엔드포인트
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    // 교사 관점의 따뜻한 칭찬/피드백 프롬프트 (개인정보는 포함되지 않음)
    const prompt = `당신은 초·중등학교의 따뜻하고 지혜로운 선생님입니다.
학생이 학급 담벼락에 남긴 아래 메모를 읽고, 학생의 생각이나 감정을 공감해 주면서 호기심과 성장을 북돋아 주는 따뜻한 한 줄 코멘트(1~2문장)를 남겨주세요.

규칙:
1. 친절하고 긍정적인 경어체(~했군요!, ~하는 모습이 멋져요, ~해보면 어떨까요?)를 사용하세요.
2. 1~2문장 이내로 간결하고 따뜻하게 작성하세요.
3. 이모지는 1~2개 정도만 자연스럽게 사용하세요.

[학생 메모 내용]
"${text.trim()}"

[선생님의 따뜻한 코멘트]`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 150
        }
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const errMsg = errData.error?.message || `API 오류 (${response.status})`;
      return res.status(response.status).json({ error: errMsg });
    }

    const data = await response.json();
    const comment = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "친구의 따뜻한 생각을 응원합니다! 👍";

    return res.status(200).json({ comment });
  } catch (error) {
    console.error("Gemini 호출 중 오류 발생:", error);
    return res.status(500).json({ error: error.message || "서버 내부 오류가 발생했습니다." });
  }
}
