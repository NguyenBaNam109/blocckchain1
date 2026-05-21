import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';

async function main() {
  console.log("Starting deployment with explicit nonce management...");

  // 1. Kết nối tới trạm Blockchain Hardhat đang chạy trên máy của bạn
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  const privateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log("Deploying contracts with account:", wallet.address);

  // Hỏi trực tiếp Blockchain số Nonce chính xác đang chờ xử lý (pending) tại thời điểm này
  let currentNonce = await provider.getTransactionCount(wallet.address, "pending");
  console.log(`Current network pending nonce fetched: ${currentNonce}`);

  // 2. Đọc file dữ liệu đã biên dịch của MockUSDT
  const mockUsdtPath = path.resolve("./artifacts/contracts/MockUSDT.sol/MockUSDT.json");
  const mockUsdtArtifact = JSON.parse(fs.readFileSync(mockUsdtPath, "utf8"));

  // 3. Tiến hành triển khai MockUSDT với số Nonce chỉ định thủ công
  console.log(`Deploying MockUSDT with explicit nonce: ${currentNonce}`);
  const MockUSDTFactory = new ethers.ContractFactory(mockUsdtArtifact.abi, mockUsdtArtifact.bytecode, wallet);
  // Truyền cấu hình nonce trực tiếp vào hàm deploy
  const mockUSDT = await MockUSDTFactory.deploy({ nonce: currentNonce });
  await mockUSDT.waitForDeployment();
  const usdtAddress = await mockUSDT.getAddress();
  console.log("MockUSDT deployed to:", usdtAddress);

  // TĂNG NONCE LÊN CHÍNH XÁC 1 ĐƠN VỊ CHO GIAO DỊCH TIẾP THEO
  currentNonce++;

  // 4. Đọc file dữ liệu đã biên dịch của LendChain
  const lendChainPath = path.resolve("./artifacts/contracts/LendChain.sol/LendChain.json");
  const lendChainArtifact = JSON.parse(fs.readFileSync(lendChainPath, "utf8"));

  // 5. Tiến hành triển khai LendChain với số Nonce tiếp theo được chỉ định thủ công
  console.log(`Deploying LendChain with explicit nonce: ${currentNonce}`);
  const LendChainFactory = new ethers.ContractFactory(lendChainArtifact.abi, lendChainArtifact.bytecode, wallet);
  // Truyền tham số constructor usdtAddress kèm theo object override chứa nonce thủ công
  const lendChain = await LendChainFactory.deploy(usdtAddress, { nonce: currentNonce });
  await lendChain.waitForDeployment();
  const lendChainAddress = await lendChain.getAddress();
  
  console.log("====================================");
  console.log("MockUSDT deployed to:", usdtAddress);
  console.log("LendChain deployed to:", lendChainAddress);
  console.log("====================================");
  console.log("Deployment completed successfully!");
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});