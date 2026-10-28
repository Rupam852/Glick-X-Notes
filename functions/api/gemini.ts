interface Env {
  GEMINI_API_KEY?: string;
  VITE_GEMINI_API_KEY?: string;
}

// Cloudflare Pages Serverless Edge Function
// Secret API key is held securely on Cloudflare's server and NEVER exposed to client browser / DevTools
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const apiKey = context.env.GEMINI_API_KEY || context.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: { message: "GEMINI_API_KEY is not configured on Cloudflare server environment." } }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const payload: any = await context.request.json().catch(() => ({}));
    const { model = "gemini-3.5-flash", prompt, systemInstruction, images } = payload;

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: { message: "Prompt is required." } }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const parts: any[] = [{ text: prompt }];

    if (images && Array.isArray(images) && images.length > 0) {
      images.forEach((img: any) => {
        const cleanData = (img.data || "").replace(/^data:[^;]+;base64,/, "").trim();
        parts.push({
          inlineData: {
            mimeType: img.mimeType || "image/jpeg",
            data: cleanData
          }
        });
      });
    }

    const body: any = {
      contents: [{ parts }]
    };

    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    // Call Google Gemini API securely from Cloudflare Edge Server
    const googleRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      }
    );

    const data = await googleRes.json().catch(() => ({}));

    return new Response(JSON.stringify(data), {
      status: googleRes.status,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: { message: err?.message || "Internal server error in Cloudflare Gemini proxy." } }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

