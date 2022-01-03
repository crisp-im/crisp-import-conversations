var ImportLib = require("../lib/import");

var Import = new ImportLib({
  websiteId: "WEBSITE_ID",
  identifier: "CRISP_IDENTIFIER",
  key: "CRISP_KEY"
});

let dummyConversation = {
  user : {
    name : "John Doe",
    email: "john.doe@gmail.com",
    country: "US"
  },
  messages : [{
    text: "Message 1",
    date: Date.parse('01 Jan 2020 00:00:00 GMT'),
    from: "user"
  }, {
    text: "Message 2",
    date: Date.parse('01 Jan 2020 02:00:00 GMT'),
    from: "operator"
  }, {
    note: "Private note X",
    date: Date.parse('01 Jan 2020 02:00:00 GMT'),
    from: "operator"
  }, {
    text: "Reply from user",
    date: Date.parse('01 Jan 2020 03:00:00 GMT'),
    from: "user"
  }]
};

Import.importConversation(dummyConversation);