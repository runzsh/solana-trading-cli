import {
    LOCAL_API_WS, 
    MAINNET_API_UK_WS,
    TESTNET_API_WS, 
    WsProvider
} from "./src/bxsolana";
import { PublicKey } from "@solana/web3.js";
import {
    wallet,
    private_key,
    connection,
    bloXRoute_auth_header,
    bloXRoute_api_env,
    wsol
} from "./src/helpers/config";
import { sell } from "./src/raydium/sell";
import { buy } from "./src/raydium/buy";
import { getSPLTokenBalance } from "./src/helpers/check_balance";
import { subscribeToPriceMcap } from "./src/raydium/real_time_token_price_marketcap_streaming/monitor";
import logger from './logger';
import { getLatestTokenUpdate, getTradeBySignature } from "./logger";

const pathForPrice = `./src/raydium/real_time_token_price_marketcap_streaming/`;
let pool: any = null;

async function main() {
    logger.info("starting BOT I...");

    let provider: WsProvider;

    if (bloXRoute_api_env === "testnet") {
        provider = new WsProvider(
            bloXRoute_auth_header || "",
            private_key,
            TESTNET_API_WS
        );
    } else if (bloXRoute_api_env === "mainnet") {
        provider = new WsProvider(
            bloXRoute_auth_header || "",
            private_key,
            MAINNET_API_UK_WS
        );
    } else {
        provider = new WsProvider(
            bloXRoute_auth_header || "",
            private_key,
            LOCAL_API_WS
        );
    }

    while (true) {
        try {
            await provider.connect();
            logger.info("Subscribing for new raydium pool updates");
        
            const req = await provider.getNewRaydiumPoolsStream({});
            let count = 0;
            let pool: any = null;
        
            for await (const tr of req) {
                pool = tr;
                count++;
                if (count === 1) {
                    logger.info("Received new pool");
                    logger.info("Pool Details:\n" + JSON.stringify(pool, null, 2));
                    logger.info("Closing stream...");
                    provider.close();
                    break;
                }
            }
        
            logger.info("Moving forward to trade...");
        
            const poolAddress: string = pool?.pool?.poolAddress ?? "";
            if (poolAddress === "") {
                logger.warn("No pool address found for this trade. Skipping.");
                return;
            }
        
            const inToken: string = pool?.pool?.token1MintAddress ?? ""; // WSOL
            const outToken: string = pool?.pool?.token2MintAddress ?? "";
            const solReserves: number = Number(pool?.pool?.token2Reserves ?? 0);
            
            if (solReserves < 150) {
                logger.warn("Low liquidity in the pool. Skipping this trade.");
                return;
            }

            const sol: number = 0.01; // AMOUNT of WSOL to SWAP
            const timeout: number = 180; // Trade exposure time in seconds

            // Monitoring
            await subscribeToPriceMcap(outToken, inToken, timeout);
            logger.info("Monitoring started successfully");
                    
        } catch (error) {
            logger.error("An error occurred:", error);
        }


        // // Opening a trade using Raydium
        // logger.info("Opening trade...");
        // buy("buy", outToken, sol, wallet);

        // // Check balance
        // const outTokenPubkey = new PublicKey(outToken);
        // const outTokenBalance = await getSPLTokenBalance(connection, outTokenPubkey, wallet.publicKey);
        // if (outTokenBalance === 0) {
        //     logger.warn("No balance found for this token. Trade failed. Skipping.");
        //     continue;
        // }
        // else {
        //     logger.info("Trade executed successfully! Token balance: " + outTokenBalance);
        // }

        // // Entry Trade Info
        // const buy_trade = getLatestTokenUpdate(outToken, pathForPrice);
        // const entry_price = buy_trade?.priceInSOL;

        // if (entry_price === undefined) {
        //     logger.warn("Entry price is undefined. Skipping this trade.");
        //     continue;
        // }

        // const startTime = Date.now();
        // const takeProfit = entry_price * 1.10; // 10% profit
        // const stopLoss = entry_price * 0.95; // 5% loss

        // while ((Date.now() - startTime) / 1000 < timeout) {
        //     const current_trade = getLatestTokenUpdate(outToken, pathForPrice);
        //     const current_price = current_trade?.priceInSOL;

        //     if (current_price !== undefined && current_price >= takeProfit) {
        //     logger.info(`Take Profit hit! Current price: ${current_price}, Selling...`);
        //     sell("sell", outToken, 100, wallet);
        //     break;
        //     } else if (current_price !== undefined && current_price <= stopLoss) {
        //     logger.info(`Stop Loss hit! Current price: ${current_price}, Selling...`);
        //     sell("sell", outToken, 100, wallet);
        //     break;
        //     }
            
        //     // const stopLoss = current_price * 0.95; // Update stop loss to 5% below current price
        //     logger.info(`Current price: ${current_price}, Monitoring...`);
        //     await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second before next check
        // }

        // logger.info("Exiting monitoring loop for this pool.");

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

