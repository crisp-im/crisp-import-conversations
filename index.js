var CONFIG = require("./config");
var ImportLib = require("./lib/import");

var Import = new ImportLib({
  websiteId: CONFIG.WEBSITE_ID,
  urn: CONFIG.PLUGIN_URN,
  name: CONFIG.PLUGIN_NAME,
  identifier: CONFIG.PLUGIN_TOKEN_IDENTIFIER,
  key: CONFIG.PLUGIN_TOKEN_KEY
});

Import.importFromFile("./res/conversations.json").then((result) => {
  console.log(`Import is done. ${result.count} conversations imported.`)
});
