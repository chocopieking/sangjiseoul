// Vercel 서버리스 함수 — 브라우저에서 API로 직접 호출하면 키가 노출되므로,
// 이 함수가 서버에서 대신 호출해주는 "프록시" 역할을 합니다.
// 무료로 쓸 수 있는 Google Gemini API를 사용합니다 (개인 사용 기준 넉넉한 무료 한도, 신용카드 등록 불필요).
// 키는 Vercel 프로젝트의 환경변수(GEMINI_API_KEY)에만 저장되고, 브라우저로는 절대 전달되지 않습니다.
//
// 클라이언트(AIAssistant.jsx)는 그대로 두고, 이 파일 안에서만
// 기존 Anthropic 형식 요청 { model, max_tokens, system, messages:[{role,content}] } 을 받아
// Gemini API 형식으로 변환해서 호출하고, 응답도 다시 Anthropic 형식 { content:[{text}] } 으로 맞춰서 돌려줍니다.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST만 허용됩니다." })
    return
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    res.status(500).json({
      error: "GEMINI_API_KEY 환경변수가 설정되지 않았습니다. Vercel 대시보드 → Settings → Environment Variables 에서 추가한 뒤 다시 배포하세요.",
    })
    return
  }

  const { system, messages } = req.body || {}
  if (!messages) {
    res.status(400).json({ error: "messages가 필요합니다." })
    return
  }

  // Anthropic 스타일 messages → Gemini 스타일 contents로 변환
  // (Gemini는 assistant 대신 "model" 이라는 role 이름을 씁니다)
  const contents = messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: String(m.content ?? "") }],
  }))

  const model = "gemini-2.0-flash" // 무료 한도가 넉넉한 모델
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(system ? { system_instruction: { parts: [{ text: system }] } } : {}),
        contents,
        generationConfig: { maxOutputTokens: 1000 },
      }),
    })

    const data = await upstream.json()
    if (!upstream.ok) {
      res.status(upstream.status).json({ error: data?.error?.message || "Gemini API 오류" })
      return
    }

    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join("") || ""
    // 클라이언트는 Anthropic 응답 형식({content:[{text}]})을 기대하므로 동일하게 맞춰서 반환
    res.status(200).json({ content: [{ text }] })
  } catch (e) {
    res.status(500).json({ error: e.message || "서버 오류" })
  }
}

