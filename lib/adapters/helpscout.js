const LINE_BREAK_ALT_1_REGEX = /(<br \/>)/gm;
const LINE_BREAK_ALT_2_REGEX = /(<br>)/gm;

/**
 * Adapts Help Scout conversation to Crisp conversation
 * @public
 * @param  {object} conversation
 * @return {object} Promise object
 */
var adapt = (conversation) => {
  // Adapt Help Scout conversation information to Crisp meta
  conversation.user = {
    name   : `${conversation.primaryCustomer.first} ${conversation.primaryCustomer.last}`,
    email  : conversation.primaryCustomer.email,
    avatar : conversation.primaryCustomer.photoUrl
  };

  conversation.segments = conversation.tags;

  if (conversation.type) {
    conversation.segments.push(conversation.type);
  }

  if ((conversation.customFields || []).length > 0) {
    conversation.data = {};

    conversation.customFields.forEach((custom_field) => {
      let _key = custom_field.name.replace(/ /g,"_");

      conversation.data[_key] = custom_field.text;
    });
  }

  // Adapt Help Scout conversation threads to Crisp conversation messages
  conversation.messages = ((conversation._embedded || {}).threads || []).map((thread) => {
    let _content = thread.body.replace(LINE_BREAK_ALT_1_REGEX, "\n");
    _content = _content.replace(LINE_BREAK_ALT_2_REGEX, "");

    let _message = {
      from        : (
        thread.createdBy.type === "customer" ? "user" : "operator"
      ),

      user        : {
        name   : `${thread.createdBy.first} ${thread.createdBy.last}`,
        email  : thread.createdBy.email,
        avatar : thread.createdBy.photoUrl
      },

      date        : Date.parse(thread.createdAt),

      type        : "text",
      text        : _content,

      // Always embed original, as Help Scout uses HTML to format messages
      original    : {
        type    : "text/html",
        content : _content
      },

      origin      : thread.source.type === "email" ? "email" : "chat",

      fingerprint : thread.id
    };

    if (thread.type === "note") {
      _message.note = thread.body;
    }

    return _message;
  });


  // Adapt Help Scout conversation status to Crisp conversation state
  switch (conversation.status) {
    case "pending" : {
      conversation.state = "pending";

      break;
    }

    case "active" :
    case "open" : {
      conversation.state = "unresolved";

      break;
    }

    case "closed" : {
      conversation.state = "resolved";

      break;
    }

    default : {
      conversation.state = "unresolved"

      break;
    }
  }

  return Promise.resolve(conversation);
};

module.exports = { adapt };