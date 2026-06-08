// netlify/functions/register.js
// Creates a new student profile in Azure Table Storage

const { TableClient, AzureNamedKeyCredential } = require("@azure/data-tables");
const { v4: uuidv4 } = require("uuid");

const ACCOUNT_NAME = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const ACCOUNT_KEY = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const TABLE_NAME = "studymatedb";

function getTableClient() {
  const credential = new AzureNamedKeyCredential(ACCOUNT_NAME, ACCOUNT_KEY);
  return new TableClient(
    `https://${ACCOUNT_NAME}.table.core.windows.net`,
    TABLE_NAME,
    credential
  );
}

exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const body = JSON.parse(event.body);
    const { firstName, avatar, subjects, studyStyle, availability, university, bio, contact } = body;

    // Validate required fields
    if (!firstName || !avatar) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "firstName and avatar are required" }),
      };
    }

    // Sanitise firstName - only allow letters and spaces (PII protection)
    const cleanFirstName = firstName.trim().replace(/[^a-zA-Z\s]/g, "").substring(0, 30);
    if (!cleanFirstName) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid firstName" }),
      };
    }

    const userId = uuidv4();
    const client = getTableClient();

    // Validate contact fields - only instagram/linkedin/discord handles (no full URLs with personal info)
    const safeContact = {};
    if (contact?.instagram) safeContact.instagram = contact.instagram.replace(/[^a-zA-Z0-9._]/g, "").substring(0, 30);
    if (contact?.linkedin) safeContact.linkedin = contact.linkedin.replace(/[^a-zA-Z0-9._-]/g, "").substring(0, 50);
    if (contact?.discord) safeContact.discord = contact.discord.substring(0, 50);

    const entity = {
      partitionKey: "profile",
      rowKey: userId,
      firstName: cleanFirstName,
      avatar: avatar, // avatar key (e.g. "avatar_1") stored, not PII
      subjects: JSON.stringify(subjects || []),
      studyStyle: studyStyle || "",
      availability: availability || "",
      university: university || "",
      bio: (bio || "").substring(0, 200),
      contact: JSON.stringify(safeContact),
      createdAt: new Date().toISOString(),
    };

    await client.createEntity(entity);

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({ userId, message: "Profile created successfully" }),
    };
  } catch (err) {
    console.error("register error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to create profile", details: err.message }),
    };
  }
};
