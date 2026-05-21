Installation & Local Deployment Setup
Follow these sequential steps to compile, deploy, and execute the LendChain ecosystem locally under your sandbox node instance.

Prerequisites
Node.js (v18.0.0 or higher recommended)

MetaMask Extension configured on your web browser.

1. Network Initialization & Smart Contract Compilation
Open an independent Terminal window to spin up your local in-memory blockchain node infrastructure:

Bash
cd backend

npm install

npx hardhat node
Leave this terminal window running continuously to host the network pipeline.

2. Explicit Contract Deployment Execution
Open a secondary terminal window to execute the custom deployment pipeline script:

Bash
node scripts/deploy.js
Upon successful execution, the terminal logs will output the explicit contract coordinates:

MockUSDT Address: 0x5FbDB2315678afecb367f032d93F642f64180aa3

LendChain Address: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512

3. Frontend Giao Diện UI Initialization
Open a third independent terminal instance to boot up your React Web Server app layout:

Bash

cd ../frontend


npm install

npm start
The browser will automatically spin up the interface dashboard panel at: http://localhost:3001 or http://localhost:3000.
