const { TOKEN_TTL_IN_SECONDS } = require(Runtime.getFunctions()['webchat/constants'].path);
const jwt = require("jsonwebtoken");

const createToken = (context, identity) => {
    console.log("Creating new token");
    const { AccessToken } = Twilio.jwt;
    const { ChatGrant } = AccessToken;

    const chatGrant = new ChatGrant({
        serviceSid: context.CONVERSATIONS_SERVICE_SID
    });

    const token = new AccessToken(context.ACCOUNT_SID, context.API_KEY, context.API_SECRET, {
        identity,
        ttl: TOKEN_TTL_IN_SECONDS
    });
    token.addGrant(chatGrant);
    const jwt = token.toJwt();
    console.log("New token created");
    return jwt;
};

module.exports = { createToken };
