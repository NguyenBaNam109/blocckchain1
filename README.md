# LendChain – Decentralized Peer-to-Peer Lending Protocol
 
LendChain is a decentralized peer-to-peer (P2P) crypto lending application developed for INTE2641/INTE2642 – Blockchain Technology Fundamentals.
 
Unlike traditional DeFi lending protocols that rely on pooled liquidity models, LendChain enables borrowers and lenders to negotiate loan terms directly through a trustless smart contract system. The platform supports ETH-backed collateralized lending using ERC-20 USDT tokens on an Ethereum-compatible environment.
 
The system is built using:
- Solidity
- Hardhat
- React
- Ethers.js v6
- MetaMask
- OpenZeppelin Contracts
 
---
 
# Project Structure
 
```text
/backend   → Solidity smart contracts, deployment scripts, Hardhat tests
/frontend  → React frontend with Ethers.js and MetaMask integration
```
 
---
 
# Prerequisites
 
Before running the project locally, ensure the following are installed:
 
- Node.js (v18 or later recommended)
- npm
- MetaMask browser extension
 
---
 
# Local Setup & Deployment
 
## 1. Start the Local Hardhat Network
 
Open a terminal and run:
 
```bash
cd backend
npm install
npx hardhat node
```
 
Keep this terminal running.
 
The local Hardhat node will start on:
 
```text
http://127.0.0.1:8545
```
 
and automatically generate 20 pre-funded test accounts.
 
---
 
## 2. Deploy Smart Contracts
 
Open a second terminal:
 
```bash
cd backend
npx hardhat run scripts/deploy.js --network localhost
```
 
After deployment, the terminal will display the contract addresses:
 
```text
MockUSDT Address: 0x...
LendChain Address: 0x...
```
 
Update the frontend configuration file with these addresses if required.
 
Example:
 
```text
/frontend/src/config.js
```
 
or
 
```text
/frontend/.env
```
 
---
 
## 3. Start the Frontend Application
 
Open a third terminal:
 
```bash
cd frontend
npm install
npm start
```
 
The application will launch at:
 
```text
http://localhost:3000
```
 
---
 
# MetaMask Configuration
 
## Add the Hardhat Local Network
 
In MetaMask:
 
1. Open the network selector
2. Click **Add network manually**
3. Enter the following details:
 
```text
Network Name: Hardhat Localhost
RPC URL: http://127.0.0.1:8545
Chain ID: 31337
Currency Symbol: ETH
```
 
Save the network and switch MetaMask to it.
 
---
 
## Import Hardhat Test Accounts
 
The Hardhat node generates multiple pre-funded test wallets.
 
Copy a private key from the terminal running:
 
```bash
npx hardhat node
```
 
Then in MetaMask:
 
1. Click account icon
2. Select **Import Account**
3. Paste the private key
 
Import at least:
- one borrower account
- one lender account
 
Each account will contain test ETH for local transactions.
 
---
 
# Demo Walkthrough
 
## Phase 1 – Loan Creation
 
1. Connect the borrower wallet.
2. Mint mock USDT tokens using the testing utility.
3. Navigate to **Create Loan**.
4. Enter loan parameters:
   - Loan amount
   - ETH collateral
   - Interest rate
   - Loan duration
5. Submit the transaction through MetaMask.
 
The loan request will appear in the marketplace as `Pending`.
 
---
 
## Phase 2 – Negotiation & Funding
 
1. Switch to the lender wallet.
2. Open the pending loan request.
3. Submit a counter-offer (optional).
4. Switch back to the borrower wallet and accept the offer.
5. Deposit ETH collateral.
6. Switch back to the lender wallet.
 
Funding requires two transactions:
 
### Step 1 – Approve USDT
 
```text
Approve ERC-20 allowance
```
 
### Step 2 – Fund Loan
 
```text
Execute fundLoan()
```
 
Once completed:
- USDT is transferred to the borrower
- the loan state changes to `Active`
 
---
 
## Phase 3 – Loan Repayment
 
1. Switch back to the borrower wallet after the loan has been funded.
 
2. Navigate to the Active Loans dashboard and locate the funded loan.
 
3. Before repayment can occur, the borrower must approve the LendChain contract to transfer the required USDT repayment amount.
 
### Step 1 – Approve USDT
 
```text
Approve ERC-20 allowance for repayment
```
 
4. After the approval transaction is confirmed, click:
 
```text
Repay Loan
```
 
to execute the `repayLoan()` smart contract function.
 
5. Once the transaction is completed:
- the lender receives the repayment amount plus interest
- the borrower’s ETH collateral is automatically released
- the loan state updates to `Repaid`
 
The completed transaction and updated loan status will immediately appear on the dashboard interface.
 
---
 
# Running Hardhat Tests
 
From the backend directory:
 
```bash
npx hardhat test
```
 
The test suite validates:
- loan creation
- collateral deposits
- funding
- repayment
- default handling
- invalid state transitions
- access control restrictions
 
---
 
# Technologies Used
 
| Component | Technology |
|---|---|
| Smart Contracts | Solidity |
| Development Framework | Hardhat |
| Frontend | React |
| Blockchain Interaction | Ethers.js v6 |
| Wallet Integration | MetaMask |
| Token Standard | ERC-20 |
| Contract Libraries | OpenZeppelin |
| Test Network | Sepolia / Hardhat Localhost |
 
---
 
# Academic & LLM Attribution
 
This project was developed for RMIT University course INTE2641/INTE2642 – Blockchain Technology Fundamentals.
 
Generative AI tools including ChatGPT and Gemini were used selectively for:
- debugging frontend Ethers.js interactions
- troubleshooting Hardhat testing workflows
- refining documentation and setup instructions
 
All final implementation, testing, and design decisions were reviewed and validated by the project team.