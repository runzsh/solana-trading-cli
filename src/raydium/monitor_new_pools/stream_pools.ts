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

export async function* subscribeToNewPoolStream(client: Client, args: SubscribeRequest): AsyncGenerator<any, void, unknown> {
  while (true) {
    try {
      yield* handleStream(client, args);
    } catch (error) {
      console.error("Stream error, restarting in 1 second...", error);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

async function* handleStream(client: Client, args: SubscribeRequest): AsyncGenerator<any, void, unknown> {
  const stream = await client.subscribe();

  const streamClosed = new Promise<void>((resolve, reject) => {
    stream.on("error", (error) => {
      logger.info(`ERROR: ${error}`);
      reject(error);
      stream.end();
    });
    stream.on("end", resolve);
    stream.on("close", resolve);
  });

  stream.on("data", (data) => {
    try {
      if (data?.transaction) {
        const txn = TXN_FORMATTER.formTransactionFromJson(data.transaction, Date.now());
        const decodedRaydiumIxs = decodeRaydiumTxn(txn);

        if (!decodedRaydiumIxs?.length) return;

        const createPoolIx = decodedRaydiumIxs.find(
          (ix) => ix.name === "raydiumInitialize" || ix.name === "raydiumInitialize2"
        );

        if (createPoolIx) {
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
            initialBalance: parseInfo.initPcAmount / 1e9,
            tx: txn.transaction.signatures[0],
          };

          logger.info(`New LP found: ${JSON.stringify(poolData, null, 2)}`);

          poolStreamController?.enqueue(poolData);
        }
      }
    } catch (err) {
      logger.info("Error processing transaction");
    }
  });

  await new Promise<void>((resolve, reject) => {
    stream.write(args, (err: any) => {
      if (err === null || err === undefined) {
        resolve();
      } else {
        reject(err);
      }
    });
  });

  const poolStream = new ReadableStream({
    start(controller) {
      poolStreamController = controller;
    },
    cancel() {
      poolStreamController = null;
    }
  });

  const reader = poolStream.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    yield value;
  }

  await streamClosed;
}

let poolStreamController: ReadableStreamDefaultController<any> | null = null;

export async function getNextNewPool(client: Client, args: SubscribeRequest): Promise<any> {
  return new Promise(async (resolve, reject) => {
    const stream = await client.subscribe();
    logger.info("Waiting for new pool...");

    // Clean-up helpers
    const closeStream = () => {
      try {
        stream.end?.();
        stream.destroy?.();
      } catch (e) {}
    };

    const onError = (err: any) => {
      logger.info(`Stream error: ${err}`);
      closeStream();
      reject(err);
    };

    stream.on("error", onError);
    stream.on("end", () => {
      closeStream();
      reject(new Error("Stream ended without receiving pool"));
    });
    stream.on("close", () => {
      closeStream();
      reject(new Error("Stream closed without receiving pool"));
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
          initialBalanceSOL: parseInfo.initPcAmount,
          initialBalanceToken: parseInfo.initCoinAmount,
          tx: txn.transaction.signatures[0],
          shyft: `https://translator.shyft.to/tx/${txn.transaction.signatures[0]}`,
          solscan: `https://solscan.io/tx/${txn.transaction.signatures[0]}?cluster=mainnet`,
        };

        closeStream();
        resolve(poolData);
      } catch (err) {
        logger.info("Error handling transaction", err);
      }
    });

    // Send subscribe request
    stream.write(args, (err: any) => {
      if (err) {
        closeStream();
        reject(err);
      }
    });
  });
}

// async function main() {
//   while (true) {
//     try {
//       const pool = await getNextNewPool(client, req);

//       // 💥 Process your pool here
//       console.log("🎯 New Pool:");
//       console.log(`TX: https://translator.shyft.to/tx/${pool.tx}`);
//       console.log(`Token Address: ${pool.tokenAddress}`);
//       console.log(`SOL Address: ${pool.solAddress}`);
//       console.log(`LP Mint: ${pool.lpMint}`);
//       console.log(`Initial Balance: ${pool.initialBalance} SOL`);
//       console.log(`Start Time: ${pool.startTime}`);
//       console.log(`Owner/Dev Wallet: ${pool.dev_wallet}`);
//       console.log("------------------------------");

//       // 💤 Optionally sleep before restarting
//       await new Promise((r) => setTimeout(r, 1000));

//     } catch (err) {
//       console.error("Error waiting for new pool. Retrying...", err);
//       await new Promise((r) => setTimeout(r, 1000));
//     }
//   }
// }

// main().catch(console.error);