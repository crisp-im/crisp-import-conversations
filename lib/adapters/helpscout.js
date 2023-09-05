var TurndownService = require("turndown");
var turndownService = new TurndownService();

/**
 * Adapts Help Scout conversation to Crisp conversation
 * @public
 * @param  {object} conversation
 * @return {object} Promise object
 */
var adapt_conversation = (conversation) => {
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
    let _content = turndownService.turndown(thread.body || "");

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

      text        : _content,

      // Always embed original, as Help Scout uses HTML to format messages
      original    : {
        type    : "text/html",
        content : thread.body || ""
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

module.exports = { adapt_conversation };
