// lib/adapters/intercom.js

function stripHtml(html) {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .trim();
}

function getFrom(author) {
  if (!author) return "user";
  const type = (author.type || "").toLowerCase();
  return (type === "admin" || type === "bot") ? "operator" : "user";
}

var adapt_conversation = (conv) => {
  let userEmail = "", userName = "";

  const contacts =
    (conv.contacts && conv.contacts.contacts) ||
    (conv.contacts && conv.contacts.data) ||
    (conv.contact ? [conv.contact] : []);

  if (contacts.length > 0) {
    userEmail = contacts[0].email || "";
    userName  = contacts[0].name  || contacts[0].email || "";
  }

  if (!userEmail && conv.source && conv.source.author && conv.source.author.type === "user") {
    userEmail = conv.source.author.email || "";
    userName  = conv.source.author.name  || userEmail;
  }

  const messages = [];

  // First message (source)
  if (conv.source && conv.source.body) {
    const from = getFrom(conv.source.author);
    const msg  = {
      text : stripHtml(conv.source.body),
      date : (conv.created_at || 0) * 1000,
      from
    };
    if (from === "operator" && (conv.source.author || {}).name) {
      msg.user = { name: conv.source.author.name };
    }
    messages.push(msg);

    // attachments
    for (const attachment of (conv.source.attachments || [])) {
      if (!attachment.name) continue;

      const gcsUrl = `https://storage.googleapis.com/intercom-export-eunomart/export03/03/2026/attachments/${conv.id}/${conv.source.id}/${attachment.name}`;

      messages.push({
        from : from,
        date : (conv.created_at || 0) * 1000 + 1,
        file : {
          url  : gcsUrl,
          name : attachment.name,
          type : attachment.content_type || "application/octet-stream"
        }
      });
    }
  }

  // Responses and notes
  const parts = (conv.conversation_parts && conv.conversation_parts.conversation_parts) || [];

  for (const part of parts) {
    if (!part.body) continue;
    if (part.part_type === "close" || part.part_type === "open") continue;

    const from    = getFrom(part.author);
    const message = { date: (part.created_at || 0) * 1000, from };

    if (part.part_type === "note") {
      message.note = stripHtml(part.body);
    } else {
      message.text = stripHtml(part.body);
    }

    if (from === "operator" && (part.author || {}).name) {
      message.user = { name: part.author.name };
    }

    messages.push(message);

    // Attachments
    for (const attachment of (part.attachments || [])) {
      if (!attachment.name) continue;

      const gcsUrl = `https://storage.googleapis.com/intercom-export-eunomart/export03/03/2026/attachments/${conv.id}/${part.id}/${attachment.name}`;

      messages.push({
        from : from,
        date : (part.created_at || 0) * 1000 + 1,
        file : {
          url  : gcsUrl,
          name : attachment.name,
          type : attachment.content_type || "application/octet-stream"
        },
        user : from === "operator" && (part.author || {}).name
          ? { name: part.author.name }
          : undefined
      });
    }
  }

  conv.user     = { email: userEmail, name: userName };
  conv.messages = messages;
  conv.state    = (conv.state === "closed" || conv.state === "resolved") ? "resolved" : "unresolved";

  return Promise.resolve(conv);
};

module.exports = { adapt_conversation };
