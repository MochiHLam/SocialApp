/** Frontend-only mock AI output until backend summarize/suggest endpoints exist. */

const FALLBACK_REPLIES = [
  "Sounds good, I'll get back to you soon!",
  "Thanks for letting me know — can we talk more about this?",
  "Got it. I'll review and reply properly in a bit.",
];

function clip(text, max = 120) {
  const clean = (text || "").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

export function getUnreadBatchMessages(messages, markers) {
  if (!markers?.firstId || !Array.isArray(messages)) return [];
  const startIdx = messages.findIndex((message) => message._id === markers.firstId);
  if (startIdx === -1) return [];
  return messages.slice(startIdx).filter((message) => !message.isDeleted && message.type !== "call");
}

export function buildMockUnreadSummary(messages, markers) {
  const batch = getUnreadBatchMessages(messages, markers);
  const textMessages = batch.filter((message) => message.text?.trim());

  if (textMessages.length === 0) {
    return {
      bullets: [
        "The unread batch includes media or system messages without plain text.",
        "Nothing specific to summarize from text content.",
      ],
      replies: [...FALLBACK_REPLIES],
    };
  }

  const snippets = textMessages.slice(-5).map((message) => clip(message.text, 80));
  const bullets = snippets.map((snippet, index) => {
    if (index === 0) return `Latest topic: “${snippet}”`;
    return `Also mentioned: “${snippet}”`;
  });

  if (bullets.length === 1) {
    bullets.push("No other text messages in this unread batch.");
  }

  const lastSnippet = snippets[snippets.length - 1] || "your message";
  const replies = [
    `Thanks! About “${clip(lastSnippet, 40)}” — I agree.`,
    `I saw your messages. Can you share a bit more detail?`,
    `Got it. I'll follow up on this soon.`,
  ];

  return { bullets, replies };
}

export function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
