import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

const SITE_URL = Deno.env.get("SITE_URL") || "https://saveit.website";

async function sendEmail(to: string, subject: string, html: string) {
  const client = new SMTPClient({
    connection: {
      hostname: Deno.env.get("SMTP_HOST")!,
      port: Number(Deno.env.get("SMTP_PORT") || "587"),
      tls: true,
      auth: {
        username: Deno.env.get("SMTP_USER")!,
        password: Deno.env.get("SMTP_PASS")!,
      },
    },
  });

  await client.send({
    from: Deno.env.get("SMTP_FROM") || "SaveIt <noreply@saveit.app>",
    to,
    subject,
    html,
  });

  await client.close();
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Auth: accept service role key or valid user JWT
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const token = authHeader.replace("Bearer ", "");
  const isServiceRole = token === serviceRoleKey;

  if (!isServiceRole) {
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  let shareId: string;
  try {
    const body = await req.json();
    shareId = body.share_id;
    if (!shareId) throw new Error("missing share_id");
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid request body — expected { share_id: string }" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // Fetch the share with collection and sharer profile
    const { data: share, error: shareError } = await supabase
      .from("collection_shares")
      .select("id, shared_with_email, role, collection_id, shared_by")
      .eq("id", shareId)
      .single();

    if (shareError || !share) {
      return new Response(
        JSON.stringify({ success: false, error: "Share not found" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const { data: collection } = await supabase
      .from("collections")
      .select("name")
      .eq("id", share.collection_id)
      .single();

    const { data: sharer } = await supabase
      .from("profiles")
      .select("display_name, email")
      .eq("id", share.shared_by)
      .single();

    const sharerName = sharer?.display_name || sharer?.email || "Someone";
    const collectionName = collection?.name || "a collection";
    const roleName = share.role === "editor" ? "an editor" : "a viewer";
    const acceptUrl = `${SITE_URL}/join?share_id=${share.id}`;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="display: inline-block; width: 48px; height: 48px; border-radius: 14px; background: linear-gradient(135deg, #004ac6, #2563eb); color: #fff; font-size: 20px; font-weight: 800; line-height: 48px; text-align: center;">S</div>
        </div>
        <h1 style="font-size: 22px; font-weight: 800; color: #191c1d; text-align: center; margin-bottom: 8px;">You've been invited!</h1>
        <p style="font-size: 15px; color: #434655; text-align: center; line-height: 1.5; margin-bottom: 24px;">
          <strong>${sharerName}</strong> invited you as ${roleName} of <strong>"${collectionName}"</strong> on SaveIt.
        </p>
        <div style="text-align: center; margin-bottom: 32px;">
          <a href="${acceptUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #004ac6, #2563eb); color: #fff; font-size: 15px; font-weight: 700; text-decoration: none; border-radius: 9999px;">
            Accept Invitation
          </a>
        </div>
        <p style="font-size: 12px; color: #737686; text-align: center;">
          If you didn't expect this invitation, you can safely ignore this email.
        </p>
      </div>
    `;

    await sendEmail(
      share.shared_with_email,
      `${sharerName} shared "${collectionName}" with you on SaveIt`,
      html
    );

    return new Response(
      JSON.stringify({ success: true, share_id: shareId }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ success: false, error: e.message }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
});
