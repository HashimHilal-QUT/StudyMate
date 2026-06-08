// netlify/functions/get-profiles.js
// Returns student profiles for swiping (excluding the current user and already-swiped profiles)

const { TableClient, AzureNamedKeyCredential } = require("@azure/data-tables");

const ACCOUNT_NAME = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const ACCOUNT_KEY = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const TABLE_NAME = "studymatedb";

function getTableClient(tableName) {
  const credential = new AzureNamedKeyCredential(ACCOUNT_NAME, ACCOUNT_KEY);
  return new TableClient(
    `https://${ACCOUNT_NAME}.table.core.windows.net`,
    tableName,
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

  try {
    const { userId } = event.queryStringParameters || {};

    const profilesClient = getTableClient(TABLE_NAME);
    const swipesClient = getTableClient(TABLE_NAME);

    // Fetch all student profiles
    const profiles = [];
    const profilesIter = profilesClient.listEntities({
      queryOptions: { filter: `PartitionKey eq 'profile'` },
    });

    for await (const entity of profilesIter) {
      profiles.push({
        id: entity.rowKey,
        firstName: entity.firstName,
        avatar: entity.avatar,
        subjects: entity.subjects ? JSON.parse(entity.subjects) : [],
        studyStyle: entity.studyStyle,
        availability: entity.availability,
        university: entity.university,
        bio: entity.bio,
        contact: entity.contact ? JSON.parse(entity.contact) : {},
      });
    }

    // If userId provided, filter out self and already-swiped (unless includeSelf=true)
    let filteredProfiles = profiles;
    const { includeSelf } = event.queryStringParameters || {};
    if (userId && includeSelf !== "true") {
      const swipedIds = new Set();
      const swipesIter = swipesClient.listEntities({
        queryOptions: { filter: `PartitionKey eq 'swipe' and RowKey ge '${userId}_' and RowKey lt '${userId}_~'` },
      });
      for await (const s of swipesIter) {
        const targetId = s.rowKey.replace(`${userId}_`, "");
        swipedIds.add(targetId);
      }
      filteredProfiles = profiles.filter(
        (p) => p.id !== userId && !swipedIds.has(p.id)
      );
    }

    // Shuffle for variety
    filteredProfiles.sort(() => Math.random() - 0.5);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ profiles: filteredProfiles }),
    };
  } catch (err) {
    console.error("get-profiles error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to fetch profiles", details: err.message }),
    };
  }
};
