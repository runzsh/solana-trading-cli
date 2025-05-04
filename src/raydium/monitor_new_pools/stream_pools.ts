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
import { VersionedTransactionResponse } from "@solana/web3.js";
import { TransactionFormatter } from "./utils/transaction-formatter";
import { RaydiumAmmParser } from "./utils/raydium-amm-parser";
import { grpc_url, grpc_xtoken } from "../../helpers/config";
import logger from "../../../logger";

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
// var TelegramBot = require("node-telegram-bot-api");
// const TELEGRAM_BOT_TOKEN = "YOUR BOT KEY"

// const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling : true});
// const msgId = 1122332232 //your bot msgID (in Numbers);
const TXN_FORMATTER = new TransactionFormatter();
const RAYDIUM_PARSER = new RaydiumAmmParser();
const RAYDIUM_PUBLIC_KEY = RaydiumAmmParser.PROGRAM_ID;

export const client = new Client(
  grpc_url,
  grpc_xtoken,
  undefined,
);

export const req: SubscribeRequest = {
  accounts: {},
  slots: {},
  transactions: {
    raydiumLiquidityPoolV4: {
      vote: false,
      failed: false,
      signature: undefined,
      accountInclude: [RAYDIUM_PUBLIC_KEY.toBase58()],
      accountExclude: [],
      accountRequired: [],
    },
  },
  transactionsStatus: {},
  entry: {},
  blocks: {},
  blocksMeta: {},
  accountsDataSlice: [],
  ping: undefined,
  commitment: CommitmentLevel.CONFIRMED,
};

function decodeRaydiumTxn(tx: VersionedTransactionResponse) {
  if (tx.meta?.err) return;

  const allIxs = TXN_FORMATTER.flattenTransactionResponse(tx);

  const raydiumIxs = allIxs.filter((ix) =>
    ix.programId.equals(RAYDIUM_PUBLIC_KEY),
  );

  const decodedIxs = raydiumIxs.map((ix) =>
    RAYDIUM_PARSER.parseInstruction(ix),
  );

  return decodedIxs;
}

export async function waitForNewPool(client: Client, args: SubscribeRequest): Promise<any> {
  return new Promise<any>(async (resolve, reject) => {
    // Subscribe for events
    const stream = await client.subscribe();
    logger.info("Waiting for new pool...");

    // Create `error` / `end` handler
    const streamClosed = new Promise<void>((resolveClose, rejectClose) => {
      stream.on("error", (error) => {
        console.log("ERROR", error);
        rejectClose(error);
        stream.end();
      });
      stream.on("end", () => {
        resolveClose();
      });
      stream.on("close", () => {
        resolveClose();
      });
    });

    // Handle updates
    stream.on("data", (data) => {
      try {
        if (data?.transaction) {
          const txn = TXN_FORMATTER.formTransactionFromJson(
            data.transaction,
            Date.now(),
          );
          const decodedRaydiumIxs = decodeRaydiumTxn(txn);

          if (!decodedRaydiumIxs?.length) return;
          const createPoolIx = decodedRaydiumIxs.find((decodedRaydiumIx) => {
            if (
              decodedRaydiumIx.name === "raydiumInitialize" ||
              decodedRaydiumIx.name === "raydiumInitialize2"
            ) {
              return decodedRaydiumIx;
            }
          });

          if (createPoolIx) {
            console.log("New LP found: \n")
            console.log(
              `Timestamp (UTC): ${new Date().toISOString()} \n`,
              `New LP Found \n SHYFT: https://translator.shyft.to/tx/${txn.transaction.signatures[0]} \n`,
              `SOLSCAN: https://solscan.io/tx/${txn.transaction.signatures[0]}?cluster=mainnet \n`,
              JSON.stringify(createPoolIx.args, null, 2) + "\n",
            );

            const info = JSON.stringify(createPoolIx.args);
            const parseInfo = JSON.parse(info);
            const poolData = {
              solVault: parseInfo.pool_pc_token_account,
              tokenVault: parseInfo.pool_coin_token_account,
              solAddress: parseInfo.pc_mint_address,
              tokenAddress: parseInfo.coin_mint_address,
              lpMint: parseInfo.lp_mint_address,
              pool: parseInfo.amm,
              dev_wallet: parseInfo.user_wallet,
              openTime: parseInfo.openTime,
              startTime: new Date(parseInfo.openTime * 1000),
              initialBalanceSOL: parseInfo.initPcAmount / 1e9,
              initialBalanceToken: parseInfo.initCoinAmount,
              tx: txn.transaction.signatures[0],
              shyft: `https://translator.shyft.to/tx/${txn.transaction.signatures[0]}`,
              solscan: `https://solscan.io/tx/${txn.transaction.signatures[0]}?cluster=mainnet`,
            };
            resolve(poolData); // <-- Return the found pool
            stream.end(); // <-- Stop the stream
          }
        }
      } catch (error) {
        if (error) {
          console.log("Error")
        }
      }
    });

    // Send subscribe request
    await new Promise<void>((resolveWrite, rejectWrite) => {
      stream.write(args, (err: any) => {
        if (err === null || err === undefined) {
          resolveWrite();
        } else {
          rejectWrite(err);
        }
      });
    }).catch((reason) => {
      console.error(reason);
      reject(reason);
    });

    await streamClosed;
  });
}

export async function getNextNewPool(client: Client, args: SubscribeRequest): Promise<any> {
  return new Promise((resolve) => {
    const startStream = async () => {
      const stream = await client.subscribe();
      logger.info("Waiting for new pool...");

      const closeStream = () => {
        try {
          stream.end?.();
          stream.destroy?.();
        } catch (_) {}
      };

      const restartStream = () => {
        closeStream();
        logger.warn("Stream interrupted. Restarting...");
        setTimeout(startStream, 1000); // restart after 1s
      };

      stream.on("error", (err: any) => {
        logger.warn(`Stream error ignored: ${err?.message || err}`);
        restartStream();
      });

      stream.on("end", () => {
        logger.warn("Stream ended. Restarting...");
        restartStream();
      });

      stream.on("close", () => {
        logger.warn("Stream closed. Restarting...");
        restartStream();
      });

      stream.on("data", (data) => {
        try {
          if (!data?.transaction) return;

          const txn = TXN_FORMATTER.formTransactionFromJson(data.transaction, Date.now());
          const decoded = decodeRaydiumTxn(txn);

          const poolIx = decoded.find(
            (ix) => ix.name === "raydiumInitialize" || ix.name === "raydiumInitialize2"
          );

          if (!poolIx) return;

          const info = JSON.stringify(poolIx.args);
          const parseInfo = JSON.parse(info);
          const poolData = {
            solVault: parseInfo.pool_pc_token_account,
            tokenVault: parseInfo.pool_coin_token_account,
            solAddress: parseInfo.pc_mint_address,
            tokenAddress: parseInfo.coin_mint_address,
            lpMint: parseInfo.lp_mint_address,
            pool: parseInfo.amm,
            dev_wallet: parseInfo.user_wallet,
            openTime: parseInfo.openTime,
            startTime: new Date(parseInfo.openTime * 1000),
            initialBalanceSOL: parseInfo.initPcAmount / 1e9,
            initialBalanceToken: parseInfo.initCoinAmount,
            tx: txn.transaction.signatures[0],
            shyft: `https://translator.shyft.to/tx/${txn.transaction.signatures[0]}`,
            solscan: `https://solscan.io/tx/${txn.transaction.signatures[0]}?cluster=mainnet`,
          };

          closeStream();
          resolve(poolData);
        } catch (err) {
          logger.warn("Error handling transaction, ignored:", err);
        }
      });

      // Send subscribe request
      stream.write(args, (err: any) => {
        if (err) {
          logger.warn("Stream write error ignored:", err);
          restartStream();
        }
      });
    };

    startStream(); // initial call
  });
}

async function main() {
  const newPool = await waitForNewPool(client, req);
  console.log("New Pool Found:", newPool);
  process.exit(0); // Close the script once it's done
}

main().catch(logger.error);