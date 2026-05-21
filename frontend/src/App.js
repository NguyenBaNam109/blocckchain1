import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

// Compact ERC-20 ABI definitions for token allowance monitoring
const USDT_ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 value) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function mint(address to, uint256 amount) returns (bool)"
];

// Compact application ABI definitions for LendChain interactions
const LENDCHAIN_ABI = [
  "function fundLoan(uint256 _loanId) external payable", 
  "function repayLoan(uint256 _loanId) external"
];

// Preserving your exact successful contract deployment addresses
const LendChainContractAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"; 
const UsdtContractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

function App() {
  const [account, setAccount] = useState("");
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [txStatus, setTxStatus] = useState("idle"); 
  const [currentAllowance, setCurrentAllowance] = useState(0);
  
  // Dynamic Web3 wallet balance states
  const [usdtBalance, setUsdtBalance] = useState("0");
  const [ethBalance, setEthBalance] = useState("0");
  const [activeTab, setActiveTab] = useState("market"); // market | create | dashboard
  
  // State for custom deposit amounts
  const [depositAmount, setDepositAmount] = useState("1000");

  // State for custom counter offer APR fields
  const [counterInputs, setCounterInputs] = useState({});
  
  // State tracking dynamic specific card execution contexts
  const [activeLoanId, setActiveLoanId] = useState(null);
  
  // Form submission state for Lenders creating new offers
  const [formData, setFormData] = useState({ amount: "100", collateral: "0.15", interest: '10', duration: "30" });

  // 20 Active Mock Pools (Tất cả bắt đầu bằng trạng thái Available để mục Active Positions trống sẵn)
  const [loans, setLoans] = useState([
    { id: 1, lender: "0xf39Fd...2266", amount: 100, collateralRequired: 0.05, interest: 10, duration: 30, status: "Available", hasCounter: false },
    { id: 2, lender: "0x70991...7a65", amount: 500, collateralRequired: 0.25, interest: 12, duration: 60, status: "Available", hasCounter: false },
    { id: 3, lender: "0x3C44C...3829", amount: 1200, collateralRequired: 0.60, interest: 8.5, duration: 90, status: "Available", hasCounter: false },
    { id: 4, lender: "0x90F79...1722", amount: 250, collateralRequired: 0.12, interest: 11, duration: 14, status: "Available", hasCounter: false },
    { id: 5, lender: "0x15d34...6371", amount: 3000, collateralRequired: 1.50, interest: 7.8, duration: 180, status: "Available", hasCounter: false },
    { id: 6, lender: "0x23616...8110", amount: 750, collateralRequired: 0.35, interest: 9.2, duration: 45, status: "Available", hasCounter: false },
    { id: 7, lender: "0xcd3B7...4411", amount: 150, collateralRequired: 0.08, interest: 13.5, duration: 7, status: "Available", hasCounter: false },
    { id: 8, lender: "0xa0Ee7...9281", amount: 4500, collateralRequired: 2.20, interest: 6.9, duration: 365, status: "Available", hasCounter: false },
    { id: 9, lender: "0xBcd40...5521", amount: 800, collateralRequired: 0.40, interest: 9.8, duration: 30, status: "Available", hasCounter: false },
    { id: 10, lender: "0x71C76...9923", amount: 2000, collateralRequired: 1.00, interest: 8.2, duration: 120, status: "Available", hasCounter: false },
    { id: 11, lender: "0x32174...1122", amount: 350, collateralRequired: 0.18, interest: 10.5, duration: 21, status: "Available", hasCounter: false },
    { id: 12, lender: "0xAAeE8...8833", amount: 6000, collateralRequired: 3.10, interest: 7.2, duration: 270, status: "Available", hasCounter: false },
    { id: 13, lender: "0xF339b...4455", amount: 120, collateralRequired: 0.06, interest: 14, duration: 14, status: "Available", hasCounter: false },
    { id: 14, lender: "0x2281a...9900", amount: 950, collateralRequired: 0.48, interest: 9.0, duration: 60, status: "Available", hasCounter: false },
    { id: 15, lender: "0x88CcB...1122", amount: 1500, collateralRequired: 0.75, interest: 8.8, duration: 90, status: "Available", hasCounter: false },
    { id: 16, lender: "0x99bBd...3344", amount: 400, collateralRequired: 0.20, interest: 11.5, duration: 30, status: "Available", hasCounter: false },
    { id: 17, lender: "0x55aaF...7788", amount: 8000, collateralRequired: 4.15, interest: 6.5, duration: 365, status: "Available", hasCounter: false },
    { id: 18, lender: "0xddEE9...0011", amount: 650, collateralRequired: 0.32, interest: 10.2, duration: 45, status: "Available", hasCounter: false },
    { id: 19, lender: "0x44bBa...5566", amount: 1800, collateralRequired: 0.90, interest: 8.0, duration: 120, status: "Available", hasCounter: false },
    { id: 20, lender: "0x11122...99aa", amount: 300, collateralRequired: 0.15, interest: 12.0, duration: 30, status: "Available", hasCounter: false }
  ]);

  // Làm mới thông tin số dư ví thông qua BrowserProvider của MetaMask
  const refreshAccountData = async (userAddress) => {
    if (!userAddress || !window.ethereum) return;
    try {
      const freshProvider = new ethers.BrowserProvider(window.ethereum);
      
      const balance = await freshProvider.getBalance(userAddress);
      setEthBalance(parseFloat(ethers.formatEther(balance)).toFixed(2));

      const usdtContract = new ethers.Contract(UsdtContractAddress, USDT_ABI, freshProvider);
      const uBalance = await usdtContract.balanceOf(userAddress);
      setUsdtBalance(ethers.formatEther(uBalance));

      const allowance = await usdtContract.allowance(userAddress, LendChainContractAddress);
      setCurrentAllowance(Number(ethers.formatEther(allowance)));
    } catch (err) {
      console.error("Failed to sync wallet data metrics:", err);
    }
  };

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        await window.ethereum.request({
          method: 'wallet_requestPermissions',
          params: [{ eth_accounts: {} }]
        });

        const web3Provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const web3Signer = await web3Provider.getSigner();
        
        setAccount(accounts[0]);
        setProvider(web3Provider);
        setSigner(web3Signer);
        
        await refreshAccountData(accounts[0]);
      } catch (error) {
        console.error("User rejected wallet connection selection:", error);
      }
    } else {
      alert("Please install MetaMask extension to interact with LendChain!");
    }
  };

  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = async (accounts) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          const web3Provider = new ethers.BrowserProvider(window.ethereum);
          const web3Signer = await web3Provider.getSigner();
          setProvider(web3Provider);
          setSigner(web3Signer);
          await refreshAccountData(accounts[0]);
        } else {
          setAccount("");
        }
      };
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      return () => window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
    }
  }, []);

  // 🆕 TỐI ƯU HÓA: Cơ chế quét lũy tiến (Progressive Polling) sau khi Deposit thành công
  const handleDepositUSDT = async () => {
    if (!signer) return;
    const tokensToMint = parseInt(depositAmount);
    if (isNaN(tokensToMint) || tokensToMint <= 0) {
      alert("Please enter a valid positive USDT amount to deposit!");
      return;
    }

    try {
      setTxStatus("depositing");
      const usdtContract = new ethers.Contract(UsdtContractAddress, USDT_ABI, signer);
      
      const amountInWei = ethers.parseEther(tokensToMint.toString());
      const tx = await usdtContract.mint(account, amountInWei);
      
      setTxStatus("pending_tx");
      await tx.wait(); 
      
      // 🚀 Thực thi cơ chế đa đồng bộ ngầm sau mỗi giây để ép UI bắt kịp MetaMask
      await refreshAccountData(account);
      setTimeout(() => refreshAccountData(account), 1000);
      setTimeout(() => refreshAccountData(account), 2000);
      setTimeout(() => refreshAccountData(account), 3000);
      
      alert(`Deposit Success! ${tokensToMint.toLocaleString()} USDT has been credited to your wallet.`);
      setTxStatus("idle");
    } catch (err) {
      console.error("Deposit execution error:", err);
      setTxStatus("idle");
    }
  };

  // Lender posts a new capital offer
  const handleCreateLendingOffer = async (e) => {
    e.preventDefault();
    if (!signer) return;

    const offerAmount = parseFloat(formData.amount);
    if (Number(usdtBalance) < offerAmount) {
      alert("Insufficient USDT balance to create this offer! Please deposit USDT using the action button above.");
      return;
    }

    try {
      if (currentAllowance < offerAmount) {
        setTxStatus("approving");
        const usdtContract = new ethers.Contract(UsdtContractAddress, USDT_ABI, signer);
        const approveTx = await usdtContract.approve(LendChainContractAddress, ethers.parseEther("1000000"));
        setTxStatus("pending_tx");
        await approveTx.wait();
        await refreshAccountData(account);
      }

      const newId = loans.length + 1;
      const newOfferItem = {
        id: newId,
        lender: account.substring(0, 7) + "..." + account.substring(account.length - 4),
        amount: offerAmount,
        collateralRequired: parseFloat(formData.collateral),
        interest: parseFloat(formData.interest),
        duration: parseInt(formData.duration),
        status: "Available",
        hasCounter: false
      };

      setLoans([...loans, newOfferItem]);
      alert("Success! Your lending capital offer has been safely listed on the Marketplace.");
      setTxStatus("idle");
      setActiveTab("market");
    } catch (err) {
      console.error(err);
      setTxStatus("idle");
    }
  };

  // Borrower initiates a Counter-Offer negotiation request
  const handleNegotiateOffer = (id, targetApr) => {
    const parsedApr = parseFloat(targetApr);
    if (isNaN(parsedApr) || parsedApr <= 0 || parsedApr > 100) {
      alert("Please enter a valid interest rate percentage (e.g., 5.5 or 8)!");
      return;
    }

    setLoans(loans.map(l => l.id === id ? { ...l, interest: parsedApr, hasCounter: true } : l));
    alert(`Negotiation submitted! You have proposed a custom counter interest rate of ${parsedApr}% APR.`);
  };

  // Borrower accepts the Lender's offer (Và đưa gói vay đó vào Active Positions)
  const handleAcceptLoanOffer = async (loanId) => {
    if (!signer) return;
    
    const loanItem = loans.find(l => l.id === loanId);
    if (!loanItem) {
      alert("Loan agreement pool not found!");
      return;
    }

    const lendChainContract = new ethers.Contract(LendChainContractAddress, LENDCHAIN_ABI, signer);

    try {
      setActiveLoanId(loanId); 
      setTxStatus("funding"); 
      
      const collateralInWei = ethers.parseEther(loanItem.collateralRequired.toString());
      const tx = await lendChainContract.fundLoan(loanId, { value: collateralInWei });
      
      setTxStatus("pending_tx"); 
      await tx.wait();
      
      // Chuyển trạng thái gói vay từ Available sang Active (Borrowed) thực tế trên UI
      setLoans(loans.map(l => l.id === loanId ? { ...l, status: "Active (Borrowed)" } : l));
      
      // Đồng bộ hóa lũy tiến số dư
      await refreshAccountData(account);
      setTimeout(() => refreshAccountData(account), 1000);
      setTimeout(() => refreshAccountData(account), 2000);
      
      alert(`Transaction verified! You have successfully locked ${loanItem.collateralRequired} ETH as escrow collateral and drawn the USDT funds.`);
      setTxStatus("idle");
      setActiveLoanId(null);
    } catch (error) {
      console.error(error);
      setTxStatus("idle");
      setActiveLoanId(null);
    }
  };

  // Hàm xử lý tất toán nợ
  const handleRepayLoan = async (loanId) => {
    if (!signer) return;
    const lendChainContract = new ethers.Contract(LendChainContractAddress, LENDCHAIN_ABI, signer);

    try {
      setActiveLoanId(loanId); 
      setTxStatus("repaying"); 
      
      const tx = await lendChainContract.repayLoan(loanId);
      setTxStatus("pending_tx");
      await tx.wait(); 
      
      setLoans(loans.map(l => l.id === loanId ? { ...l, status: "Repaid" } : l));
      
      await refreshAccountData(account);
      setTimeout(() => refreshAccountData(account), 1000);
      setTimeout(() => refreshAccountData(account), 2000);
      
      alert("Repayment verified! Your outstanding loan balance has been paid, and your locked ETH collateral has been safely returned to your wallet.");
      setTxStatus("idle");
      setActiveLoanId(null); 
    } catch (error) {
      console.error("Repayment execution error:", error);
      setTxStatus("idle");
      setActiveLoanId(null);
    }
  };

  // Modern Slate-Dark Web3 Theme Token Definitions
  const styles = {
    container: { backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', fontFamily: 'Segoe UI, sans-serif', padding: '30px' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '20px', marginBottom: '30px' },
    navBtn: { padding: '10px 20px', background: 'transparent', color: '#94a3b8', border: 'none', cursor: 'pointer', fontSize: '16px', fontWeight: '600' },
    activeNavBtn: { padding: '10px 20px', background: '#1e293b', color: '#10b981', borderBottom: '3px solid #10b981', cursor: 'pointer', fontSize: '16px', fontWeight: '600' },
    walletCard: { backgroundColor: '#1e293b', borderRadius: '12px', padding: '15px 25px', border: '1px solid #334155', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.5)', width: '310px' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px', marginTop: '20px' },
    card: { backgroundColor: '#1e293b', borderRadius: '16px', padding: '20px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '12px' },
    badge: (status) => ({ backgroundColor: status === "Active (Borrowed)" ? '#065f46' : '#1e3a8a', color: status === "Active (Borrowed)" ? '#34d399' : '#60a5fa', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', width: 'fit-content' }),
    button: { width: '100%', padding: '12px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginTop: '5px' },
    secondaryBtn: { width: '100%', padding: '10px', backgroundColor: '#334155', color: '#cbd5e1', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' },
    input: { width: '100%', padding: '12px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '8px', color: '#fff', marginTop: '5px', boxSizing: 'border-box' },
    landingWrapper: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '65vh', textAlign: 'center', gap: '20px' },
    connectBigBtn: { padding: '16px 40px', fontSize: '18px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.4)', transition: 'all 0.2s' }
  };

  return (
    <div style={styles.container}>
      {/* GLOBAL NAVBAR & WALLET STATUS */}
      <header style={styles.header}>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>🌐</span> LendChain P2P Capital Hub
          </h1>
          <p style={{ color: '#94a3b8', margin: '5px 0 0 0' }}>Lender-Driven Liquidity Marketplace Powered by Smart Contracts</p>
        </div>
        
        {account && (
          <div style={styles.walletCard}>
            <div style={{ fontSize: '13px', color: '#94a3b8' }}>Active User: <span style={{ color: '#38bdf8' }}>{account.substring(0,6)}...{account.substring(account.length-4)}</span></div>
            <div style={{ display: 'flex', gap: '20px', marginTop: '8px', fontSize: '15px', fontWeight: 'bold' }}>
              <div>💰 Balance: <span style={{ color: '#fbbf24' }}>{ethBalance} ETH</span></div>
              <div>💵 Tokens: <span style={{ color: '#10b981' }}>{parseFloat(usdtBalance).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} USDT</span></div>
            </div>
            
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <input 
                type="number" 
                style={{ ...styles.input, marginTop: 0, padding: '6px 10px', width: '95px', height: '34px', fontSize: '13px', textAlign: 'center' }} 
                value={depositAmount} 
                onChange={(e) => setDepositAmount(e.target.value)} 
                placeholder="Amount"
              />
              <button 
                disabled={txStatus === "depositing" || txStatus === "pending_tx"} 
                onClick={handleDepositUSDT} 
                style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', flex: 1, fontWeight: 'bold', height: '34px' }}
              >
                {txStatus === "depositing" && "Sending..."}
                {txStatus === "pending_tx" && "Syncing..."}
                {txStatus === "idle" && "📥 Deposit USDT"}
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ONBOARDING FLOW FOR CHOOSE ACCOUNT WALLET */}
      {!account ? (
        <div style={styles.landingWrapper}>
          <div style={{ fontSize: '64px' }}>🔒</div>
          <h2 style={{ margin: 0, fontSize: '32px' }}>Welcome to LendChain Platform</h2>
          <p style={{ color: '#94a3b8', maxWidth: '450px', margin: 0, lineHeight: '1.6' }}>
            Please authenticate and select your preferred crypto wallet account from MetaMask to access the decentralized dashboard.
          </p>
          <button style={styles.connectBigBtn} onClick={connectWallet}>
            🔌 Select Wallet Account & Connect
          </button>
        </div>
      ) : (
        <>
          {/* NAVIGATION TAB BAR */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', borderBottom: '1px solid #1e293b' }}>
            <button style={activeTab === "market" ? styles.activeNavBtn : styles.navBtn} onClick={() => setActiveTab("market")}>🛒 Loan Marketplace (Lender Offers)</button>
            <button style={activeTab === "create" ? styles.activeNavBtn : styles.navBtn} onClick={() => setActiveTab("create")}>✍️ Create Lending Offer</button>
            <button style={activeTab === "dashboard" ? styles.activeNavBtn : styles.navBtn} onClick={() => setActiveTab("dashboard")}>📊 My Active Positions</button>
          </div>

          {/* TAB 1: LOAN MARKETPLACE */}
          {activeTab === "market" && (
            <div>
              <h3 style={{ margin: '0 0 10px 0' }}>Available Capital Pools Posted by Lenders</h3>
              <div style={styles.grid}>
                {loans.map((loan) => (
                  <div key={loan.id} style={styles.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 'bold', color: '#38bdf8' }}>Pool ID: #{loan.id}</span>
                      <span style={styles.badge(loan.status)}>{loan.status}</span>
                    </div>
                    <div style={{ fontSize: '14px', color: '#cbd5e1' }}>👤 Supplier/Lender: {loan.lender}</div>
                    <hr style={{ border: '0', borderTop: '1px solid #334155', margin: '5px 0' }} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '14px' }}>
                      <div>Available Funds: <b style={{ color: '#10b981' }}>{loan.amount} USDT</b></div>
                      <div>Required Collateral: <b>{loan.collateralRequired} ETH</b></div>
                      <div>Interest Rate: <b style={{ color: '#fbbf24' }}>{loan.interest}% APR</b></div>
                      <div>Duration Terms: <b>{loan.duration} Days</b></div>
                    </div>
                    
                    {loan.status === "Available" && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                        <button disabled={txStatus !== "idle"} onClick={() => handleAcceptLoanOffer(loan.id)} style={styles.button}>
                          {txStatus === "funding" && activeLoanId === loan.id ? "Locking Collateral ETH..." : "Accept Loan & Lock Collateral"}
                        </button>
                        
                        <hr style={{ border: '0', borderTop: '1px solid #334155', margin: '4px 0' }} />
                        
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input 
                            type="number" 
                            step="0.1"
                            style={{ ...styles.input, marginTop: 0, padding: '8px 12px', fontSize: '13px', flex: 1, textAlign: 'center' }} 
                            value={counterInputs[loan.id] || ""} 
                            onChange={(e) => setCounterInputs({ ...counterInputs, [loan.id]: e.target.value })} 
                            placeholder="Custom APR %" 
                          />
                          <button 
                            onClick={() => handleNegotiateOffer(loan.id, counterInputs[loan.id])} 
                            style={{ ...styles.secondaryBtn, width: 'auto', padding: '10px 15px', whiteSpace: 'nowrap' }}
                          >
                            {loan.hasCounter ? "🔄 Update Bid" : "🤝 Propose Counter"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: LENDER CREATES OFFER */}
          {activeTab === "create" && (
            <div style={{ maxWidth: '500px', backgroundColor: '#1e293b', padding: '30px', borderRadius: '16px', border: '1px solid #334155' }}>
              <h3 style={{ margin: '0 0 20px 0', color: '#10b981' }}>Deploy New Capital Funding Pool</h3>
              <form onSubmit={handleCreateLendingOffer} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div>
                  <label style={{ fontSize: '14px', color: '#94a3b8' }}>Total Amount to Lend (USDT):</label>
                  <input type="number" style={styles.input} value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} required />
                </div>
                <div>
                  <label style={{ fontSize: '14px', color: '#94a3b8' }}>Required Borrower Collateral (ETH):</label>
                  <input type="number" step="0.01" style={styles.input} value={formData.collateral} onChange={(e) => setFormData({...formData, collateral: e.target.value})} required />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div>
                    <label style={{ fontSize: '14px', color: '#94a3b8' }}>Target Interest Rate (% APR):</label>
                    <input type="number" style={styles.input} value={formData.interest} onChange={(e) => setFormData({...formData, interest: e.target.value})} required />
                  </div>
                  <div>
                    <label style={{ fontSize: '14px', color: '#94a3b8' }}>Lockup Duration (Days):</label>
                    <input type="number" style={styles.input} value={formData.duration} onChange={(e) => setFormData({...formData, duration: e.target.value})} required />
                  </div>
                </div>
                <button type="submit" style={{ ...styles.button, marginTop: '15px', backgroundColor: '#3b82f6' }}>
                  {txStatus === "approving" && "1/2: Granting Contract Token Allowance..."}
                  {txStatus === "pending_tx" && "2/2: Confirming Smart Contract Listing..."}
                  {txStatus === "idle" && "🚀 Approve & List Capital Pool"}
                </button>
              </form>
            </div>
          )}

          {/* TAB 3: USER ACTIVE POSITIONS */}
          {activeTab === "dashboard" && (
            <div>
              <h3 style={{ margin: '0 0 10px 0' }}>Your Active Borrowed Agreements</h3>
              <div style={styles.grid}>
                {loans.filter(l => l.status === "Active (Borrowed)").length === 0 ? (
                  <p style={{ color: '#94a3b8', fontSize: '15px', marginTop: '10px' }}>No active borrowed positions found. Please head to the Marketplace to accept an offer and lock collateral.</p>
                ) : (
                  loans.filter(l => l.status === "Active (Borrowed)").map((loan) => (
                    <div key={loan.id} style={{ ...styles.card, borderLeft: '5px solid #ef4444' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold' }}>Agreement ID: #{loan.id}</span>
                        <span style={{ ...styles.badge(loan.status) }}>Active</span>
                      </div>
                      <div style={{ fontSize: '14px' }}>💵 Total Outstanding Balance: <b>{loan.amount * 1.05} USDT</b></div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>Maturity Deadline: Due in {loan.duration} days.</div>
                      
                      <button 
                        disabled={txStatus !== "idle"} 
                        onClick={() => handleRepayLoan(loan.id)} 
                        style={{ ...styles.button, backgroundColor: '#ef4444' }}
                      >
                        {txStatus === "repaying" && activeLoanId === loan.id ? "Processing Repayment..." : "💳 Repay Loan & Reclaim ETH Collateral"}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;