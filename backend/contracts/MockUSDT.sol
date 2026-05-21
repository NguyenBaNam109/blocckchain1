
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDT is ERC20 {
    constructor() ERC20("Mock USDT", "USDT") {
        // Tu dong đuc san 1 trieu token cho nguoi deploy hop dong
        _mint(msg.sender, 1000000 * 10**18); 
    }

    // Ham cho phep bat ky ai cung co the nhan mien phi token de test
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}