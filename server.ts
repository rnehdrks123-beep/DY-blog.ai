import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

// Load environment variables
dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parser middleware
  app.use(express.json());

  // Helper to initialize Gemini client dynamically
  const getGeminiClient = (userApiKey?: string) => {
    const key = userApiKey || process.env.GEMINI_API_KEY;
    if (!key || key.trim() === "" || key === "MY_GEMINI_API_KEY") {
      throw new Error(
        "Gemini API Key가 설정되지 않았습니다. AI Studio의 Settings > Secrets에서 키를 등록하거나 소스 코드의 API_KEY 변수에 입력해주세요."
      );
    }
    return new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  };

  // 1. API: 리뷰 답글 생성기
  app.post("/api/generate-reply", async (req, res) => {
    try {
      const { review, userApiKey } = req.body;
      if (!review || review.trim() === "") {
        return res.status(400).json({ error: "고객 리뷰 내용을 입력해주세요." });
      }

      const ai = getGeminiClient(userApiKey);
      const systemInstruction = `당신은 네이버 플레이스 매장을 운영하는 사장님입니다. 고객들이 소중하게 남겨준 리뷰에 감동을 표현하고, 따뜻하고 정중하게 답글을 작성하는 베테랑 사장님입니다.`;
      
      const prompt = `
[작성 규칙]
1. 친절하고 따뜻한 어조(말투)로 작성하세요.
2. 방문 및 리뷰 작성에 대한 확실하고 따뜻한 감사를 반드시 포함하세요.
3. 고객의 리뷰 내용(예: 특정 메뉴 칭찬, 서비스 언급, 분위기 등)을 반드시 정확하게 언급하고 반영하세요.
4. 전체 길이는 반드시 공백 포함 120자 이상, 250자 이하로 작성하세요.
5. 적절한 이모지를 반드시 1개에서 3개 사이로 사용해 친근감을 더하세요.
6. 복사해서 네이버 플레이스에 바로 붙여넣어 쓸 수 있는 자연스러운 완성형 문장으로 구성하세요.
7. 광고처럼 과장되거나 상업적인 표현은 피하고 진정성 있게 작성하세요.
8. 한국어(Korean)로만 출력하세요.
9. 다른 부연설명이나 인사말, "답글:", "제목:" 같은 불필요한 라벨 없이 오직 사장님의 답글 본문만 출력하세요.

[고객 리뷰 내용]
"${review}"
`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.75,
        },
      });

      const replyText = response.text || "";
      res.json({ success: true, result: replyText.trim() });
    } catch (error: any) {
      console.error("Reply generation error:", error);
      res.status(500).json({ error: error.message || "답글 생성에 실패했습니다." });
    }
  });

  // 2. API: 플레이스 소식 자동 기획
  app.post("/api/generate-news", async (req, res) => {
    try {
      const { weather, weekday, keyword, userApiKey } = req.body;
      if (!weather || weather.trim() === "") {
        return res.status(400).json({ error: "오늘 날씨를 입력해주세요." });
      }
      if (!weekday || weekday.trim() === "") {
        return res.status(400).json({ error: "오늘 요일을 입력해주세요." });
      }
      if (!keyword || keyword.trim() === "") {
        return res.status(400).json({ error: "핵심 키워드를 입력해주세요." });
      }

      const ai = getGeminiClient(userApiKey);
      const systemInstruction = `당신은 네이버 플레이스 마케팅 전문가이자 매장 소식 기획자입니다. 방문자들의 호기심과 방문 욕구를 자극하는 매력적인 소식 글을 기획하는 능력이 탁월합니다.`;

      const prompt = `
[작성 규칙]
1. 인위적이지 않고 자연스럽고 정감 있게 첫 문장을 시작하세요.
2. 제시된 "오늘 날씨"(${weather})와 "오늘 요일"(${weekday})을 문맥상 아주 자연스럽게 소식 본문에 직접 언급하세요. (예: "비가 주룩주룩 내리는 상쾌한 월요일이네요~")
3. 제시된 핵심 키워드("${keyword}")를 중심으로 매장의 장점, 맛, 정성, 혹은 혜택을 매력적으로 어필하세요.
4. 과장 광고나 허위 표현은 금지하며, 독자가 읽었을 때 부담 없이 "오늘 당장 가보고 싶다"는 마음이 들도록 감성적이고 정직하게 작성하세요.
5. 전체 본문의 길이는 반드시 공백 포함 350자 이상, 600자 이하로 작성하세요.
6. 문맥 중간중간에 적당한 감성 이모지를 조화롭게 섞어 가독성을 높이세요.
7. 글의 맨 마지막 줄에 제시된 내용과 어울리는 마케팅용 핵심 해시태그를 정확히 5개 추가하세요.
8. 한국어(Korean)로만 출력하세요.
9. 다른 부연설명이나 "소식 글:", "제목:" 같은 불필요한 라벨 없이 플레이스 소식 본문 전체만 바로 사용할 수 있게 출력하세요.

[입력 정보]
- 오늘 날씨: ${weather}
- 오늘 요일: ${weekday}
- 핵심 키워드: ${keyword}
`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.8,
        },
      });

      const newsText = response.text || "";
      res.json({ success: true, result: newsText.trim() });
    } catch (error: any) {
      console.error("News generation error:", error);
      res.status(500).json({ error: error.message || "소식 생성에 실패했습니다." });
    }
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
