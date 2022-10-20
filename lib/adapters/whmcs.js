/**
 * Adapts WHMCS ticket to Crisp conversation
 * @public
 * @param  {object} ticket
 * @return {object} Promise object
 */
var adapt = (ticket) => {
  // Adapt WHMCS ticket information to Crisp meta
  ticket.user = {
    name  : ticket.name,
    email : ticket.email
  };

  if (ticket.subject) {
    ticket.subject = ticket.subject;
  }

  // Adapt WHMCS ticket replies to Crisp conversation messages
  let _messages = (ticket.replies.reply || []).map((reply) => {
    return {
      from        : (
        reply.email === ticket.email ? "user" : "operator"
      ),

      date        : Date.parse(reply.date),

      type        : "text",
      text        : reply.message.replace("\n", " "),

      origin      : "chat",

      fingerprint : parseInt(reply.replyid)
    };
  });

  // Adapt WHMCS ticket notes to Crisp conversation messages
  let _notes = (ticket.notes.note || []).map((note) => {
    return {
      from        : "operator",

      date        : Date.parse(note.date),

      type        : "note",
      text        : note.message.replace("\n", " "),

      origin      : "chat",

      fingerprint : parseInt(note.noteid)
    };
  });

  ticket.messages = [].concat(_messages, _notes);

  // Adapt WHMCS ticket status to Crisp conversation state
  switch ((ticket.status).toLowerCase()) {
    case "customer-reply" :
    case "on-hold"        :
    case "in-progress"    :
    case "answered"       :
    case "open"           : {
      ticket.state = "unresolved";

      break;
    }

    case "closed" : {
      ticket.state = "resolved";

      break;
    }

    default : {
      ticket.state = "unresolved"

      break;
    }
  }

  return Promise.resolve(ticket);
};

module.exports = { adapt };
