import { Keypair, PublicKey } from "@solana/web3.js";
import {
    wallet,
    private_key,
    connection,
    bloXRoute_auth_header,
    bloXRoute_api_env,
    wsol,
} from "./src/helpers/config";
import { sell } from "./src/raydium/sell_helper";
import { buy } from "./src/raydium/buy_helper";
import { getSPLTokenBalance, checkBalanceByAddress } from "./src/helpers/check_balance";
import { subscribeToPriceMcap } from "./src/raydium/real_time_token_price_marketcap_streaming/monitor";
import { client, req, waitForNewPool } from "./src/raydium/monitor_new_pools/stream_pools";
import logger from './logger';
import { getLatestTokenUpdate, getTradeBySignature } from "./logger";
import { token } from "@project-serum/anchor/dist/cjs/utils";
import { log, time } from "console";
import fs from 'fs/promises';
import path from 'path';

const pathForPrice = `./src/raydium/real_time_token_price_marketcap_streaming/`;
const LOG_PATH = path.join(__dirname, 'logs', 'latest_raydium_pool.log');

let lastKnownTimestamp = '';

export async function checkLatestPool(): Promise<{
    timestamp: string;
    args: Record<string, any>;
}> {
    return new Promise((resolve) => {
        const interval = setInterval(async () => {
            try {
                const content = await fs.readFile(LOG_PATH, 'utf-8');
                const timestampMatch = content.match(/Timestamp \(UTC\): ([^\n]+)/);
                const argsMatch = content.match(/Args:\s*(\{[\s\S]*\})/);

                if (timestampMatch && argsMatch) {
                    const timestamp = timestampMatch[1];
                    const timestampDate = new Date(timestamp);
                    const now = new Date();

                    // Check if the timestamp is within the last 1 minute
                    const elapsedTime = Math.floor((now.getTime() - timestampDate.getTime()) / 1000);
                    if (now.getTime() - timestampDate.getTime() <= 60 * 1000 && timestamp !== lastKnownTimestamp) {
                        lastKnownTimestamp = timestamp;
                        const argsJson = JSON.parse(argsMatch[1]);
                        clearInterval(interval);
                        resolve({ timestamp, args: argsJson });
                    } else {
                        console.warn(`Waiting for fresh pool data... Elapsed time: ${elapsedTime} seconds`);
                    }
                }
            } catch (err) {
                console.error('Failed to read log:', err);
            }
        }, 3000); // check every 3 seconds
    });
}


async function handleSell(message: string, tokenAddress: string, poolID: string, wallet: any) {
    logger.info(message);
    const balanceToSell = await getSPLTokenBalance(connection, new PublicKey(tokenAddress), wallet.publicKey);
    if (balanceToSell === 0) {
        logger.warn("No balance to sell. Skipping...");
        return;
    }
    let attempts = 0;
    while (attempts < 10) {
        const sell_res = await sell("sell", tokenAddress, poolID, 100, wallet);
        if (sell_res !== null) {
            logger.info("Sell successful.");
            break;
        }
        attempts++;
        logger.warn(`Sell attempt ${attempts} failed. Retrying...`);
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds before retrying
    }
    if (attempts === 10) {
        logger.error("Failed to sell after 10 attempts. Moving to the next pool...");
    }
    return;
}

async function handleBuy(message: string, tokenAddress: string, poolID: string, amountSol: number, wallet: any) {
    logger.info(message);
    let attempts = 0;
    while (attempts < 3) {
        const buy_res = await buy("buy", tokenAddress, poolID, amountSol, wallet);
        if (buy_res !== null) {
            logger.info("Trade opened successfully.");
            break;
        }
        attempts++;
        logger.warn(`Buy attempt ${attempts} failed. Retrying...`);
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds before retrying
    }
    if (attempts === 3) {
        logger.error("Failed to buy after 3 attempts. Moving to the next pool...");
    }
    return;
}

async function monitorPriceAndSell(tokenAddress: string, poolID: string, pathForPrice: any, wallet: any, entry_price: number, takeProfit: number, stopLoss: number, timeout: number) {
    const startTime = Date.now();

    while ((Date.now() - startTime) / 1000 < timeout - 5) {
        const current_trade = getLatestTokenUpdate(tokenAddress, pathForPrice);
        const current_price = current_trade?.priceInSOL;

        if (current_price !== undefined) {
            if (current_price >= takeProfit) {
                await handleSell("Take Profit hit! Current price: ${current_price}, Selling...", tokenAddress, poolID, wallet);
                break;
            } else if (current_price <= stopLoss) {
                await handleSell("Stop Loss hit! Current price: ${current_price}, Selling...", tokenAddress, poolID, wallet);
                break;
            }

            // if price increases update stop loss to 5% below current price
            if (current_price >= entry_price) {
                stopLoss = current_price * 0.95;
            }
            logger.info(`Current price: ${current_price}, stopLoss: ${stopLoss}`);
        } else {
            logger.warn("Unable to fetch current price.");
        }
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1s before next check
    }

    await handleSell("Timeout reached. Selling...", tokenAddress, poolID, wallet);
    logger.info("Exiting monitoring loop for this pool.");
    return;
}

async function main() {
    logger.info("starting BOT I...");
    while (true) {
        try {
            // Fetch initial WSOL balance
            const initialBalanceWSOL = await getSPLTokenBalance(connection, new PublicKey(wsol), wallet.publicKey);
            logger.info(`Initial WSOL balance: ${initialBalanceWSOL}`);

            // Exit if balance is less than 0.5
            if (initialBalanceWSOL < 0.4) {
                logger.warn("Insufficient WSOL balance. Exiting...");
                process.exit(1);
            }

            const pool = (await checkLatestPool()).args;
            logger.info(`New LP found: ${JSON.stringify(pool, null, 2)}`);

            let solReserves: number = 0;
            let tokenAddress: string = "";
            const poolAddress: string = pool?.amm ?? "";
            if (poolAddress === "") {
                logger.warn("No pool address found for this trade. Skipping.");
                continue;
            }

            if (pool?.pc_mint_address === wsol) {
                tokenAddress = pool?.coin_mint_address ?? ""; // Base
                solReserves = Number(pool?.initPcAmount ?? 0) / 1e9;
            } else {
                tokenAddress = pool?.pc_mint_address ?? ""; // Base
                solReserves = Number(pool?.initCoinAmount ?? 0) / 1e9;
            }
            const solAddress: string =  wsol; // WSOL (Quote)
            
            if (solReserves < 150) {
                logger.warn("Low reserves in the pool. Skipping this trade.");
                continue;
            }
        
            // const tokenAddress: string = "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr"; // POPCAT
            // const solAddress: string = wsol; // WSOL (Quote)
            // const poolAddress: string = "FRhB8L7Y9Qq41qZXYLtC2nw8An1RJfLLxRF2x9RwLLMo";  // Pool
            const sol: number = 0.05; // WSOL to swap
            let timeout: number = 60;
            if (solReserves === 150) {
                timeout = 40; // Trade exposure time
            }
    
            // Step 1: Buy token
            await handleBuy("Opening trade...", tokenAddress, poolAddress, sol, wallet);

            // Step 2: Start monitoring
            subscribeToPriceMcap(tokenAddress, solAddress, timeout + 5);
            logger.info("Price streaming started successfully");

            // Step 3: Entry price
            let entry_price: number | undefined = undefined;
            const startTime = Date.now();

            while ((Date.now() - startTime) / 1000 < 15) {
                const buy_trade = getLatestTokenUpdate(tokenAddress, pathForPrice);
                entry_price = buy_trade?.priceInSOL;

                if (entry_price !== undefined) {
                    break;
                }

                logger.warn("Entry price is undefined. Retrying...");
                await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second before retrying
            }

            if (entry_price === undefined) {
                logger.warn("Price data not flowing after 15 seconds. Selling.");
                await handleSell("Price data not flowing. Selling...", tokenAddress, poolAddress, wallet);
                continue;
            } else {
                logger.info(`Entry price: ${entry_price}`);
                const takeProfit = entry_price * 1.15;  // 10% profit
                let stopLoss: number = entry_price * 0.95;  // 5% loss
        
                // Step 4: Monitor price for take profit or stop loss
                logger.info(`Monitoring price...`);
                await monitorPriceAndSell(tokenAddress, poolAddress, pathForPrice, wallet, entry_price, takeProfit, stopLoss, timeout);
                logger.info("Monitoring completed successfully");

                // Step 5: Check final balance
                await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds before fetching final balance
                const finalBalance = await getSPLTokenBalance(connection, new PublicKey(wsol), wallet.publicKey);
                logger.info(`Final WSOL balance: ${finalBalance}`);
                logger.info(`-------------------------------------------------------`);
            }
            } catch (error) {
                logger.error("Restarting the stream...", error);
                await new Promise((r) => setTimeout(r, 1000));
            }
        }
}

async function run() {
    await main();
}

run().then(() => {
    logger.info("done!");
    process.exit(0);
});
