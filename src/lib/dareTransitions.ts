import { supabase } from './supabase';

export type DareTransitionAction =
  | 'accept'
  | 'decline'
  | 'start'
  | 'cancel'
  | 'submit'
  | 'reject'
  | 'verify'
  | 'complete';

export type DareState =
  | 'SENT'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'VERIFIED'
  | 'COMPLETED'
  | 'REJECTED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'CANCELLED';

type TransitionResponse = {
  success: boolean;
  participant_id: string;
  action: DareTransitionAction;
  state: DareState;
  error?: string;
};

export async function transitionDare(
  participantId: string,
  action: DareTransitionAction,
): Promise<TransitionResponse> {
  const { data, error } = await supabase.functions.invoke(
    'transition-dare',
    {
      body: {
        participant_id: participantId,
        action,
      },
    },
  );

  if (error) {
    throw new Error(error.message || 'Dare transition failed');
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Dare transition failed');
  }

  return data as TransitionResponse;
}