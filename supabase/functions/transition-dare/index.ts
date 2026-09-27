import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

type TransitionRequest = {
  participant_id?: string;
  action?: string;
};

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    try {
      if (req.method !== "POST") {
        return Response.json(
          { error: "Method not allowed" },
          { status: 405 },
        );
      }

      const userId = ctx.userClaims?.id;

      if (!userId) {
        return Response.json(
          { error: "Authenticated user not found" },
          { status: 401 },
        );
      }

      const body = (await req.json()) as TransitionRequest;

      const participantId = body.participant_id?.trim();
      const action = body.action?.trim().toLowerCase();

      if (!participantId || !action) {
        return Response.json(
          {
            error: "participant_id and action are required",
          },
          { status: 400 },
        );
      }

      const { data, error } = await ctx.supabaseAdmin.rpc(
        "transition_dare_participant_backend",
        {
          p_participant_id: participantId,
          p_action: action,
          p_actor_id: userId,
        },
      );

      if (error) {
        console.error("Dare transition failed:", error);

        return Response.json(
          {
            error: error.message,
          },
          { status: 400 },
        );
      }

      return Response.json({
        success: true,
        participant_id: participantId,
        action,
        state: data,
      });
    } catch (error) {
      console.error("Unexpected transition error:", error);

      return Response.json(
        {
          error: error instanceof Error
            ? error.message
            : "Unexpected server error",
        },
        { status: 500 },
      );
    }
  }),
};