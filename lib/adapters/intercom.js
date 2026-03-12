var fs = require("fs");
var path = require("path");

var SECOND_TO_MILLISECOND = 1000;

/**
 * Strips HTML from a string
 * @public
 * @param  {string} html
 * @return {string} Cleaned string
 */
var stripHtml = (html) => {
  if (!html) {
    return "";
  }

  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .trim();
};

/**
 * Gets the from of a message
 * @public
 * @param  {object} author
 * @return {string} From of the message
 */
var getFrom = (author) => {
  let _type = (author?.type?.toLowerCase() || "");

  if (["admin", "bot"].includes(_type)) {
    return "operator";
  }

  return "user";
};

/**
 * Processes a message
 * @private
 * @param  {object} author
 * @param  {string} body
 * @param  {number} createdAt
 * @param  {string} [partType]
 * @return {object} Message object
 */
var processMessage = (author, body, createdAt, partType=null) => {
  let _from = getFrom(author);

  let _message = {
    date : (createdAt || 0) * SECOND_TO_MILLISECOND,
    from : _from
  };

  if (partType === "note") {
    _message.note = stripHtml(body);
  } else {
    _message.text = stripHtml(body);
  }

  if (_from === "operator" && author?.name) {
    _message.user = {
      name : author.name
    };
  }

  return _message;
};

/**
 * Processes attachments
 * @private
 * @param  {object} attachments
 * @param  {string} conversationId
 * @param  {string} partId
 * @param  {object} author
 * @param  {number} baseDate
 * @param  {string} authorName
 * @return {array}  Messages
 */
var processAttachments = (
  attachments,
  conversationId,
  partId,
  author,
  baseDate,
  authorName
) => {
  let _getAttachmentLocalPath = (attachment) => {
    return path.join(
      "./res/attachments",
      String(conversationId),
      String(partId),
      attachment.name
    );
  };

  return attachments
    .filter((attachment) => {
      if (!attachment.name || !conversationId || !partId) {
        console.warn(
          `⚠️  Skipping attachment: missing name, conversationId or partId`
        );

        return false;
      }

      let _localPath = _getAttachmentLocalPath(attachment);

      if (!fs.existsSync(_localPath)) {
        console.warn(`⚠️  Skipping attachment: file not found at ${_localPath}`);

        return false;
      }

      return true;
    })
    .map((attachment, index) => {
      let _localPath = _getAttachmentLocalPath(attachment),
        _from = getFrom(author);

      let _message = {
        from : _from,
        date : baseDate + index + 1,
        file : {
          url  : _localPath,
          name : attachment.name,
          type : attachment.content_type || "application/octet-stream"
        }
      };

      if (_from === "operator" && authorName) {
        _message.user = {
          name : authorName
        };
      }

      return _message;
    });
};

/**
 * Adapts Intercom conversation to Crisp conversation
 * @public
 * @param  {object} conversation
 * @return {object} Promise object
 */
var adapt_conversation = (conversation) => {
  // Adapt Intercom conversation information to Crisp meta
  let _userEmail = "",
    _userName = "";

  let _contact = (
    conversation.contacts?.contacts?.[0] ||
    conversation.contacts?.data?.[0] ||
    conversation.contact
  );

  if (_contact) {
    _userEmail = _contact.email || "";
    _userName = _contact.name || _userEmail;
  }

  if (!_userEmail && conversation.source?.author?.type === "user") {
    _userEmail = conversation.source.author.email || "";
    _userName = conversation.source.author.name || _userEmail;
  }

  conversation.user = {
    email : _userEmail,
    name  : _userName
  };

  // Adapt Intercom conversation messages to Crisp conversation messages
  conversation.messages = [];

  // First message (source)
  if (conversation.source?.body) {
    let _message = processMessage(
      conversation.source.author,
      conversation.source.body,
      conversation.created_at
    );

    conversation.messages.push(_message);

    // Attachments?
    if (conversation.source.attachments?.length > 0) {
      let _attachmentMessages = processAttachments(
        conversation.source.attachments,
        conversation.id,
        conversation.source.id,
        conversation.source.author,
        (conversation.created_at || 0) * SECOND_TO_MILLISECOND,
        conversation.source.author?.name
      );

      conversation.messages.push(..._attachmentMessages);
    }
  }

  // Responses and notes
  if (conversation.conversation_parts?.conversation_parts?.length > 0) {
    conversation.conversation_parts.conversation_parts
      .filter((part) => {
        if (!part.body) {
          return false;
        }

        if (["close", "open"].includes(part.part_type)) {
          return false;
        }

        return true;
      })
      .forEach((part) => {
        let _message = processMessage(
          part.author,
          part.body,
          part.created_at,
          part.part_type
        );

        conversation.messages.push(_message);

        // Attachments?
        if (part.attachments?.length > 0) {
          let _attachmentMessages = processAttachments(
            part.attachments,
            conversation.id,
            part.id,
            part.author,
            (part.created_at || 0) * SECOND_TO_MILLISECOND,
            part.author?.name
          );

          conversation.messages.push(..._attachmentMessages);
        }
      });
  }

  // Ignore messages with no text, note, or file content
  conversation.messages = conversation.messages.filter((message) => {
    if (message.file) {
      return true;
    }

    if (message.note && message.note.trim()) {
      return true;
    }

    if (message.text && message.text.trim()) {
      return true;
    }

    return false;
  });

  // Adapt Intercom conversation status to Crisp conversation state
  switch (conversation.state) {
    case "resolved" :
    case "closed" : {
      conversation.state = "resolved";

      break;
    }

    default : {
      conversation.state = "unresolved";

      break;
    }
  }

  return Promise.resolve(conversation);
};

module.exports = { adapt_conversation };
