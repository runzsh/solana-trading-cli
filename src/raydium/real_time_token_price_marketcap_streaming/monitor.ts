import Client, {
    CommitmentLevel,
    SubscribeRequestAccountsDataSlice,
    SubscribeRequestFilterAccounts,
    SubscribeRequestFilterBlocks,
    SubscribeRequestFilterBlocksMeta,
    SubscribeRequestFilterEntry,
    SubscribeRequestFilterSlots,
    SubscribeRequestFilterTransactions,
  } from "@triton-one/yellowstone-grpc";
  import { SubscribeRequestPing } from "@triton-one/yellowstone-grpc/dist/grpc/geyser";
  import { PublicKey, VersionedTransactionResponse } from "@solana/web3.js";
import { tOutPut } from "./utils/transactionOutput";
import { LIQUIDITY_STATE_LAYOUT_V4 } from "@raydium-io/raydium-sdk";
import { getMarketInfo } from "./utils/marketInfo";
//import { getSolBalance, getTokenBalance } from "./utils/walletInfo";
import { getTokenInfo } from "./utils/tokenInfo";
import { getSolBalance, getTokenBalance } from "./utils/walletInfo";
import { decimal } from "@solana/buffer-layout-utils";
import { grpc_url, grpc_xtoken, wsol } from "../../helpers/config";
import { time } from "console";
import logger from "../../../logger";
import fs from "fs";
import path from "path";

const raydium_PROGRAM_ID = new PublicKey(
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",  // Legacy AMM v4 Raydium
  // "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C",  // Standard AMM CPMM Raydium
  // "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK"   // Concentrated Liquidity CLMM Raydium
);

const client = new Client(
  grpc_url,
  grpc_xtoken,
  undefined,
);

  interface SubscribeRequest {
    accounts: { [key: string]: SubscribeRequestFilterAccounts };
    slots: { [key: string]: SubscribeRequestFilterSlots };
    transactions: { [key: string]: SubscribeRequestFilterTransactions };
    transactionsStatus: { [key: string]: SubscribeRequestFilterTransactions };
    blocks: { [key: string]: SubscribeRequestFilterBlocks };
    blocksMeta: { [key: string]: SubscribeRequestFilterBlocksMeta };
    entry: { [key: string]: SubscribeRequestFilterEntry };
    commitment?: CommitmentLevel | undefined;
    accountsDataSlice: SubscribeRequestAccountsDataSlice[];
    ping?: SubscribeRequestPing | undefined;
  }

    async function handleStream(client: Client, args: SubscribeRequest, timeoutSeconds: number) {
    // Subscribe for events
    const stream = await client.subscribe();
    logger.info(`📡 Subscribed to price stream for ${timeoutSeconds} seconds`);
  
  // Create `error` / `end` handler
  const streamClosed = new Promise<void>((resolve, reject) => {
    const onEnd = () => {
      logger.info("📴 Stream ended.");
      resolve();
    };
  
    const onError = (error: any) => {
      logger.error("❌ Stream error:", error);
      stream.destroy(); // more aggressive than .end()
      reject(error);
    };
  
    stream.once("end", onEnd);
    stream.once("close", onEnd); // both will call resolve()
    stream.once("error", onError);
  });

    // Set timeout
    const timeoutId = setTimeout(() => {
      logger.info(`⏱️ Timeout reached: ${timeoutSeconds}s. Closing stream...`);
      stream.destroy(); // forcibly closes it
    }, timeoutSeconds * 1000);
    
    // Handle updates
    stream.on("data", async (data) => {
      try{
        const result = tOutPut(data);
        const trade = result.signature.toString();
        const baseVault = result.poolstate.baseVault.toString();
        const quoteVault = result.poolstate.quoteVault.toString();
        const mint = result.poolstate.baseMint.toString();
        // logger.info(result)
        const tokenInfo = await getTokenInfo(mint)
        const quoteBal = await getSolBalance(quoteVault);
        const baseBal = await getTokenBalance(baseVault)/ 10 ** tokenInfo.decimal;
        const marketInfo = await getMarketInfo(baseBal,quoteBal,tokenInfo.currentSupply)
        const quoteBal$ = marketInfo.quote$
        const price = marketInfo.price;
        const marketcap = marketInfo.marketcap;
        const supply = marketInfo.currentSupply;

        if (supply !== undefined && tokenInfo.decimal !== undefined) {
            const now = new Date();
            const timestamp = now.toISOString(); // Example: "2025-04-16T14:25:30.000Z"
            const logContent = `
[${timestamp}]
SOLSCAN : https://solscan.io/tx/${trade}
signature: ${trade}
TokenAddress : ${mint}
Supply : ${supply}
BaseVault : ${baseVault}
quoteVault : ${quoteVault}
decimal : ${tokenInfo.decimal}
Price in SOL : ${price}
MarketCap : $${marketcap}
PoolInfo : ${quoteBal} SOL
       ${baseBal} TOKEN
==============================
`;

            // Define log file path
            const logFilePath = path.join(__dirname, `${mint}.log`);
            fs.appendFileSync(logFilePath, logContent, "utf8");

            // Still print a minimal version to console
            // logger.info(`📦 Logged data for token ${mint} to ${mint}.log`);
     }
    } catch (error) {
        if (error) {
          // do nothing, just ignore
        }
      }
});
  
  // Send subscribe request
  await new Promise<void>((resolve, reject) => {
    stream.write(args, (err: any) => {
      if (!err) resolve();
      else reject(err);
    });
  }).catch((reason) => {
    logger.error(reason);
    throw reason;
  });

  await streamClosed;
  clearTimeout(timeoutId); // Ensure timeout is cleared after completion
  logger.info("✅ Stream handler finished cleanly.");
  }

  function createRaydiumSubscribeRequest(
    baseMint: string,
    quoteMint: string
  ): SubscribeRequest {
    return {
      slots: {},
      accounts: {
        raydium: {
          account: [
            // Optionally include specific accounts here
          ],
          filters: [
            {
              memcmp: {
                offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf('quoteMint').toString(),
                base58: quoteMint
              }
            },
            {
              memcmp: {
                offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf('baseMint').toString(),
                base58: baseMint
              }
            }
          ],
          owner: [raydium_PROGRAM_ID.toString()]
        }
      },
      transactions: {},
      blocks: {},
      blocksMeta: {
        block: []
      },
      accountsDataSlice: [],
      commitment: CommitmentLevel.PROCESSED,
      entry: {},
      transactionsStatus: {}
    };
  }

  export async function subscribeToPriceMcap(
    baseMint: string,
    quoteMint: string,
    timeoutSeconds: number
  ) {
      try {
        const req = createRaydiumSubscribeRequest(baseMint, quoteMint);
        await handleStream(client, req, timeoutSeconds);
      } catch (error) {
        logger.error("Stream error, restarting in 1 second...", error);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
  }

  // (async () => {
  //   try {
  //     await subscribeToPriceMcap("7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr", wsol, 30);
  //     process.exit(0); // Exit cleanly after completion
  //   } catch (error) {
  //     logger.error("Fatal error in main execution:", error);
  //     process.exit(1); // Exit with error code
  //   }
  // })();