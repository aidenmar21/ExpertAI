// Browser-safe voice entry. Server-only code (token route) lives in server.ts.
export { ConversationProvider as ApprenticeVoiceProvider } from "@elevenlabs/react";
export { useApprenticeAgent } from "./useApprenticeAgent";
export type {
  ApprenticeAgent,
  ApprenticeAgentOptions,
  DebriefPhase,
  OutboxEntry,
  SendOutcome,
  SpeechSignals,
  VoiceTranscriptLine,
} from "./useApprenticeAgent";
export { formatContext, formatScreenEvent, deliveryFor } from "./format";
export type { AgentMode, Delivery } from "./format";
export { planDebrief, formatWorkMapContext } from "./debrief";
export type { DebriefQuestion } from "./debrief";
