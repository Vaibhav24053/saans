import { useEffect, useRef, useState } from 'react';
import {
  Loader2,
  MessageSquareText,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { getUsAqiCategory, POLLUTANT_META } from '@shared/aqi';
import { useSaans } from '@/context/SaansContext';
import { AiSourceBadge, ImpactCategoryBadge } from '@/components/StatusBadges';

const STARTER_PROMPTS = [
  'Is it a good time to go for a walk?',
  'How should I prepare my home for today’s pollution?',
  'What can I change about my commute today?',
  'What should my family prepare for tomorrow?',
  'Which activities should I move indoors?',
  'How can I reduce my daily environmental footprint?',
];

export function AskSaansView() {
  const {
    profile,
    airData,
    chatMessages,
    chatLoading,
    sendChatMessage,
    clearChat,
    healthStatus,
  } = useSaans();

  const [input, setInput] = useState('');
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
      }
    };
  }, []);

  const handleSubmit = async (questionText?: string) => {
    const q = (questionText ?? input).trim();
    if (!q || chatLoading) return;
    setInput('');
    await sendChatMessage(q);
    if (scrollTimerRef.current) {
      clearTimeout(scrollTimerRef.current);
    }
    scrollTimerRef.current = setTimeout(() => {
      if (transcriptRef.current) {
        transcriptRef.current.scrollTo({
          top: transcriptRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }
    }, 60);
  };

  const aqi = airData?.current.usAqi ?? null;
  const cat = getUsAqiCategory(aqi);
  const dominant = airData
    ? POLLUTANT_META[airData.summary.dominantPollutant].symbol
    : '—';

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#2D6A4F]">
            Grounded AI Air Companion
          </p>
          <h1 className="font-serif-editorial text-3xl sm:text-4xl text-[#151B18] mt-1">
            Ask SAANS
          </h1>
          <p className="text-sm text-[#4A5550] mt-1">
            Direct, practical answers grounded in your active location, forecast
            curve, and household profile — never generic environmental essays.
          </p>
        </div>
        {chatMessages.length > 0 && (
          <button
            type="button"
            onClick={clearChat}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-[#717D77] hover:text-[#991B1B] hover:bg-[#FDECEC] transition-colors self-start sm:self-auto cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear conversation</span>
          </button>
        )}
      </div>

      {/* Live Context Grounding Bar */}
      <div className="saans-card p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs bg-[#FAF9F5]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[#4A5550]">
          <span className="font-semibold text-[#151B18]">
            Grounded Context:
          </span>
          <span>
            {airData?.location.name ?? profile.location.name}
            {airData?.isDemo ? ' (Demo Scenario)' : ''}
          </span>
          <span>·</span>
          <span className="font-mono-tabular font-semibold text-[#151B18]">
            US AQI {aqi ?? 'N/A'} ({cat.shortLabel})
          </span>
          <span>·</span>
          <span>Driver: {dominant}</span>
          <span>·</span>
          <span>
            {profile.commuteType.replace('_', ' ')} ·{' '}
            {profile.hasAirPurifier ? 'HEPA purifier' : 'no purifier'}
          </span>
        </div>
        <span className="text-[11px] font-medium text-[#2D6A4F]">
          {healthStatus?.geminiConfigured
            ? `Gemini ${healthStatus.model} ready`
            : 'Rules-based engine (set GEMINI_API_KEY for Gemini)'}
        </span>
      </div>

      {/* Chat Transcript Card */}
      <div className="saans-card flex flex-col min-h-[440px] max-h-[640px] overflow-hidden">
        <div
          ref={transcriptRef}
          className="flex-1 overflow-y-auto p-5 space-y-5"
        >
          {chatMessages.length === 0 ? (
            <div className="py-8 text-center space-y-5">
              <div className="w-12 h-12 rounded-2xl bg-[#E6F0EB] text-[#1B4332] flex items-center justify-center mx-auto">
                <MessageSquareText className="w-6 h-6" />
              </div>
              <div className="max-w-md mx-auto">
                <h2 className="text-base font-semibold text-[#151B18]">
                  Ask anything about today’s air and your routine
                </h2>
                <p className="text-xs text-[#4A5550] mt-1 leading-relaxed">
                  Every reply cites the exact supplied data points it used,
                  avoids medical diagnoses, and separates personal exposure from
                  wider emissions.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
                {STARTER_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void handleSubmit(prompt)}
                    className="px-3.5 py-2 rounded-full text-xs font-medium bg-[#FAF9F6] border border-[#E6E3DA] text-[#151B18] hover:border-[#1B4332] hover:bg-[#F3F8F5] transition-colors cursor-pointer text-left"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.role === 'user' ? (
                  <div className="max-w-[82%] px-4 py-3 rounded-2xl rounded-br-sm bg-[#1B4332] text-white text-sm leading-relaxed">
                    {msg.content}
                  </div>
                ) : (
                  <div className="max-w-[92%] w-full rounded-2xl rounded-bl-sm bg-[#FAF9F6] border border-[#E6E3DA] p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-[#1B4332]">
                          <Sparkles className="w-3.5 h-3.5" />
                          SAANS
                        </span>
                        {msg.meta && (
                          <ImpactCategoryBadge
                            category={msg.meta.impactFraming}
                          />
                        )}
                      </div>
                      {msg.meta && (
                        <AiSourceBadge
                          source={msg.meta.source}
                          model={msg.meta.model}
                          fallbackReason={msg.meta.fallbackReason}
                        />
                      )}
                    </div>

                    {msg.meta?.keyTakeaway && (
                      <div className="px-3.5 py-2.5 rounded-xl bg-[#E6F0EB] border border-[#C6DFD1] text-xs font-semibold text-[#1B4332]">
                        Key takeaway: {msg.meta.keyTakeaway}
                      </div>
                    )}

                    <div className="text-sm text-[#151B18] leading-relaxed whitespace-pre-line">
                      {msg.content}
                    </div>

                    {msg.meta?.dataPointsUsed &&
                      msg.meta.dataPointsUsed.length > 0 && (
                        <div className="pt-2 border-t border-[#ECE9DF]">
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#717D77] mb-1.5">
                            Supplied data cited
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.meta.dataPointsUsed.map((dp, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded-md bg-white border border-[#E6E3DA] text-[11px] font-mono-tabular text-[#4A5550]"
                              >
                                {dp}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                    {msg.meta?.followUpSuggestions &&
                      msg.meta.followUpSuggestions.length > 0 && (
                        <div className="pt-1 flex flex-wrap gap-1.5">
                          {msg.meta.followUpSuggestions.map((sug, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => void handleSubmit(sug)}
                              className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-white border border-[#D4D0C4] text-[#1B4332] hover:bg-[#E6F0EB] transition-colors cursor-pointer"
                            >
                              {sug}
                            </button>
                          ))}
                        </div>
                      )}
                  </div>
                )}
              </div>
            ))
          )}

          {chatLoading && (
            <div className="flex items-center gap-2 text-xs text-[#4A5550] pl-1">
              <Loader2 className="w-4 h-4 animate-spin text-[#1B4332]" />
              <span>Checking your forecast and household context…</span>
            </div>
          )}
        </div>

        {/* Input Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
          className="p-3.5 border-t border-[#E6E3DA] bg-white flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask SAANS about walks, windows, commute, cooking, or tomorrow..."
            disabled={chatLoading || !airData}
            className="flex-1 px-4 py-2.5 text-sm rounded-xl border border-[#D4D0C4] bg-[#FAF9F6] focus:bg-white focus:border-[#1B4332] outline-none"
          />
          <button
            type="submit"
            disabled={chatLoading || !input.trim() || !airData}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#1B4332] text-white hover:bg-[#143326] disabled:opacity-50 transition-colors cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Ask</span>
          </button>
        </form>
      </div>
    </div>
  );
}
