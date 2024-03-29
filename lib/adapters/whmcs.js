/**
 * Adapts WHMCS ticket to Crisp conversation
 * @public
 * @param  {object} ticket
 * @return {object} Promise object
 */
var adapt_conversation = (ticket) => {
  // Adapt WHMCS ticket information to Crisp meta
  ticket.user = {
    name  : ticket.name,
    email : ticket.email
  };

  if (ticket.subject) {
    ticket.subject = ticket.subject;
  }

  if (ticket.cc) {
    ticket.participants = ticket.cc.split(",");
  }

  // Adapt WHMCS ticket replies to Crisp conversation messages
  let _messages = (ticket.replies.reply || []).map((reply) => {
    return {
      from   : (
        reply.email === ticket.email ? "user" : "operator"
      ),

      date   : Date.parse(reply.date),

      text   : reply.message.replace(/\n/g, " "),

      origin : "chat"
    };
  });

  // Adapt WHMCS ticket notes to Crisp conversation messages
  let _notes = (ticket.notes.note || []).map((note) => {
    return {
      from   : "operator",

      date   : Date.parse(note.date),

      note   : note.message.replace(/\n/g, " "),

      origin : "chat"
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

module.exports = { adapt_conversation };
