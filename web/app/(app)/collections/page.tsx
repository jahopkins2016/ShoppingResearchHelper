import { createClient } from "@/lib/supabase/server";
import CollectionsList from "./collections-list";

export default async function CollectionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", user!.id)
    .single();
  const userEmail = profile?.email ?? user!.email ?? "";

  const [
    { data: ownedCollections },
    { data: acceptedShares },
    { data: pendingShares },
    { data: sharedByMe },
    { data: pinnedRows },
  ] = await Promise.all([
    supabase
      .from("collections")
      .select("*")
      .eq("user_id", user!.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("collection_shares")
      .select(
        "id, role, collections(*, profiles!collections_user_id_fkey(display_name, email))"
      )
      .eq("shared_with_email", userEmail)
      .eq("status", "accepted"),
    supabase
      .from("collection_shares")
      .select(
        "id, role, shared_by, created_at, collections(id, name, description, archived_at), profiles!collection_shares_shared_by_fkey(display_name, email)"
      )
      .eq("shared_with_email", userEmail)
      .eq("status", "pending"),
    supabase
      .from("collection_shares")
      .select("collection_id")
      .eq("shared_by", user!.id),
    supabase
      .from("pinned_collections")
      .select("collection_id")
      .eq("user_id", user!.id),
  ]);

  const sharedByMeCounts: Record<string, number> = {};
  for (const row of sharedByMe ?? []) {
    const cid = (row as any).collection_id as string;
    sharedByMeCounts[cid] = (sharedByMeCounts[cid] ?? 0) + 1;
  }

  const owned = (ownedCollections ?? []).map((c: any) => ({
    ...c,
    _ownership: "mine" as const,
    _sharedCount: sharedByMeCounts[c.id] ?? 0,
  }));

  const sharedWithMe = (acceptedShares ?? [])
    .map((s: any) => {
      const col = s.collections;
      if (!col) return null;
      const owner = col.profiles;
      return {
        ...col,
        _ownership: "shared_with_me" as const,
        _sharedCount: 0,
        _shareRole: s.role,
        _ownerName: owner?.display_name ?? owner?.email ?? "Someone",
      };
    })
    .filter(Boolean);

  const combined = [...owned, ...sharedWithMe];
  const collectionIds = combined.map((c) => c.id);

  const [{ data: coverItems }, { data: allItems }] = await Promise.all([
    collectionIds.length
      ? supabase
          .from("items")
          .select("collection_id, image_url, cached_image_path")
          .in("collection_id", collectionIds)
          .not("image_url", "is", null)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] as any[] }),
    collectionIds.length
      ? supabase
          .from("items")
          .select("collection_id")
          .in("collection_id", collectionIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const coverMap: Record<string, string> = {};
  for (const item of coverItems ?? []) {
    if (!coverMap[item.collection_id] && (item.cached_image_path || item.image_url)) {
      coverMap[item.collection_id] = item.cached_image_path || item.image_url;
    }
  }

  const itemCountMap: Record<string, number> = {};
  for (const item of allItems ?? []) {
    itemCountMap[item.collection_id] = (itemCountMap[item.collection_id] ?? 0) + 1;
  }

  const pinnedIds = (pinnedRows ?? []).map((r: any) => r.collection_id as string);

  const pendingInvitations = (pendingShares ?? [])
    .map((s: any) => ({
      id: s.id,
      role: s.role,
      shared_by: s.shared_by,
      created_at: s.created_at,
      collection: s.collections,
      sharer: s.profiles,
    }))
    .filter((s: any) => s.collection);

  return (
    <CollectionsList
      initialCollections={combined}
      coverMap={coverMap}
      pinnedIds={pinnedIds}
      itemCountMap={itemCountMap}
      pendingInvitations={pendingInvitations}
      userId={user!.id}
    />
  );
}
