var CONFIG = require("./config");
var CrispImport = require("./lib/import");

var Import = new CrispImport({
  websiteId: CONFIG.WEBSITE_ID,
  websitePlan: CONFIG.WEBSITE_PLAN,
  urn: CONFIG.PLUGIN_URN,
  name: CONFIG.PLUGIN_NAME,
  identifier: CONFIG.PLUGIN_TOKEN_IDENTIFIER,
  key: CONFIG.PLUGIN_TOKEN_KEY,
  defaultUserEmail: CONFIG.DEFAULT_USER_EMAIL,
  defaultUserNickname: CONFIG.DEFAULT_USER_NICKNAME,
  defaultOperatorNickname: CONFIG.DEFAULT_OPERATOR_NICKNAME
});

Import.importFromFile("./res/conversations.json")
  .then((result) => {
    console.log(`Import is done. ${result.count} conversations imported.`)
  })
  .catch((error) => {
    console.log("Import failed.");
    console.log(error);
  });
