import { useState, KeyboardEvent, useEffect } from "react";
import { 
  Sparkles, 
  Newspaper, 
  Copy, 
  Check, 
  Loader2, 
  AlertCircle, 
  CloudSun, 
  Calendar, 
  Tag, 
  Heart,
  HelpCircle,
  TrendingUp,
  MessageSquare
} from "lucide-react";
import { GoogleGenAI } from "@google/genai";

// ==========================================
// [ API KEY 설정 ]
// - AI Studio의 Settings > Secrets에 GEMINI_API_KEY가 등록되어 있으면 자동으로 앱에서 해당 키를 사용합니다.
// - 만약 개인 API Key를 직접 소스 코드에 기입하여 사용하고 싶다면 아래 빈 문자열 "" 안에 기입하세요.
// ==========================================
const API_KEY = "";

export default function App() {
  // 탭 상태: 'reply' (리뷰 답글 생성기) | 'news' (플레이스 소식 자동 기획)
  const [activeTab, setActiveTab] = useState<"reply" | "news">("reply");

  // ------------------------------------------
  // 공통 상태 관리
  // ------------------------------------------
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);

  // ------------------------------------------
  // 첫 번째 탭: AI 리뷰 답글 생성기 상태
  // ------------------------------------------
  const [reviewInput, setReviewInput] = useState("");
  const [replyOutput, setReplyOutput] = useState("");
  const [isGeneratingReply, setIsGeneratingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  // ------------------------------------------
  // 두 번째 탭: 플레이스 소식 자동 기획 상태
  // ------------------------------------------
  const [weatherInput, setWeatherInput] = useState("");
  const [weekdayInput, setWeekdayInput] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [newsOutput, setNewsOutput] = useState("");
  const [isGeneratingNews, setIsGeneratingNews] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);

  // 토스트 메시지 자동 숨김 처리
  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => {
        setShowToast(false);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  // 토스트 띄우기 함수
  const triggerToast = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
  };

  // ------------------------------------------
  // 클립보드 복사 기능
  // ------------------------------------------
  const handleCopy = async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      triggerToast("📋 클립보드에 복사 완료!");
    } catch (err) {
      // 대체 복사 방식 (구형 브라우저 대응)
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        triggerToast("📋 클립보드에 복사 완료!");
      } catch (copyErr) {
        triggerToast("❌ 복사에 실패했습니다. 직접 드래그하여 복사해주세요.");
      }
      document.body.removeChild(textArea);
    }
  };

  // ------------------------------------------
  // 엔터 키 제출 방지 핸들러
  // ------------------------------------------
  const handlePreventEnterSubmit = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
    }
  };

  // Helper to initialize Gemini client on the browser dynamically
  const getGeminiClient = () => {
    // 1. Check hardcoded variable first
    // 2. Check process.env.GEMINI_API_KEY (substituted via Vite define)
    // 3. Check import.meta.env.VITE_GEMINI_API_KEY
    const key = API_KEY || 
                (typeof process !== "undefined" && process.env?.GEMINI_API_KEY) || 
                (import.meta as any).env?.VITE_GEMINI_API_KEY;

    if (!key || key.trim() === "" || key === "MY_GEMINI_API_KEY") {
      throw new Error(
        "Gemini API Key가 구성되지 않았습니다. AI Studio의 Settings > Secrets에서 GEMINI_API_KEY 키를 등록하고 저장해 주시거나, 소스 코드 상단의 API_KEY 변수에 키를 입력해 주세요."
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

  // ------------------------------------------
  // 1. AI 리뷰 답글 생성 (브라우저 직접 호출)
  // ------------------------------------------
  const handleGenerateReply = async () => {
    if (!reviewInput.trim()) {
      setReplyError("고객 리뷰를 입력해주세요.");
      return;
    }

    setIsGeneratingReply(true);
    setReplyError(null);
    setReplyOutput("");

    try {
      const ai = getGeminiClient();
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
"${reviewInput}"
`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.75,
        },
      });

      const replyText = response.text;
      if (!replyText) {
        throw new Error("답글을 생성하는 도중 빈 응답을 받았습니다.");
      }

      setReplyOutput(replyText.trim());
      triggerToast("✨ 감동을 담은 맞춤형 답글이 생성되었습니다!");
    } catch (err: any) {
      setReplyError(err.message || "답글 생성에 실패했습니다. API 키를 확인해 주세요.");
    } finally {
      setIsGeneratingReply(false);
    }
  };

  // ------------------------------------------
  // 2. 플레이스 소식 자동 기획 (브라우저 직접 호출)
  // ------------------------------------------
  const handleGenerateNews = async () => {
    if (!weatherInput.trim()) {
      setNewsError("오늘 날씨를 입력해주세요.");
      return;
    }
    if (!weekdayInput.trim()) {
      setNewsError("오늘 요일을 입력해주세요.");
      return;
    }
    if (!keywordInput.trim()) {
      setNewsError("핵심 키워드를 입력해주세요.");
      return;
    }

    setIsGeneratingNews(true);
    setNewsError(null);
    setNewsOutput("");

    try {
      const ai = getGeminiClient();
      const systemInstruction = `당신은 네이버 플레이스 마케팅 전문가이자 매장 소식 기획자입니다. 방문자들의 호기심과 방문 욕구를 자극하는 매력적인 소식 글을 기획하는 능력이 탁월합니다.`;

      const prompt = `
[작성 규칙]
1. 인위적이지 않고 자연스럽고 정감 있게 첫 문장을 시작하세요.
2. 제시된 "오늘 날씨"(${weatherInput})와 "오늘 요일"(${weekdayInput})을 문맥상 아주 자연스럽게 소식 본문에 직접 언급하세요. (예: "비가 주룩주룩 내리는 상쾌한 월요일이네요~")
3. 제시된 핵심 키워드("${keywordInput}")를 중심으로 매장의 장점, 맛, 정성, 혹은 혜택을 매력적으로 어필하세요.
4. 과장 광고나 허위 표현은 금지하며, 독자가 읽었을 때 부담 없이 "오늘 당장 가보고 싶다"는 마음이 들도록 감성적이고 정직하게 작성하세요.
5. 전체 본문의 길이는 반드시 공백 포함 350자 이상, 600자 이하로 작성하세요.
6. 문맥 중간중간에 적당한 감성 이모지를 조화롭게 섞어 가독성을 높이세요.
7. 글의 맨 마지막 줄에 제시된 내용과 어울리는 마케팅용 핵심 해시태그를 정확히 5개 추가하세요.
8. 한국어(Korean)로만 출력하세요.
9. 다른 부연설명이나 "소식 글:", "제목:" 같은 불필요한 라벨 없이 플레이스 소식 본문 전체만 바로 사용할 수 있게 출력하세요.

[입력 정보]
- 오늘 날씨: ${weatherInput}
- 오늘 요일: ${weekdayInput}
- 핵심 키워드: ${keywordInput}
`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.8,
        },
      });

      const newsText = response.text;
      if (!newsText) {
        throw new Error("소식을 생성하는 도중 빈 응답을 받았습니다.");
      }

      setNewsOutput(newsText.trim());
      triggerToast("📝 플레이스에 등록할 매력적인 소식이 완성되었습니다!");
    } catch (err: any) {
      setNewsError(err.message || "소식 생성에 실패했습니다. API 키를 확인해 주세요.");
    } finally {
      setIsGeneratingNews(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans flex flex-col antialiased">
      {/* HEADER SECTION */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-xs">
        <div className="max-w-[900px] mx-auto px-4 py-4 md:py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
              DyMonth AI마케팅 자동화 시스템
            </h1>
            <p className="text-sm text-slate-500 mt-2 font-medium">
              소상공인 대표님들의 소중한시간을 아껴주는 AI자동화 도구
            </p>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-[900px] w-full mx-auto px-4 py-8 md:py-12">
        
        {/* TAB BUTTONS */}
        <div className="flex border-b border-slate-200 mb-8 bg-white p-1 rounded-xl shadow-xs">
          <button
            onClick={() => setActiveTab("reply")}
            className={`flex-1 py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
              activeTab === "reply"
                ? "bg-point text-white shadow-md shadow-point/20"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            AI 리뷰 답글 생성기
          </button>
          <button
            onClick={() => setActiveTab("news")}
            className={`flex-1 py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
              activeTab === "news"
                ? "bg-point text-white shadow-md shadow-point/20"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <Newspaper className="w-4 h-4" />
            플레이스 소식 자동 기획
          </button>
        </div>

        {/* ========================================================
            TAB 1: AI 리뷰 답글 생성기
            ======================================================== */}
        {activeTab === "reply" && (
          <div className="space-y-6">
            {/* 카드 */}
            <div className="bg-white rounded-2xl p-6 md:p-8 border border-slate-200/80 shadow-xs space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-point" />
                  리뷰 답글 마스터
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  고객이 남긴 리뷰를 입력하면 정중하고 따뜻한 사장님의 답글을 생성합니다.
                </p>
              </div>

              {/* 리뷰 입력란 */}
              <div className="space-y-2">
                <label htmlFor="review-textarea" className="text-sm font-semibold text-slate-700 flex justify-between">
                  <span>고객 리뷰 내용</span>
                  <span className="text-xs text-slate-400 font-normal">{reviewInput.length}자</span>
                </label>
                <textarea
                  id="review-textarea"
                  value={reviewInput}
                  onChange={(e) => {
                    setReviewInput(e.target.value);
                    if (replyError) setReplyError(null);
                  }}
                  rows={5}
                  placeholder="고객 리뷰를 붙여넣으세요."
                  className="w-full p-4 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-point/20 focus:border-point bg-slate-50/50 hover:bg-slate-50 transition-all text-sm leading-relaxed placeholder-slate-400"
                />
              </div>

              {/* 에러 메시지 */}
              {replyError && (
                <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200/80 flex items-start gap-3 text-sm animate-fade-in">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block">생성 중 문제가 발생했습니다.</span>
                    <p className="mt-1 text-red-600/90 leading-relaxed">{replyError}</p>
                  </div>
                </div>
              )}

              {/* 생성 버튼 */}
              <button
                onClick={handleGenerateReply}
                disabled={isGeneratingReply}
                className={`w-full py-3.5 px-6 rounded-xl font-bold text-white shadow-md transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
                  isGeneratingReply
                    ? "bg-slate-400 shadow-none cursor-not-allowed"
                    : "bg-point hover:bg-point-hover hover:shadow-lg hover:shadow-point/20 active:scale-[0.99]"
                }`}
              >
                {isGeneratingReply ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    답글 생성중...
                  </>
                ) : (
                  <>
                    ✨ 맞춤형 답글 생성
                  </>
                )}
              </button>
            </div>

            {/* 생성 결과 카드 */}
            {replyOutput && (
              <div className="bg-white rounded-2xl p-6 md:p-8 border border-slate-200 shadow-md space-y-4 animate-fade-in">
                <div className="flex items-center justify-between">
                  <h3 className="text-md font-bold text-slate-900 flex items-center gap-2">
                    <Heart className="text-point w-5 h-5 fill-point" />
                    AI가 정성껏 추천하는 사장님 답글
                  </h3>
                  <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-100">
                    추천 완료
                  </span>
                </div>

                <div className="relative">
                  <textarea
                    readOnly
                    value={replyOutput}
                    rows={6}
                    className="w-full p-5 border border-slate-200 bg-slate-50/50 rounded-xl font-sans text-sm leading-relaxed text-slate-800 resize-y focus:outline-none focus:border-slate-300"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => handleCopy(replyOutput)}
                    className="flex-1 py-3 px-5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  >
                    <Copy className="w-4 h-4" />
                    답글 복사하기
                  </button>
                  <button
                    onClick={() => {
                      setReviewInput("");
                      setReplyOutput("");
                    }}
                    className="py-3 px-5 border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-800 rounded-xl font-semibold text-sm transition-all duration-200 cursor-pointer"
                  >
                    초기화
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            TAB 2: 플레이스 소식 자동 기획
            ======================================================== */}
        {activeTab === "news" && (
          <div className="space-y-6">
            {/* 카드 */}
            <div className="bg-white rounded-2xl p-6 md:p-8 border border-slate-200/80 shadow-xs space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Newspaper className="w-5 h-5 text-point" />
                  소식 자동 기획 마스터
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  날씨와 키워드를 입력하면 플레이스 소식 글을 생성합니다.
                </p>
              </div>

              {/* 입력 폼 필드 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 오늘 날씨 */}
                <div className="space-y-2">
                  <label htmlFor="weather-input" className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                    <CloudSun className="w-4 h-4 text-slate-500" />
                    오늘 날씨
                  </label>
                  <input
                    id="weather-input"
                    type="text"
                    value={weatherInput}
                    onChange={(e) => {
                      setWeatherInput(e.target.value);
                      if (newsError) setNewsError(null);
                    }}
                    onKeyDown={handlePreventEnterSubmit}
                    placeholder="예시) 비오는 날, 엄청 무더운 날"
                    className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-point/20 focus:border-point bg-slate-50/50 hover:bg-slate-50 transition-all text-sm placeholder-slate-400"
                  />
                </div>

                {/* 오늘 요일 */}
                <div className="space-y-2">
                  <label htmlFor="weekday-input" className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    오늘 요일
                  </label>
                  <input
                    id="weekday-input"
                    type="text"
                    value={weekdayInput}
                    onChange={(e) => {
                      setWeekdayInput(e.target.value);
                      if (newsError) setNewsError(null);
                    }}
                    onKeyDown={handlePreventEnterSubmit}
                    placeholder="예시) 월요일, 주말"
                    className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-point/20 focus:border-point bg-slate-50/50 hover:bg-slate-50 transition-all text-sm placeholder-slate-400"
                  />
                </div>

                {/* 핵심 키워드 */}
                <div className="space-y-2 md:col-span-2">
                  <label htmlFor="keyword-input" className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                    <Tag className="w-4 h-4 text-slate-500" />
                    핵심 키워드
                  </label>
                  <input
                    id="keyword-input"
                    type="text"
                    value={keywordInput}
                    onChange={(e) => {
                      setKeywordInput(e.target.value);
                      if (newsError) setNewsError(null);
                    }}
                    onKeyDown={handlePreventEnterSubmit}
                    placeholder="예시) 시원한 동태탕에 소주한잔"
                    className="w-full p-3.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-point/20 focus:border-point bg-slate-50/50 hover:bg-slate-50 transition-all text-sm placeholder-slate-400"
                  />
                </div>
              </div>

              {/* 에러 메시지 */}
              {newsError && (
                <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200/80 flex items-start gap-3 text-sm animate-fade-in">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block">소식 기획 중 문제가 발생했습니다.</span>
                    <p className="mt-1 text-red-600/90 leading-relaxed">{newsError}</p>
                  </div>
                </div>
              )}

              {/* 생성 버튼 */}
              <button
                onClick={handleGenerateNews}
                disabled={isGeneratingNews}
                className={`w-full py-3.5 px-6 rounded-xl font-bold text-white shadow-md transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
                  isGeneratingNews
                    ? "bg-slate-400 shadow-none cursor-not-allowed"
                    : "bg-point hover:bg-point-hover hover:shadow-lg hover:shadow-point/20 active:scale-[0.99]"
                }`}
              >
                {isGeneratingNews ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    소식 생성중...
                  </>
                ) : (
                  <>
                    📝 플레이스 소식 생성하기
                  </>
                )}
              </button>
            </div>

            {/* 생성 결과 카드 */}
            {newsOutput && (
              <div className="bg-white rounded-2xl p-6 md:p-8 border border-slate-200 shadow-md space-y-4 animate-fade-in">
                <div className="flex items-center justify-between">
                  <h3 className="text-md font-bold text-slate-900 flex items-center gap-2">
                    <TrendingUp className="text-point w-5 h-5" />
                    AI가 자동 기획한 네이버 플레이스 소식
                  </h3>
                  <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-100">
                    기획 완료
                  </span>
                </div>

                <div className="relative">
                  <textarea
                    readOnly
                    value={newsOutput}
                    rows={8}
                    className="w-full p-5 border border-slate-200 bg-slate-50/50 rounded-xl font-sans text-sm leading-relaxed text-slate-800 resize-y focus:outline-none focus:border-slate-300"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => handleCopy(newsOutput)}
                    className="flex-1 py-3 px-5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  >
                    <Copy className="w-4 h-4" />
                    소식 내용 복사하기
                  </button>
                  <button
                    onClick={() => {
                      setWeatherInput("");
                      setWeekdayInput("");
                      setKeywordInput("");
                      setNewsOutput("");
                    }}
                    className="py-3 px-5 border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-800 rounded-xl font-semibold text-sm transition-all duration-200 cursor-pointer"
                  >
                    초기화
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 도움말 카드 */}
        <div className="mt-12 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex gap-4">
          <HelpCircle className="w-6 h-6 text-slate-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-slate-900">도움말 및 팁</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              플레이스 마케팅 소식을 올릴 때는 요일의 감성, 오늘 날씨의 정취, 그리고 구체적인 키워드를 녹여내는 것이 독자의 방문 전환률을 올리는 비결입니다. 답글 작성 시에는 고객이 언급한 내용(예: 친절, 갈비찜)을 반복하여 반영해주면 친근감을 몇 배 더 극대화시킬 수 있습니다.
            </p>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-200 py-8 text-center text-xs text-slate-400">
        <div className="max-w-[900px] mx-auto px-4 space-y-2">
          <p className="font-semibold text-slate-500 flex items-center justify-center gap-1">
            DyMonth AI마케팅 자동화 시스템
          </p>
          <p>© 2026 DyMonth. All rights reserved.</p>
        </div>
      </footer>

      {/* TOAST NOTIFICATION */}
      <div
        className={`fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full text-sm font-bold shadow-lg flex items-center gap-2 transition-all duration-300 z-50 ${
          showToast ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-95 pointer-events-none"
        }`}
      >
        <Check className="w-4 h-4 text-emerald-400" />
        {toastMessage}
      </div>
    </div>
  );
}
