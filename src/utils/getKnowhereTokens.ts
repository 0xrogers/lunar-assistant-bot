import axios from "axios";
import { UserItems, UserTokens } from "../types";

export const getKnowhereTokens = async (walletAddress: string) => {
  try {
    const collectionAddresses = (
      await axios.get(
        `https://prod-backend-mainnet.knowhere.art/collections`
      )
    ).data
    .nodes
    .map((collection: {nftContract: string}) => collection.nftContract)

    const userTokens = collectionAddresses.reduce(async (acc: UserTokens, addr: string) => {
      const queryMsg = encodeURIComponent(JSON.stringify({
        tokens: {
          owner: walletAddress
        }
      }))

      const tokenIds = (
        await axios.get(`https://fcd.terra.dev/wasm/contracts/${addr}/store?query_msg=${queryMsg}`)
      ).data.result.tokens

      acc[addr] = tokenIds
    }, {} as UserTokens)

    return userTokens;
  } catch (e) {
    console.log(e);

    console.log(
      "error",
      walletAddress,
      `https://prod-backend-mainnet.knowhere.art/collections`
    );

    throw new Error("Failed to request knowhere api");
  }
};
