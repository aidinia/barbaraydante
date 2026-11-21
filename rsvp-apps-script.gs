/**
 * RSVP form -> Google Sheet
 * ---------------------------------------------------------------
 * This is NOT loaded by the website. It's the backend script you
 * deploy on your own Google account so the RSVP form on the site
 * has somewhere to send its data.
 *
 * SETUP (one time, ~10 minutes):
 *
 * 1. Go to https://sheets.google.com and create a new spreadsheet.
 *    Name it something like "RSVP Boda".
 *
 * 2. In row 1, add these column headers (must match the order
 *    appendRow() below writes in):
 *      Fecha | Nombre | Email | Asistencia | Acompañantes | Dieta | Mensaje
 *
 * 3. In the spreadsheet menu: Extensions > Apps Script.
 *    Delete whatever is in the editor and paste this whole file.
 *
 * 4. Click "Deploy" (top right) > "New deployment".
 *    - Click the gear icon next to "Select type" and choose "Web app".
 *    - Description: anything, e.g. "RSVP form".
 *    - Execute as: Me (your account).
 *    - Who has access: Anyone.
 *    Click "Deploy".
 *
 * 5. Google will ask you to authorize the script (it's yours, so
 *    this is safe). Click through "Advanced" > "Go to ... (unsafe)"
 *    if you see a warning screen — that's normal for your own
 *    scripts that haven't been reviewed by Google.
 *
 * 6. Copy the "Web app URL" it gives you (it ends in /exec).
 *
 * 7. Open script.js in the website project, find the line:
 *      const RSVP_ENDPOINT = "REPLACE_WITH_YOUR_APPS_SCRIPT_URL";
 *    and paste your URL in there instead.
 *
 * That's it — every RSVP submitted on the site will appear as a
 * new row in your spreadsheet.
 *
 * If you ever change the form's fields, update both the HTML
 * (index.html, #rsvpForm) and the e.parameter.xxx names below to
 * match.
 */
function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = e.parameter;

  sheet.appendRow([
    new Date(),
    data.nombre || "",
    data.email || "",
    data.asistencia || "",
    data.acompanantes || "0",
    data.dieta || "",
    data.mensaje || "",
  ]);

  return ContentService.createTextOutput(
    JSON.stringify({ result: "success" })
  ).setMimeType(ContentService.MimeType.JSON);
}
