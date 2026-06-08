// netlify/functions/swipe.js
// Records a swipe (left/right) and checks for mutual matches

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

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const { swiperId, targetId, direction } = JSON.parse(event.body);

    if (!swiperId || !targetId || !["left", "right"].includes(direction)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "swiperId, targetId, and direction (left|right) are required" }),
      };
    }

    const client = getTableClient();

    // Record the swipe
    const swipeEntity = {
      partitionKey: "swipe",
      rowKey: `${swiperId}_${targetId}`,
      swiperId,
      targetId,
      direction,
      timestamp: new Date().toISOString(),
    };

    await client.upsertEntity(swipeEntity, "Replace");

    // Check for mutual match (only if swiped right)
    let isMatch = false;
    let matchContact = null;

    if (direction === "right") {
      try {
        // Check if target has already swiped right on swiper
        const reverseSwipe = await client.getEntity("swipe", `${targetId}_${swiperId}`);
        if (reverseSwipe && reverseSwipe.direction === "right") {
          isMatch = true;

          // Record the match
          const matchId = [swiperId, targetId].sort().join("_");
          const matchEntity = {
            partitionKey: "match",
            rowKey: matchId,
            student1: swiperId,
            student2: targetId,
            matchedAt: new Date().toISOString(),
          };
          await client.upsertEntity(matchEntity, "Replace");

          // Fetch target's contact info to reveal on match
          const targetProfile = await client.getEntity("profile", targetId);
          matchContact = targetProfile.contact ? JSON.parse(targetProfile.contact) : {};
        }
      } catch (e) {
        // No reverse swipe exists yet - not a match
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ recorded: true, isMatch, matchContact }),
    };
  } catch (err) {
    console.error("swipe error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to record swipe", details: err.message }),
    };
  }
};
