"use client";

import { useState, useCallback, useRef } from "react";

export interface ChatMessage {
  id: string;
  type: "user" | "agent";
  text: string;
}

export interface UseBuilderAgentOptions {
  workerUrl: string;
  tenantId?: string;
  userId?: string;
}

export function useBuilderAgent({ workerUrl, tenantId, userId }: UseBuilderAgentOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [uiPayload, setUiPayload] = useState<any | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Keep the same session ID per component lifecycle to accumulate state in ADK
  const sessionIdRef = useRef<string>(crypto.randomUUID());

  const sendMessage = useCallback(
    async (text?: string, actionPayload?: any) => {
      setIsProcessing(true);
      setError(null);
      
      // Clear the UI payload as soon as the user responds
      setUiPayload(null);

      if (text) {
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), type: "user", text }]);
      }

      try {
        const resolvedTenantId = tenantId || process.env.NEXT_PUBLIC_PLAYGROUND_TENANT_ID;
        const resolvedUserId = userId || process.env.NEXT_PUBLIC_PLAYGROUND_USER_ID;

        const res = await fetch(`${workerUrl}/playground-builder/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenant_id: resolvedTenantId,
            user_id: resolvedUserId,
            session_id: sessionIdRef.current,
            message: text,
            ui_action: actionPayload,
          }),
        });

        if (!res.ok) {
          throw new Error(`Chat API failed: ${res.statusText}`);
        }

        const data = await res.json();
        
        // The ADK runner returns a list of events from this turn
        for (const event of data.events || []) {
          if (event.type === "message" && event.text) {
            setMessages((prev) => [
              ...prev,
              { id: event.id || crypto.randomUUID(), type: "agent", text: event.text },
            ]);
          } else if (event.type === "ui" && event.payload) {
            setUiPayload(event.payload);
          }
        }
      } catch (err: any) {
        console.error("Builder Agent error:", err);
        setError(err.message || "Something went wrong communicating with the agent.");
      } finally {
        setIsProcessing(false);
      }
    },
    [workerUrl, tenantId, userId]
  );

  return {
    messages,
    uiPayload,
    isProcessing,
    error,
    sendMessage,
    sessionId: sessionIdRef.current,
  };
}
