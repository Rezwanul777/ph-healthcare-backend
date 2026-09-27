import config from "../config";
import { redisClient } from "./redis";

export const getBikashIdToken = async () => {
  try {
    const idTokenKey = "bikash:idToken";
    const refreshTokenKey = "bikash:refreshToken";

    let bikashIdToken = await redisClient.get(idTokenKey);
    const bkashIdTokenTTL = await redisClient.ttl(idTokenKey);
    const bikashRefreshToken = await redisClient.get(refreshTokenKey);
    const bkashRefreshTokenTTL = await redisClient.ttl(refreshTokenKey);

    if (
      (bkashIdTokenTTL <= 600 || !bikashIdToken) &&
      bikashRefreshToken &&
      bkashRefreshTokenTTL > 600
    ) {
      const refreshtokenResponse = await fetch(
        `${config.bikash_base_url}/tokenized/checkout/token/refresh`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            username: config.bikash_username,
            password: config.bikash_password,
          },
          body: JSON.stringify({
            app_key: config.bikash_app_key,
            app_secret: config.bikash_app_secret,
            refresh_token: bikashRefreshToken,
          }),
        },
      );

       if (!refreshtokenResponse.ok) {
                throw new Error("Bkash Access Token Grant Failed")
            }

      const bikashRefreshTokenResult = await refreshtokenResponse.json();
      bikashIdToken = bikashRefreshTokenResult.id_token as string;
      await redisClient.set(idTokenKey, bikashIdToken, {
        expiration: {
          type: "EX",
          value: 60 * 60,
        },
      });
      return bikashIdToken;
    }


        if(bkashIdTokenTTL > 600) {
            return bikashIdToken
        }
    const response = await fetch(
      `${config.bikash_base_url}/tokenized/checkout/token/grant`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          username: config.bikash_username,
          password: config.bikash_password,
        },
        body: JSON.stringify({
          app_key: config.bikash_app_key,
          app_secret: config.bikash_app_secret,
        }),
      },
    );
    if (!response.ok) {
      throw new Error("Failed to get Bikash ID Token");
    }
    const result = await response.json();
    //id token set
    await redisClient.set(idTokenKey, result.id_token, {
      expiration: {
        type: "EX",
        value: 60 * 60,
      },
    });
    // refresh token set
    await redisClient.set(refreshTokenKey, result.refresh_token, {
      expiration: {
        type: "EX",
        value: 60 * 60 * 24 * 28, // 28 days
      },
    });
    bikashIdToken = result.id_token;

    return bikashIdToken;
  } catch (error: any) {
    throw new Error(`Error in getBikashIdToken: ${error.message}`);
  }
};
