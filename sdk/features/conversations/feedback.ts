/**
 * Conversations Feature — agent-response feedback
 *
 * Thumbs up/down on what the AI said, and on a thumbs-down, what it should
 * have said instead. Corrections are appended to the tenant's WABA system
 * prompt on the next turn, so a dislike changes behaviour without anyone
 * editing the prompt.
 *
 * Kept in its own module rather than api.ts: that file is already ~600 lines
 * of message/conversation CRUD, and this is a self-contained concern.
 */
import { proxyClient } from '../../shared/proxyClient';

export type FeedbackRating = 'like' | 'dislike';

export interface MessageFeedback {
  id: string;
  message_id: string;
  rating: FeedbackRating;
  actual_response: string | null;
  expected_response: string | null;
  submitted_by: string | null;
  is_active: boolean;
}

export interface SubmitFeedbackRequest {
  conversationId: string;
  messageId: string;
  rating: FeedbackRating;
  /** What the agent SHOULD have said. Only meaningful on a dislike. */
  expectedResponse?: string;
  /**
   * What it actually said. Optional — the backend falls back to the stored
   * message text, so the caller does not have to echo it back.
   */
  actualResponse?: string;
  submittedBy?: string;
}

export interface SubmitFeedbackResponse {
  id: string;
  rating: FeedbackRating;
  is_active: boolean;
  /**
   * False when a dislike carried no expected response. The feedback is
   * recorded, but nothing was learned — surface this so the reviewer knows
   * the agent will keep making the same mistake.
   */
  willTrain: boolean;
}

export const feedbackKeys = {
  all: ['conversation-feedback'] as const,
  byConversation: (conversationId: string) =>
    [...feedbackKeys.all, conversationId] as const,
};

export async function submitMessageFeedback(
  req: SubmitFeedbackRequest
): Promise<SubmitFeedbackResponse> {
  // proxyClient wraps the response body in `.data`, so the service payload
  // is at response.data.* — matching every other call in this feature.
  const response = await proxyClient.post<{
    success: boolean;
    data: { id: string; rating: FeedbackRating; is_active: boolean };
    will_train: boolean;
  }>(
    `/api/whatsapp-conversations/conversations/${req.conversationId}/messages/${req.messageId}/feedback`,
    {
      rating: req.rating,
      expected_response: req.expectedResponse,
      actual_response: req.actualResponse,
      submitted_by: req.submittedBy,
    }
  );
  return { ...response.data.data, willTrain: response.data.will_train };
}

export async function getConversationFeedback(
  conversationId: string
): Promise<MessageFeedback[]> {
  const response = await proxyClient.get<{ success: boolean; data: MessageFeedback[] }>(
    `/api/whatsapp-conversations/conversations/${conversationId}/feedback`
  );
  return response.data.data ?? [];
}
