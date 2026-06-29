// netlify/functions/get-matches.js
// Returns all mutual matches for a given user, with contact info revealed

const { TableClient, AzureNamedKeyCredential } = require("@azure/data-tables");

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

  try {
    const { userId } = event.queryStringParameters || {};

    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "userId is required" }),
      };
    }

    const client = getTableClient();

    // Find all matches involving this user
    const matchesIter = client.listEntities({
      queryOptions: {
        filter: "PartitionKey eq 'match'",
      },
    });

    const myMatches = [];
    for await (const match of matchesIter) {
      if (match.student1 === userId || match.student2 === userId) {
        const partnerId = match.student1 === userId ? match.student2 : match.student1;

        // Fetch partner profile
        try {
          const partner = await client.getEntity("profile", partnerId);
          myMatches.push({
            matchId: match.rowKey,
            matchedAt: match.matchedAt,
            partner: {
              id: partnerId,
              firstName: partner.firstName,
              avatar: partner.avatar,
              subjects: partner.subjects ? JSON.parse(partner.subjects) : [],
              studyStyle: partner.studyStyle,
              university: partner.university,
              contact: partner.contact ? JSON.parse(partner.contact) : {},
            },
          });
        } catch (e) {
          // Profile may have been deleted
        }
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ matches: myMatches }),
    };
  } catch (err) {
    console.error("get-matches error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to fetch matches", details: err.message }),
    };
  }
};
