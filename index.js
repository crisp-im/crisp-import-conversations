var CONFIG = require("./config");
var ImportLib = require("./lib/import");

var Import = new ImportLib({
  websiteId: CONFIG.WEBSITE_ID,
  identifier: CONFIG.API_IDENTIFIER,
  key: CONFIG.API_KEY
});

Import.importFromFile("./res/conversations.json").then((result) => {
  console.log(`Import is done. ${result.count} conversations imported.`)
});