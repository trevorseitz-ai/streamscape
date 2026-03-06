import { createSupabaseAdmin } from '../../lib/supabase-server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { items, userId } = body as {
      items?: Array<{ id: string; sort_order: number }>;
      userId?: string;
    };

    if (!items || !Array.isArray(items) || !userId) {
      return Response.json(
        { error: 'items array and userId are required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    await Promise.all(
      items.map((item) =>
        supabase
          .from('watchlist')
          .update({ sort_order: item.sort_order })
          .eq('id', item.id)
          .eq('user_id', userId)
      )
    );

    return Response.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}
