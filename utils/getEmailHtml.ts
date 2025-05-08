export function getEmailHtml(itemsToReplace: Dict<string>, filePath: string) {
  const fs = require("fs");
  const path = require("path");
  const filePathResolved = path.resolve(__dirname, "../" + filePath);
  let html = fs.readFileSync(filePathResolved, "utf8");

  for (const [key, value] of Object.entries(itemsToReplace)) {
    console.log("Replacing key:", key, "with value:", value);
    html = html.replace(new RegExp(`{{${key}}}`, "g"), value);
  }

  return html;
}
