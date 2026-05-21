import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import './App.css';

// ─── Contract ABIs ───────────────────────────────────────────────
const USDT_ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 value) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function mint(address to, uint256 amount)"
];

const LENDCHAIN_ABI = [
  "function createLoanRequest(uint256 _loanAmount, uint256 _collateralAmount, uint256 _interestRate, uint256 _duration) external returns (uint256)",
  "function submitCounterOffer(uint256 _loanId, uint256 _interestRate, uint256 _duration) external",
  "function acceptCounterOffer(uint256 _loanId) external",
  "function rejectCounterOffer(uint256 _loanId) external",
  "function depositCollateral(uint256 _loanId) external payable",
  "function fundLoan(uint256 _loanId) external",
  "function repayLoan(uint256 _loanId) external",
  "function claimCollateral(uint256 _loanId) external",
  "function loanCount() view returns (uint256)",
  "function loans(uint256) view returns (address borrower, address lender, uint256 loanAmount, uint256 collateralAmount, uint256 interestRate, uint256 duration, uint256 repaymentDeadline, uint8 loanStatus, bool hasCounterOffer)",
  "function usdtToken() view returns (address)"
];

// Update these after each redeployment
const LENDCHAIN_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
const USDT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

const STATUS = ["Pending", "Active", "Repaid", "Defaulted"];

function App() {
  const [account, setAccount] = useState("");
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [txStatus, setTxStatus] = useState("idle");
  const [txMessage, setTxMessage] = useState("");
  const [ethBalance, setEthBalance] = useState("0");
  const [usdtBalance, setUsdtBalance] = useState("0");
  const [activeTab, setActiveTab] = useState("market");
  const [loans, setLoans] = useState([]);
  const [depositAmount, setDepositAmount] = useState("1000");
  const [counterInputs, setCounterInputs] = useState({});
  const [formData, setFormData] = useState({ amount: "100", collateral: "0.15", interest: "5", duration: "604800" });

  const refreshBalances = useCallback(async (addr) => {
    if (!addr || !window.ethereum) return;
    try {
      const p = new ethers.BrowserProvider(window.ethereum);
      const bal = await p.getBalance(addr);
      setEthBalance(parseFloat(ethers.formatEther(bal)).toFixed(4));
      const usdt = new ethers.Contract(USDT_ADDRESS, USDT_ABI, p);
      const uBal = await usdt.balanceOf(addr);
      setUsdtBalance(parseFloat(ethers.formatEther(uBal)).toFixed(2));
    } catch (e) { console.error("Balance refresh:", e); }
  }, []);

  const fetchLoans = useCallback(async () => {
    if (!provider) return;
    try {
      const contract = new ethers.Contract(LENDCHAIN_ADDRESS, LENDCHAIN_ABI, provider);
      const count = Number(await contract.loanCount());
      const arr = [];
      for (let i = 1; i <= count; i++) {
        const l = await contract.loans(i);
        arr.push({
          id: i, borrower: l.borrower, lender: l.lender,
          loanAmount: ethers.formatEther(l.loanAmount),
          collateralAmount: ethers.formatEther(l.collateralAmount),
          interestRate: Number(l.interestRate), duration: Number(l.duration),
          repaymentDeadline: Number(l.repaymentDeadline),
          status: Number(l.loanStatus), hasCounterOffer: l.hasCounterOffer
        });
      }
      setLoans(arr);
    } catch (e) { console.error("Fetch loans:", e); }
  }, [provider]);

  const connectWallet = async () => {
    if (!window.ethereum) { alert("Install MetaMask to use LendChain."); return; }
    try {
      const p = new ethers.BrowserProvider(window.ethereum);
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const s = await p.getSigner();
      setAccount(accounts[0]); setProvider(p); setSigner(s);
      await refreshBalances(accounts[0]);
    } catch (e) { console.error("Connect:", e); }
  };

  useEffect(() => {
    if (!window.ethereum) return;
    const handler = async (accounts) => {
      if (accounts.length > 0) {
        const p = new ethers.BrowserProvider(window.ethereum);
        const s = await p.getSigner();
        setAccount(accounts[0]); setProvider(p); setSigner(s);
        await refreshBalances(accounts[0]);
      } else setAccount("");
    };
    window.ethereum.on('accountsChanged', handler);
    return () => window.ethereum.removeListener('accountsChanged', handler);
  }, [refreshBalances]);

  useEffect(() => { if (provider) fetchLoans(); }, [provider, fetchLoans]);

  const runTx = async (label, fn) => {
    try {
      setTxStatus("pending"); setTxMessage(label);
      const tx = await fn();
      if (tx?.wait) { setTxMessage(`${label} — confirming...`); await tx.wait(); }
      await refreshBalances(account); await fetchLoans();
      setTxStatus("idle"); setTxMessage(""); return true;
    } catch (e) {
      console.error(`${label}:`, e);
      alert(`Error: ${e?.reason || e?.message || "Transaction failed"}`);
      setTxStatus("idle"); setTxMessage(""); return false;
    }
  };

  const handleMintUSDT = async () => {
    if (!signer) return;
    const amt = parseInt(depositAmount);
    if (isNaN(amt) || amt <= 0) { alert("Enter a valid amount"); return; }
    const usdt = new ethers.Contract(USDT_ADDRESS, USDT_ABI, signer);
    await runTx("Minting USDT", () => usdt.mint(account, ethers.parseEther(amt.toString())));
  };

  const handleCreateLoan = async (e) => {
    e.preventDefault(); if (!signer) return;
    const contract = new ethers.Contract(LENDCHAIN_ADDRESS, LENDCHAIN_ABI, signer);
    const ok = await runTx("Creating loan request", () =>
      contract.createLoanRequest(ethers.parseEther(formData.amount), ethers.parseEther(formData.collateral), parseInt(formData.interest), parseInt(formData.duration))
    );
    if (ok) setActiveTab("market");
  };

  const handleCounterOffer = async (id) => {
    if (!signer) return;
    const val = counterInputs[id];
    if (!val || isNaN(parseInt(val))) { alert("Enter a valid rate"); return; }
    const contract = new ethers.Contract(LENDCHAIN_ADDRESS, LENDCHAIN_ABI, signer);
    const loan = loans.find(l => l.id === id);
    await runTx("Submitting counter-offer", () => contract.submitCounterOffer(id, parseInt(val), loan.duration));
  };

  const handleAcceptCounter = async (id) => {
    if (!signer) return;
    const contract = new ethers.Contract(LENDCHAIN_ADDRESS, LENDCHAIN_ABI, signer);
    await runTx("Accepting counter-offer", () => contract.acceptCounterOffer(id));
  };

  const handleRejectCounter = async (id) => {
    if (!signer) return;
    const contract = new ethers.Contract(LENDCHAIN_ADDRESS, LENDCHAIN_ABI, signer);
    await runTx("Rejecting counter-offer", () => contract.rejectCounterOffer(id));
  };

  const handleDepositCollateral = async (id) => {
    if (!signer) return;
    const loan = loans.find(l => l.id === id);
    const contract = new ethers.Contract(LENDCHAIN_ADDRESS, LENDCHAIN_ABI, signer);
    await runTx("Depositing ETH collateral", () => contract.depositCollateral(id, { value: ethers.parseEther(loan.collateralAmount) }));
  };

  const handleFundLoan = async (id) => {
    if (!signer) return;
    const loan = loans.find(l => l.id === id);
    const usdt = new ethers.Contract(USDT_ADDRESS, USDT_ABI, signer);
    const amt = ethers.parseEther(loan.loanAmount);
    const allowance = await usdt.allowance(account, LENDCHAIN_ADDRESS);
    if (allowance < amt) {
      const ok = await runTx("Approving USDT", () => usdt.approve(LENDCHAIN_ADDRESS, amt));
      if (!ok) return;
    }
    const contract = new ethers.Contract(LENDCHAIN_ADDRESS, LENDCHAIN_ABI, signer);
    await runTx("Funding loan", () => contract.fundLoan(id));
  };

  const handleRepayLoan = async (id) => {
    if (!signer) return;
    const loan = loans.find(l => l.id === id);
    const total = parseFloat(loan.loanAmount) * (1 + loan.interestRate / 100);
    const totalWei = ethers.parseEther(total.toString());
    const usdt = new ethers.Contract(USDT_ADDRESS, USDT_ABI, signer);
    const allowance = await usdt.allowance(account, LENDCHAIN_ADDRESS);
    if (allowance < totalWei) {
      const ok = await runTx("Approving USDT for repayment", () => usdt.approve(LENDCHAIN_ADDRESS, totalWei));
      if (!ok) return;
    }
    const contract = new ethers.Contract(LENDCHAIN_ADDRESS, LENDCHAIN_ABI, signer);
    await runTx("Repaying loan", () => contract.repayLoan(id));
  };

  const handleClaimCollateral = async (id) => {
    if (!signer) return;
    const contract = new ethers.Contract(LENDCHAIN_ADDRESS, LENDCHAIN_ABI, signer);
    await runTx("Claiming collateral", () => contract.claimCollateral(id));
  };

  const fmtAddr = (a) => a === ethers.ZeroAddress ? "\u2014" : `${a.slice(0,6)}...${a.slice(-4)}`;
  const isMe = (a) => a?.toLowerCase() === account?.toLowerCase();
  const daysFromSecs = (s) => { const d = Math.round(s / 86400); return d > 0 ? `${d} days` : `${s} sec`; };

  const pendingLoans = loans.filter(l => l.status === 0);
  const activeLoans = loans.filter(l => l.status === 1);
  const myLoans = loans.filter(l => isMe(l.borrower) || isMe(l.lender));

  const LoanCard = ({ loan, idx }) => {
    const isBorrower = isMe(loan.borrower);
    const isLender = isMe(loan.lender);
    const isPending = loan.status === 0;
    const isActive = loan.status === 1;
    const now = Math.floor(Date.now() / 1000);
    const isOverdue = isActive && loan.repaymentDeadline > 0 && now > loan.repaymentDeadline;
    const repayTotal = (parseFloat(loan.loanAmount) * (1 + loan.interestRate / 100)).toFixed(2);
    const statusClass = ["pending","active","repaid","defaulted"][loan.status];
    const badgeClass = isOverdue ? "badge badge-overdue" : `badge badge-${statusClass}`;

    return (
      <div className={`loan-card ${statusClass} fade-in`} style={{ animationDelay: `${idx * 0.05}s` }}>
        <div className="card-header">
          <span className="loan-id">#{loan.id}</span>
          <span className={badgeClass}>{isOverdue ? "Overdue" : STATUS[loan.status]}</span>
        </div>

        <div className="address-row">
          Borrower: <span className={isBorrower ? "address-you" : "address-other"}>{fmtAddr(loan.borrower)}{isBorrower && " (you)"}</span>
          {loan.lender !== ethers.ZeroAddress && (<>
            {" \u00b7 "}Lender: <span className={isLender ? "address-you" : "address-other"}>{fmtAddr(loan.lender)}{isLender && " (you)"}</span>
          </>)}
        </div>

        <div className="divider" />

        <div className="terms-grid">
          <div className="term">Amount <div className="term-value green">{parseFloat(loan.loanAmount).toLocaleString()} USDT</div></div>
          <div className="term">Collateral <div className="term-value white">{loan.collateralAmount} ETH</div></div>
          <div className="term">Rate <div className="term-value amber">{loan.interestRate}%</div></div>
          <div className="term">Duration <div className="term-value white">{daysFromSecs(loan.duration)}</div></div>
          {isActive && loan.repaymentDeadline > 0 && (
            <div className="term term-full">
              Repay total <span className="term-value amber" style={{marginLeft:8}}>{repayTotal} USDT</span>
              {isOverdue && <span className="term-value red" style={{marginLeft:8}}>OVERDUE</span>}
            </div>
          )}
        </div>

        {isPending && loan.hasCounterOffer && (
          <div className="counter-banner">
            <span className="counter-label">Counter-offer active</span> — New rate: {loan.interestRate}%
          </div>
        )}

        <div style={{display:'flex',flexDirection:'column',gap:6,marginTop:4}}>
          {isPending && isBorrower && (
            <button className="btn btn-primary" disabled={txStatus!=="idle"} onClick={()=>handleDepositCollateral(loan.id)}>
              Deposit {loan.collateralAmount} ETH collateral
            </button>
          )}
          {isPending && isBorrower && loan.hasCounterOffer && (
            <div className="btn-row">
              <button className="btn btn-sm btn-primary" onClick={()=>handleAcceptCounter(loan.id)}>Accept</button>
              <button className="btn btn-sm btn-red" onClick={()=>handleRejectCounter(loan.id)}>Reject</button>
            </div>
          )}
          {isPending && !isBorrower && !loan.hasCounterOffer && (
            <div className="counter-row">
              <input type="number" step="1" placeholder="Rate %" className="input input-sm"
                value={counterInputs[loan.id]||""} onChange={(e)=>setCounterInputs({...counterInputs,[loan.id]:e.target.value})} />
              <button className="btn btn-sm btn-blue" onClick={()=>handleCounterOffer(loan.id)}>Counter-offer</button>
            </div>
          )}
          {isPending && !isBorrower && (
            <button className="btn btn-blue" disabled={txStatus!=="idle"} onClick={()=>handleFundLoan(loan.id)}>
              Fund loan ({loan.loanAmount} USDT)
            </button>
          )}
          {isActive && isBorrower && !isOverdue && (
            <button className="btn btn-primary" disabled={txStatus!=="idle"} onClick={()=>handleRepayLoan(loan.id)}>
              Repay {repayTotal} USDT
            </button>
          )}
          {isActive && isLender && isOverdue && (
            <button className="btn btn-red" disabled={txStatus!=="idle"} onClick={()=>handleClaimCollateral(loan.id)}>
              Claim {loan.collateralAmount} ETH collateral
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="page">
      <header className="header">
        <div>
          <div className="logo"><div className="logo-icon">LC</div> LendChain</div>
          <p className="subtitle">Peer-to-peer crypto lending on Ethereum</p>
        </div>
        {account && (
          <div className="wallet-card">
            <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:6}}>
              Connected: <span className="wallet-address">{fmtAddr(account)}</span>
            </div>
            <div className="balance-row">
              <span className="balance-item"><span className="balance-value balance-eth">{ethBalance}</span> ETH</span>
              <span className="balance-item"><span className="balance-value balance-usdt">{parseFloat(usdtBalance).toLocaleString()}</span> USDT</span>
            </div>
            <div className="mint-row">
              <input type="number" className="input input-sm" value={depositAmount} onChange={(e)=>setDepositAmount(e.target.value)} />
              <button className="btn btn-sm btn-blue" style={{flex:1}} disabled={txStatus!=="idle"} onClick={handleMintUSDT}>
                Mint test USDT
              </button>
            </div>
          </div>
        )}
      </header>

      {!account ? (
        <div className="landing fade-in">
          <div className="landing-icon">&#x1f512;</div>
          <h2>Welcome to LendChain</h2>
          <p>Connect your MetaMask wallet to access the decentralized P2P lending marketplace on the local Hardhat network.</p>
          <button className="connect-btn" onClick={connectWallet}>Connect wallet</button>
        </div>
      ) : (
        <>
          {txStatus !== "idle" && (
            <div className="status-bar slide-in">
              <span className="spinner">&#x23f3;</span> {txMessage}
            </div>
          )}

          <div className="tab-bar">
            {[["market","Marketplace"],["create","Create loan"],["dashboard","My loans"]].map(([k,l])=>(
              <button key={k} className={`tab ${activeTab===k?"active":""}`} onClick={()=>setActiveTab(k)}>{l}</button>
            ))}
          </div>

          {activeTab === "market" && (
            <div className="fade-in">
              <p className="summary">
                {pendingLoans.length} pending · {activeLoans.length} active · {loans.length} total on-chain
                {loans.length===0 && " — create a loan to get started."}
              </p>
              <div className="loan-grid">
                {loans.filter(l=>l.status<=1).map((loan,i)=><LoanCard key={loan.id} loan={loan} idx={i}/>)}
              </div>
            </div>
          )}

          {activeTab === "create" && (
            <div className="form-card fade-in">
              <div className="form-title">Create a loan request</div>
              <div className="form-desc">As a borrower, specify the USDT you need and the ETH collateral you will lock.</div>
              <form onSubmit={handleCreateLoan} className="form-stack">
                <div><label className="label">Loan amount (USDT)</label><input type="number" className="input" value={formData.amount} onChange={(e)=>setFormData({...formData,amount:e.target.value})} required /></div>
                <div><label className="label">Collateral (ETH)</label><input type="number" step="0.01" className="input" value={formData.collateral} onChange={(e)=>setFormData({...formData,collateral:e.target.value})} required /></div>
                <div className="form-grid">
                  <div><label className="label">Interest rate (%)</label><input type="number" className="input" value={formData.interest} onChange={(e)=>setFormData({...formData,interest:e.target.value})} required /></div>
                  <div><label className="label">Duration (seconds)</label><input type="number" className="input" value={formData.duration} onChange={(e)=>setFormData({...formData,duration:e.target.value})} required /></div>
                </div>
                <button type="submit" className="btn btn-primary" disabled={txStatus!=="idle"}>
                  {txStatus!=="idle"?txMessage:"Submit loan request"}
                </button>
              </form>
            </div>
          )}

          {activeTab === "dashboard" && (
            <div className="fade-in">
              <p className="summary">Loans where you are the borrower or lender.</p>
              {myLoans.length===0 ? (
                <div className="empty-state">No loans found for your address. Create a loan or fund an existing one.</div>
              ) : (
                <div className="loan-grid">
                  {myLoans.map((loan,i)=><LoanCard key={loan.id} loan={loan} idx={i}/>)}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;