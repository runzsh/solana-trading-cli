import { createLogger, format, transports } from 'winston';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Get the latest update for a token from its log file.
 */
export function getLatestTokenUpdate(tokenAddress: string, folderPath: string): {
  priceInSOL: number;
  timestamp: string;
  lastUpdate: number;
  signature: string;
} | null {
  const filePath = path.join(folderPath, `${tokenAddress}.log`);

  if (!fs.existsSync(filePath)) {
    // console.warn(`Log file not found: ${filePath}. Creating a new one.`);
    fs.writeFileSync(filePath, '', 'utf-8');
  }

  const logLines = fs.readFileSync(filePath, 'utf-8').trim().split('\n');

  const lastSeparatorIndex = logLines.lastIndexOf('==============================');
  if (lastSeparatorIndex === -1) return null;

  let startIndex = lastSeparatorIndex;
  while (startIndex >= 0 && !logLines[startIndex].startsWith('[')) {
    startIndex--;
  }
  if (startIndex < 0) return null;

  const lastBlock = logLines.slice(startIndex, lastSeparatorIndex + 1);

  const timestampStr = lastBlock[0].match(/\[(.*?)\]/)?.[1];
  const updateTime = timestampStr ? new Date(timestampStr) : null;

  const priceLine = lastBlock.find(line => line.includes('Price in SOL'));
  const priceInSOL = parseFloat(priceLine!.split(':')[1].trim());

  const signatureLine = lastBlock.find(line => line.startsWith('signature:'));
  const signature = signatureLine?.split('signature:')[1].trim() || 'unknown';

  if (!updateTime || priceInSOL === null) return null;

  const now = new Date();
  const lastUpdate = Math.floor((now.getTime() - updateTime.getTime()) / 1000);

  return {
    priceInSOL,
    timestamp: updateTime.toISOString(),
    lastUpdate,
    signature
  };
}

/**
 * Find a trade entry by signature from the token's log file.
 */
export function getTradeBySignature(tokenAddress: string, folderPath: string, signatureToFind: string): {
    priceInSOL: number;
    timestamp: string;
    signature: string;
  } | null {
    const filePath = path.join(folderPath, `${tokenAddress}.log`);
    if (!fs.existsSync(filePath)) {
      console.error(`Log file not found: ${filePath}`);
      return null;
    }
  
    const logLines = fs.readFileSync(filePath, 'utf-8').trim().split('\n');
  
    for (let i = 0; i < logLines.length; i++) {
      if (logLines[i].startsWith('signature:') && logLines[i].includes(signatureToFind)) {
        // Walk up to timestamp line
        let startIndex = i;
        while (startIndex >= 0 && !logLines[startIndex].startsWith('[')) {
          startIndex--;
        }
  
        // Walk down to separator
        let endIndex = i;
        while (endIndex < logLines.length && logLines[endIndex] !== '==============================') {
          endIndex++;
        }
  
        const block = logLines.slice(startIndex, endIndex + 1);
        const timestampStr = block[0].match(/\[(.*?)\]/)?.[1];
        const priceLine = block.find(line => line.includes('Price in SOL'));
        const marketCapLine = block.find(line => line.includes('MarketCap'));
        const poolLineIndex = block.findIndex(line => line.includes('PoolInfo'));
        const poolLine1 = block[poolLineIndex + 1]?.trim();
        const poolLine2 = block[poolLineIndex + 2]?.trim();
  
        const updateTime = timestampStr ? new Date(timestampStr) : null;
        const priceInSOL = priceLine ? parseFloat(priceLine.split(':')[1].trim()) : null;
  
        if (!updateTime || priceInSOL === null) {
          return null;
        }
  
        return {
          priceInSOL,
          timestamp: updateTime.toISOString(),
          signature: signatureToFind,
        };
      }
    }
  
    return null;
}

const logger = createLogger({
    level: 'info',
    format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.printf(({ timestamp, level, message }) => {
            return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
        })
    ),
    transports: [
        new transports.File({ filename: 'logs/bot1.log' }),
        new transports.Console()
    ]
});

export default logger;