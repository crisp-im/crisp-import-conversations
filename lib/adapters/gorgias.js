/**
 * Merges Gorgias conversations with Gorgias messages
 * @public
 * @param  {object} conversations
 * @param  {object} messages
 * @return {object} Promise object
 */
var adapt_conversations = (conversations, messages) => {
  if (!messages || messages.length === 0) {
    return Promise.reject(
      "There are no messages to import. Make sure to provide the " +
        "conversations CSV file as first argument, and the messages CSV file " +
        "as second argument."
    );
  }

  // Group messages by conversation id
  let _messages = {};

  messages.forEach(message => {
    // `id` represents in fact the conversation id (good naming there, Gorgias)
    let _id = message.id;

    if (_messages[_id]) {
      _messages[_id].push(message);
    } else {
      _messages[_id] = [message];
    }
  });

  // Add messages to their respective conversation
  let _conversations = conversations.map((conversation) => {
    let _conversation_id = conversation["Ticket id"];

    conversation.messages = _messages[_conversation_id] || [];

    return conversation;
  });

  return Promise.resolve(
    _conversations
  );
};

/**
 * Adapts Gorgias ticket to Crisp conversation
 * @public
 * @param  {object} ticket
 * @return {object} Promise object
 */
var adapt_conversation = (ticket) => {
  ticket.id = ticket["Ticket id"];

  let _email = ticket["Customer email"];

  // Adapt Gorgias ticket information to Crisp meta
  ticket.user = {
    name  : ticket["Customer name"] || _email.split("@")[0] || "",
    email : _email || ""
  };

  ticket.segments = (ticket.Tags || "").split(",");

  if (ticket["Initial channel"]) {
    ticket.segments.push(ticket["Initial channel"]);
  }

  ticket.data = {};

  if (ticket["Ticket id"]) {
    ticket.data.ticket_id = ticket["Ticket id"];
  }

  if (ticket["Last used integration type"]) {
    ticket.data.last_used_integration_type = (
      ticket["Last used integration type"]
    );
  }

  if (ticket["Survey replied date"]) {
    ticket.data.survey_replied_date = ticket["Survey replied date"];
    ticket.data.survey_score = ticket["Survey score"];
  }

  if (ticket.Subject) {
    ticket.subject = ticket.Subject;
  }

  // Adapt Gorgias ticket messages to Crisp conversation messages
  ticket.messages = (ticket.messages || [])
    .filter((message) => {
      // In some rare cases, messages sometimes don't have any content, so we \
      //   need skip them
      return message.body_text;
    })
    .map((message) => {
      let _message = {
        from        : (
          message.sender_info.address === _email
            ? "user" : "operator"
        ),

        date        : Date.parse(message.sent_datetime),

        text        : message.body_text,

        origin      : "chat",

        // Important: do not set any fingerprint here, as `message.id` is in \
        //   fact the conversation identifier (i.e. the same for all messages)
      };

      return _message;
    });

  // Adapt Gorgias ticket closed status to Crisp conversation state
  if (ticket["Closed date"]) {
    ticket.state = "resolved";
  } else {
    ticket.state = "unresolved";
  }

  return Promise.resolve(ticket);
};

module.exports = { adapt_conversations, adapt_conversation };
