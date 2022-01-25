// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.11;

contract BaseV1 {

    string public constant symbol = "SOLID";
    string public constant name = "Solidly";
    uint8 public constant decimals = 18;
    uint256 public totalSupply = 0;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address from, address to, uint256 value);
    event Approval(address owner, address spender, uint256 value);
    event LogChangeVault(address indexed oldVault, address indexed newVault, uint indexed effectiveTime);

    bytes32 public DOMAIN_SEPARATOR;
    // keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
    bytes32 public constant PERMIT_TYPEHASH = 0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9;
    mapping(address => uint) public nonces;

    address public router;
    address public pendingRouter;
    uint256 public pendingRouterDelay;
    address public minter;

    constructor(
        address _router
    ) {
        router = _router;
        minter = msg.sender;
        _mint(msg.sender, 0);
    }

    // No checks as its meant to be once off to set minting rights to BaseV1 Minter
    function setMinter(address _minter) external {
        require(msg.sender == minter);
        minter = _minter;
    }

    function approve(address _spender, uint256 _value) public returns (bool) {
        allowance[msg.sender][_spender] = _value;
        emit Approval(msg.sender, _spender, _value);
        return true;
    }

    function permit(address owner, address spender, uint value, uint deadline, uint8 v, bytes32 r, bytes32 s) external {
        require(deadline >= block.timestamp, 'StableV1: EXPIRED');
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'),
                keccak256(bytes(name)),
                keccak256(bytes('1')),
                block.chainid,
                address(this)
            )
        );
        bytes32 digest = keccak256(
            abi.encodePacked(
                '\x19\x01',
                DOMAIN_SEPARATOR,
                keccak256(abi.encode(PERMIT_TYPEHASH, owner, spender, value, nonces[owner]++, deadline))
            )
        );
        address recoveredAddress = ecrecover(digest, v, r, s);
        require(recoveredAddress != address(0) && recoveredAddress == owner, 'StableV1: INVALID_SIGNATURE');
        allowance[owner][spender] = value;

        emit Approval(owner, spender, value);
    }

    function _mint(address _to, uint _amount) internal returns (bool) {
        balanceOf[_to] += _amount;
        totalSupply += _amount;
        emit Transfer(address(0x0), _to, _amount);
        return true;
    }

    function _transfer(
        address _from,
        address _to,
        uint256 _value
    ) internal returns (bool) {
        balanceOf[_from] -= _value;
        balanceOf[_to] += _value;
        emit Transfer(_from, _to, _value);
        return true;
    }

    function transfer(address _to, uint256 _value) public returns (bool) {
        return _transfer(msg.sender, _to, _value);
    }

    function transferFrom(
        address _from,
        address _to,
        uint256 _value
    ) public returns (bool) {
        uint256 allowed_from = allowance[_from][msg.sender];
        if (allowed_from != type(uint).max) {
            allowance[_from][msg.sender] -= _value;
        }
        return _transfer(_from, _to, _value);
    }

    function _getRouter() internal returns (address) {
        if (pendingRouterDelay != 0 && pendingRouterDelay < block.timestamp) {
            router = pendingRouter;
            pendingRouterDelay = 0;
        }
        return router;
    }

    function mint(address account, uint256 amount) external returns (bool) {
        require(msg.sender == _getRouter() || msg.sender == minter);
        _mint(account, amount);
        return true;
    }

    function burn(address account, uint256 amount) external returns (bool) {
        require(msg.sender == _getRouter());
        totalSupply -= amount;
        balanceOf[account] -= amount;

        emit Transfer(account, address(0), amount);
        return true;
    }

    function changeVault(address _pendingRouter) external returns (bool) {
        require(msg.sender == _getRouter());
        require(_pendingRouter != address(0), "address(0x0)");
        pendingRouter = _pendingRouter;
        pendingRouterDelay = block.timestamp + 86400;
        emit LogChangeVault(router, _pendingRouter, pendingRouterDelay);
        return true;
    }
}
