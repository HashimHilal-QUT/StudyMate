const auth = require('./lib/auth');
// netlify/functions/get-profiles.js
// Returns student profiles to authenticated students, excluding their own profile

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
    "Cache-Control": "no-store",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const userId = await auth.authenticate(event, getTableClient(TABLE_NAME));
    if (!userId) return auth.response(401, { error: "Please sign in to browse students." });

    const profilesClient = getTableClient(TABLE_NAME);

    // Fetch all student profiles
    const profiles = [];
    const profilesIter = profilesClient.listEntities({
      queryOptions: { filter: `PartitionKey eq 'profile'` },
    });

    for await (const entity of profilesIter) {
      profiles.push(auth.publicProfile(entity));
    }

    const filteredProfiles = profiles.filter(p => p.id !== userId);

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
