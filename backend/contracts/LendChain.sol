// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @dev OpenZeppelin IERC20 Standard Interface for USDT token integration.
 */
interface IERC20 {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function transfer(address to, uint256 value) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
}

/**
 * @title LendChain Peer-to-Peer Crypto Lending Smart Contract
 * @dev Governs the complete loan lifecycle using a Finite State Machine (FSM).
 */
contract LendChain {
    
    // FSM structural state definitions
    enum LoanStatus { Pending, Active, Repaid, Defaulted }

    // Core On-chain Data Model representing a single loan agreement
    struct Loan {
        address borrower;          // Wallet address of the borrower
        address lender;            // Wallet address of the funding lender
        uint256 loanAmount;        // Principal loan amount in USDT
        uint256 collateralAmount;  // Locked ETH collateral amount in Wei
        uint256 interestRate;      // Agreed interest percentage (e.g., 5 = 5%)
        uint256 duration;          // Loan lifecycle lifespan specified in seconds
        uint256 repaymentDeadline; // Unix epoch timestamp marking the absolute repayment limit
        LoanStatus loanStatus;     // The current FSM state of the loan instance
        bool hasCounterOffer;      // Flag denoting if a negotiation counter-offer is active
        bool collateralLocked;     // Flag confirming borrower has deposited ETH collateral
    }

    // Address of the USDT token contract (or Mock USDT deployed on Sepolia)
    address public immutable usdtToken;
    
    // Global counter tracking total loan entries acting as unique IDs
    uint256 public loanCount;
    
    // On-chain mapping registry associating IDs to specific Loan profiles
    mapping(uint256 => Loan) public loans;

    // Standard logging events for Frontend tracking and asynchronous indexing
    event LoanRequestCreated(uint256 indexed loanId, address indexed borrower, uint256 loanAmount, uint256 collateralAmount);
    event CounterOfferSubmitted(uint256 indexed loanId, uint256 interestRate, uint256 duration);
    event CounterOfferAccepted(uint256 indexed loanId);
    event CounterOfferRejected(uint256 indexed loanId);
    event CollateralDeposited(uint256 indexed loanId, uint256 amount);
    event LoanFunded(uint256 indexed loanId, address indexed lender, uint256 repaymentDeadline);
    event LoanRepaid(uint256 indexed loanId);
    event CollateralClaimed(uint256 indexed loanId, address indexed lender);

    /**
     * @dev Sets up the immutable token dependency. Devoid of administrative ownership backdoors.
     */
    constructor(address _usdtToken) {
        require(_usdtToken != address(0), "Invalid token address");
        usdtToken = _usdtToken;
    }

    /**
     * @notice Phase 1: Initiates a new customizable loan request from a Borrower.
     */
    function createLoanRequest(
        uint256 _loanAmount,
        uint256 _collateralAmount,
        uint256 _interestRate,
        uint256 _duration
    ) external returns (uint256) {
        require(_loanAmount > 0, "Loan amount must exceed zero");
        require(_collateralAmount > 0, "Collateral asset must exceed zero");
        require(_duration > 0, "Loan lifespan duration must exceed zero");

        loanCount++;
        loans[loanCount] = Loan({
            borrower: msg.sender,
            lender: address(0),
            loanAmount: _loanAmount,
            collateralAmount: _collateralAmount,
            interestRate: _interestRate,
            duration: _duration,
            repaymentDeadline: 0,
            loanStatus: LoanStatus.Pending,
            hasCounterOffer: false,
            collateralLocked: false
        });

        emit LoanRequestCreated(loanCount, msg.sender, _loanAmount, _collateralAmount);
        return loanCount;
    }

    /**
     * @notice Phase 2 (A): Permits a Lender to submit a single-round negotiation counter-offer.
     */
    function submitCounterOffer(uint256 _loanId, uint256 _interestRate, uint256 _duration) external {
        Loan storage loan = loans[_loanId];
        require(loan.loanStatus == LoanStatus.Pending, "Loan is not in a negotiable Pending state");
        require(!loan.hasCounterOffer, "Counter-offer round limit reached");
        require(msg.sender != loan.borrower, "Borrowers cannot submit counter-offers to themselves");

        loan.interestRate = _interestRate;
        loan.duration = _duration;
        loan.lender = msg.sender; 
        loan.hasCounterOffer = true;

        emit CounterOfferSubmitted(_loanId, _interestRate, _duration);
    }

    /**
     * @notice Phase 2 (B): Executed by the Borrower to lock the negotiated parameter changes.
     */
    function acceptCounterOffer(uint256 _loanId) external {
        Loan storage loan = loans[_loanId];
        require(loan.loanStatus == LoanStatus.Pending, "Invalid loan status");
        require(msg.sender == loan.borrower, "Only the original borrower can accept terms");
        require(loan.hasCounterOffer, "No active counter-proposal found");

        emit CounterOfferAccepted(_loanId);
    }

    /**
     * @notice Phase 2 (C): Executed by the Borrower to reset and dismiss a lender's proposal.
     */
    function rejectCounterOffer(uint256 _loanId) external {
        Loan storage loan = loans[_loanId];
        require(loan.loanStatus == LoanStatus.Pending, "Invalid loan status");
        require(msg.sender == loan.borrower, "Only the original borrower can reject terms");
        require(loan.hasCounterOffer, "No active counter-proposal found");

        loan.lender = address(0);
        loan.hasCounterOffer = false;

        emit CounterOfferRejected(_loanId);
    }

    /**
     * @notice Phase 3: Called by the Borrower to lock the required ETH collateral inside the contract.
     */
    function depositCollateral(uint256 _loanId) external payable {
        Loan storage loan = loans[_loanId];
        require(loan.loanStatus == LoanStatus.Pending, "Loan structure must be Pending");
        require(msg.sender == loan.borrower, "Only the designated borrower can deposit");
        require(msg.value == loan.collateralAmount, "Transferred ETH value does not match terms");

        loan.collateralLocked = true;
        emit CollateralDeposited(_loanId, msg.value);
    }

    /**
     * @notice Phase 4: Triggered by the Lender to disburse USDT principal funds directly to the Borrower.
     */
    function fundLoan(uint256 _loanId) external {
        Loan storage loan = loans[_loanId];
        require(loan.loanStatus == LoanStatus.Pending, "Loan target must be in a Pending state");
        require(loan.collateralLocked, "Borrower has not deposited collateral yet");

        if (loan.hasCounterOffer) {
            require(msg.sender == loan.lender, "Unauthorized: You are not the accepted lender");
        } else {
            loan.lender = msg.sender;
        }

        loan.loanStatus = LoanStatus.Active;
        loan.repaymentDeadline = block.timestamp + loan.duration;

        bool success = IERC20(usdtToken).transferFrom(loan.lender, loan.borrower, loan.loanAmount);
        require(success, "USDT principal distribution transaction failed");

        emit LoanFunded(_loanId, loan.lender, loan.repaymentDeadline);
    }

    /**
     * @notice Phase 5: Executed by the Borrower to repay principal plus interest and redeem locked ETH.
     */
    function repayLoan(uint256 _loanId) external {
        Loan storage loan = loans[_loanId];
        
        require(loan.loanStatus == LoanStatus.Active, "Loan target is not actively open");
        require(block.timestamp <= loan.repaymentDeadline, "Loan has expired; repayment window closed");
        require(msg.sender == loan.borrower, "Only the borrower is authorized to settle the debt");

        uint256 totalRepayment = loan.loanAmount + ((loan.loanAmount * loan.interestRate) / 100);
        loan.loanStatus = LoanStatus.Repaid;

        bool successUSDT = IERC20(usdtToken).transferFrom(loan.borrower, loan.lender, totalRepayment);
        require(successUSDT, "USDT debt clearance transfer failed");

        (bool successETH, ) = payable(loan.borrower).call{value: loan.collateralAmount}("");
        require(successETH, "Collateral asset release low-level call failed");

        emit LoanRepaid(_loanId);
    }

    /**
     * @notice Phase 6: Executed by the Lender to liquidate collateral in default scenarios.
     */
    function claimCollateral(uint256 _loanId) external {
        Loan storage loan = loans[_loanId];
        
        require(loan.loanStatus == LoanStatus.Active, "Target loan is not in Active status");
        require(block.timestamp > loan.repaymentDeadline, "Repayment grace window has not expired yet");
        require(msg.sender == loan.lender, "Only the aggrieved lender can claim collateral");

        loan.loanStatus = LoanStatus.Defaulted;

        (bool successETH, ) = payable(loan.lender).call{value: loan.collateralAmount}("");
        require(successETH, "Liquidation low-level ETH transfer failed");

        emit CollateralClaimed(_loanId, loan.lender);
    }
}