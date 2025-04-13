## 🚀 About

**Solana Trading Client** is a free, highly efficient library designed to facilitate rapid development and deployment of custom trading strategies across multiple Solana decentralized exchanges (DEXs). It emphasizes low-latency performance, flexibility, and real-time data processing, utilizing cutting-edge infrastructure and well-established software design principles. These features ensure the following benefits:

* **Speed:** Leverages low-latency infrastructures like Jito and BloXroute to minimize trade execution times, giving your strategies a competitive edge.
* **Versatility:** Supports multiple DEXs, allowing for diverse trading opportunities and cross-platform arbitrage.
* **Real-time Insights:** Fetches and processes real-time live metrics using gRPC from liquidity pools, enabling data-driven decision making.

The library is built with modularity and extensibility in mind, employing software design patterns that promote:

* **Customizability:** Easily integrate your own trading strategies and extend the bot's functionality.
* **Testability:** Well-separated components facilitate comprehensive testing of individual modules.
* **Maintainability:** Clear structure and separation of concerns simplify ongoing development and updates.

Designed for seamless integration into existing trading systems, the Open-Source Low-Latency Trading Bot provides a robust foundation for both novice algo-traders and experienced quantitative analysts. Its open-source nature encourages community contributions and continuous improvement, ensuring the bot evolves alongside the fast-paced world of decentralized finance.
  

## 🛠️ Installation
Follow these steps to get your development environment set up:

1. **Clone the repository**
   ```bash
   git clone https://github.com/runzsh/solana-trading-cli.git
   ```

2. **Navigate to the project directory**
   ```bash
   cd solana-trading-cli
   ```

3. **Install the correct Node.js version**
   ```bash
   nvm install
   nvm use
   ```

4. **Install dependencies**
   ```bash
   npm install
   ```

5. **Run the test script**
   ```bash
   ts-node test.ts
   ```

### Installation Prerequisites

- [Node Version Manager (nvm)](https://github.com/nvm-sh/nvm)
- [Node.js](https://nodejs.org/) (version specified in `.nvmrc`)
- [npm](https://www.npmjs.com/) (comes with Node.js)


## 🚨 Set Up 

Before you begin, ensure you have completed the following steps:

### 1. Environment Configuration

1. Locate the template file:
   ```
   src/helpers/.env.example
   ```

2. Copy this file and rename it to `.env` in the same directory.

3. Open the `.env` file and add the following required information:
   - Mainnet wallet secret key (required)
   - RPC endpoint (required)
   - Custom Jito fee (if needed)

4. Optional configurations:
   - Devnet wallet secret key
   - Shyft API key

### 2. API Keys and Wallet Setup

- **Mainnet Wallet**: Ensure you have a funded Solana mainnet wallet. The secret key is required for mainnet transactions.
- **RPC Endpoint**: Obtain a reliable RPC endpoint for connecting to the Solana network.
- **Jito Integration**: If using Jito, prepare your custom fee configuration.
- **Devnet Wallet** (Optional): For testing purposes, set up a devnet wallet.
- **Shyft API** (Optional): If you plan to use Shyft services, obtain an API key from [Shyft](https://shyft.to/).

### 3. Final Check

- Confirm that your `.env` file is properly configured and saved.
- Ensure the `.env` file is in the correct location: `src/helpers/.env`
- Verify that you haven't accidentally committed your `.env` file to version control.

> ⚠️ **Security Note**: Never share or commit your `.env` file or any private keys. The `.env` file is included in `.gitignore` for your safety.

For any issues with configuration, please refer to our [Troubleshooting Guide](link-to-troubleshooting) or [open an issue](https://github.com/yourusername/your-repo-name/issues).
