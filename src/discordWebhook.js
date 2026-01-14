

async function sendDiscordWebhook(webhookUrl, payload) {
  try {
    if (!webhookUrl) return;

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("❌ Discord webhook failed:", res.status, text);
    }
  } catch (e) {
    console.error("❌ Discord webhook error:", e);
  }
}

module.exports = { sendDiscordWebhook };