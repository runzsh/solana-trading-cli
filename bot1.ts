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
import { getSPLTokenBalance } from "./src/helpers/check_balance";
import { subscribeToPriceMcap } from "./src/raydium/real_time_token_price_marketcap_streaming/monitor";
import { client, req, getNextNewPool } from "./src/raydium/monitor_new_pools/stream_pools";
import logger from './logger';
import { getLatestTokenUpdate, getTradeBySignature } from "./logger";
import { token } from "@project-serum/anchor/dist/cjs/utils";
import { time } from "console";

const pathForPrice = `./src/raydium/real_time_token_price_marketcap_streaming/`;
let pool: any = null;

async function monitorPriceAndSell(tokenAddress: string, poolID: string, pathForPrice: any, wallet: any, entry_price: number, takeProfit: number, stopLoss: number, timeout: number) {
    const startTime = Date.now();

    while ((Date.now() - startTime) / 1000 < timeout - 5) {
        const current_trade = getLatestTokenUpdate(tokenAddress, pathForPrice);
        const current_price = current_trade?.priceInSOL;

        if (current_price !== undefined) {
            if (current_price >= takeProfit) {
                logger.info(`Take Profit hit! Current price: ${current_price}, Selling...`);
                let attempts = 0;
                while (attempts < 3) {
                    const sell_res = await sell("sell", tokenAddress, poolID, 100, wallet);
                    if (sell_res !== null) {
                        logger.info("Sell successful.");
                        break;
                    }
                    attempts++;
                    logger.warn(`Sell attempt ${attempts} failed. Retrying...`);
                }
                if (attempts === 3) {
                    logger.error("Failed to sell after 3 attempts. Moving to the next pool...");
                }
                break;
            } else if (current_price <= stopLoss) {
                logger.info(`Stop Loss hit! Current price: ${current_price}, Selling...`);
                let attempts = 0;
                while (attempts < 3) {
                    const sell_res = await sell("sell", tokenAddress, poolID, 100, wallet);
                    if (sell_res !== null) {
                        logger.info("Sell successful.");
                        break;
                    }
                    attempts++;
                    logger.warn(`Sell attempt ${attempts} failed. Retrying...`);
                }
                if (attempts === 3) {
                    logger.error("Failed to sell after 3 attempts. Moving to the next pool...");
                }
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

    logger.info("Exiting monitoring loop for this pool.");
    let attempts = 0;
    while (attempts < 3) {
        const sell_res = await sell("sell", tokenAddress, poolID, 100, wallet);
        if (sell_res !== null) {
            logger.info("Final sell successful.");
            break;
        }
        attempts++;
        logger.warn(`Final sell attempt ${attempts} failed. Retrying...`);
    }
    if (attempts === 3) {
        logger.error("Failed to sell after 3 final attempts. Moving to the next pool...");
    }
}

async function main() {
    logger.info("starting BOT I...");
    while (true) {
        try {
            const pool = await getNextNewPool(client, req);
            logger.info(`New LP found: ${JSON.stringify(pool, null, 2)}`);

            let solReserves: number = 0;
            let tokenAddress: string = "";
            const poolAddress: string = pool?.pool ?? "";
            if (poolAddress === "") {
                logger.warn("No pool address found for this trade. Skipping.");
                continue;
            }

            if (pool?.solAddress === wsol) {
                tokenAddress = pool?.tokenAddress ?? ""; // Base
                solReserves = Number(pool?.initialBalanceSOL ?? 0) / 1e9;
            } else {
                tokenAddress = pool?.solAddress ?? ""; // Base
                solReserves = Number(pool?.initialBalanceToken ?? 0) / 1e9;
            }
            const solAddress: string =  wsol; // WSOL (Quote)
            
            if (solReserves < 150) {
                logger.warn("Low reserves in the pool. Skipping this trade.");
                continue;
            }
        
            // const tokenAddress: string = "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr"; // Base
            // const solAddress: string = wsol; // WSOL (Quote)
            // const poolAddress: string = "FRhB8L7Y9Qq41qZXYLtC2nw8An1RJfLLxRF2x9RwLLMo";
            const sol: number = 0.01; // WSOL to swap
            let timeout: number = 60;
            // if (solReserves === 150) {
            //     timeout = 40; // Trade exposure time
            // }
    
            // Step 1: Buy token
            await new Promise((resolve) => setTimeout(resolve, 3000)); // Wait 3 seconds before opening trade
            logger.info("Opening trade...");
            const buy_res = await buy("buy", tokenAddress, poolAddress, sol, wallet);
            if (buy_res === null) {
                logger.error("Failed to open trade. Moving to the next pool...");
                continue;
            }
            logger.info("Trade opened successfully");

            // Step 2: Start monitoring
            subscribeToPriceMcap(tokenAddress, solAddress, timeout + 5);
            logger.info("Price streaming started successfully");

            // Step 3: Entry price
            await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds for stream
            const buy_trade = getLatestTokenUpdate(tokenAddress, pathForPrice);
            const entry_price = buy_trade?.priceInSOL;
    
            if (entry_price === undefined) {
                logger.warn("Entry price is undefined. Skipping this trade.");
                continue;
            }
    
            const takeProfit = entry_price * 1.10;  // 10% profit
            let stopLoss: number = entry_price * 0.95;  // 5% loss
    
            // Step 4: Monitor price for take profit or stop loss
            logger.info(`Monitoring price...`);
            await monitorPriceAndSell(tokenAddress, poolAddress, pathForPrice, wallet, entry_price, takeProfit, stopLoss, timeout);
            logger.info("Monitoring completed successfully");

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
