import { Keypair, PublicKey } from "@solana/web3.js";
import {
    wallet,
    private_key,
    connection,
    bloXRoute_auth_header,
    bloXRoute_api_env,
} from "./src/helpers/config";
import { sell } from "./src/raydium/sell_helper";
import { buy } from "./src/raydium/buy_helper";
import { getSPLTokenBalance } from "./src/helpers/check_balance";
import { subscribeToPriceMcap } from "./src/raydium/real_time_token_price_marketcap_streaming/monitor";
import { client, req, getNextNewPool } from "./src/raydium/monitor_new_pools/stream_pools";
import logger from './logger';
import { getLatestTokenUpdate, getTradeBySignature } from "./logger";
import { token } from "@project-serum/anchor/dist/cjs/utils";

const pathForPrice = `./src/raydium/real_time_token_price_marketcap_streaming/`;
let pool: any = null;

async function main() {
    logger.info("starting BOT I...");

    while (true) {
        try {
            const pool = await getNextNewPool(client, req);
            logger.info(`New LP found: ${JSON.stringify(pool, null, 2)}`);
        
            const poolAddress: string = pool?.pool ?? "";
            if (poolAddress === "") {
                logger.warn("No pool address found for this trade. Skipping.");
                continue;
            }
            
            const tokenAddress: string = pool?.tokenAddress ?? ""; // Base
            const solAddress: string = pool?.solAddress ?? ""; // WSOL (Quote)
            const solReserves: number = Number(pool?.initialBalance ?? 0);
            
            if (solReserves < 150) {
                logger.warn("Low liquidity in the pool. Skipping this trade.");
                continue;
            }

            const sol: number = 0.01; // AMOUNT of WSOL to SWAP
            const timeout: number = 120; // Trade exposure time in seconds

            // Monitoring
            await subscribeToPriceMcap(tokenAddress, solAddress, timeout);
            logger.info("Monitoring started successfully");

            // Opening a trade using Raydium
            logger.info("Opening trade...");
            await buy("buy", tokenAddress, sol, wallet);

            // Check balance
            const outTokenPubkey = new PublicKey(tokenAddress);
            const outTokenBalance = await getSPLTokenBalance(connection, outTokenPubkey, wallet.publicKey);
            if (outTokenBalance === 0) {
                logger.warn("No balance found for this token. Trade failed. Skipping.");
                continue;
            }
            else {
                logger.info("Trade executed successfully! Token balance: " + outTokenBalance);
            }

            // Entry Trade Info
            const buy_trade = getLatestTokenUpdate(tokenAddress, pathForPrice);
            const entry_price = buy_trade?.priceInSOL;

            if (entry_price === undefined) {
                logger.warn("Entry price is undefined. Skipping this trade.");
                continue;
            }

            const startTime = Date.now();
            const takeProfit = entry_price * 1.10; // 10% profit
            let stopLoss: number = entry_price * 0.95; // 5% loss

            while ((Date.now() - startTime) / 1000 < timeout) {
                const current_trade = getLatestTokenUpdate(tokenAddress, pathForPrice);
                let current_price = current_trade?.priceInSOL;

                if (current_price !== undefined && current_price >= takeProfit) {
                logger.info(`Take Profit hit! Current price: ${current_price}, Selling...`);
                await sell("sell", tokenAddress, 100, wallet);
                break;
                } else if (current_price !== undefined && current_price <= stopLoss) {
                logger.info(`Stop Loss hit! Current price: ${current_price}, Selling...`);
                await sell("sell", tokenAddress, 100, wallet);
                break;
                }
                
                if (current_price !== undefined) {
                    stopLoss = current_price * 0.95; // Update stop loss to 5% below current price
                }
                logger.info(`Current price: ${current_price}, Monitoring...`);
                await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second before next check
            }

            logger.info("Exiting monitoring loop for this pool.");
                    
        } catch (error) {
            logger.error("Error waiting for new pool. Retrying...", error);
            await new Promise((r) => setTimeout(r, 1000));
        }

        logger.info("Moving to next pool...");
    }
}

async function run() {
    await main();
}

run().then(() => {
    logger.info("done!");
    process.exit(0);
});
