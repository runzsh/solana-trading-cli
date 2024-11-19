import { getCurrentPriceInSOL, getCurrentPriceInUSD } from "./fetch-price";
async function main() {
  const tokenAddress = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";
  const currentTokenPriceInSOL = await getCurrentPriceInSOL(tokenAddress);
  const currentTokenPriceInUSD = await getCurrentPriceInUSD(tokenAddress);
  console.log(`Current price in SOL: ${currentTokenPriceInSOL}`);
  console.log(`Current price in USD: ${currentTokenPriceInUSD}`);
}

main();
