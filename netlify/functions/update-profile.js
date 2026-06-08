// netlify/functions/update-profile.js
// Updates an existing student profile — name is immutable, everything else is editable

const { TableClient, AzureNamedKeyCredential } = require("@azure/data-tables");

const ACCOUNT_NAME = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const ACCOUNT_KEY  = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const TABLE_NAME   = "studymatedb";

function getTableClient() {
  const credential = new AzureNamedKeyCredential(ACCOUNT_NAME, ACCOUNT_KEY);
  return new TableClient(
    `https://${ACCOUNT_NAME}.table.core.windows.net`,
    TABLE_NAME,
    credential
  );
}

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };

  try {
    const { userId, avatar, subjects, studyStyle, availability, university, bio, contact } = JSON.parse(event.body);

    if (!userId) return { statusCode: 400, headers, body: JSON.stringify({ error: "userId is required" }) };

    const client = getTableClient();

    // Fetch existing to preserve firstName (name is locked)
    let existing;
    try {
      existing = await client.getEntity("profile", userId);
    } catch {
      return { statusCode: 404, headers, body: JSON.stringify({ error: "Profile not found" }) };
    }

    // Sanitise contact
    const safeContact = {};
    if (contact?.instagram) safeContact.instagram = contact.instagram.replace(/[^a-zA-Z0-9._]/g, "").substring(0, 30);
    if (contact?.linkedin)  safeContact.linkedin  = contact.linkedin.replace(/[^a-zA-Z0-9._-]/g, "").substring(0, 50);
    if (contact?.discord)   safeContact.discord   = (contact.discord || "").substring(0, 50);

    const updated = {
      partitionKey:  "profile",
      rowKey:        userId,
      firstName:     existing.firstName,    // immutable
      avatar:        avatar || existing.avatar,
      subjects:      JSON.stringify(subjects || []),
      studyStyle:    studyStyle || "",
      availability:  availability || "",
      university:    (university || "").substring(0, 60),
      bio:           (bio || "").substring(0, 200),
      contact:       JSON.stringify(safeContact),
      createdAt:     existing.createdAt,
      updatedAt:     new Date().toISOString(),
    };

    await client.updateEntity(updated, "Replace");

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error("update-profile error:", err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Failed to update profile", details: err.message }) };
  }
};
