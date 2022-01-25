// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

library Math {
    function max(uint a, uint b) internal pure returns (uint) {
        return a >= b ? a : b;
    }
    function min(uint a, uint b) internal pure returns (uint) {
        return a < b ? a : b;
    }
}

interface erc20 {
    function totalSupply() external view returns (uint256);
    function transfer(address recipient, uint amount) external returns (bool);
    function balanceOf(address) external view returns (uint);
    function transferFrom(address sender, address recipient, uint amount) external returns (bool);
    function approve(address spender, uint value) external returns (bool);
}

interface ve {
    function token() external view returns (address);
    function balanceOfNFT(uint) external view returns (uint);
    function isApprovedOrOwner(address, uint) external view returns (bool);
    function ownerOf(uint) external view returns (address);
    function transferFrom(address, address, uint) external;
}

interface IBaseV1Factory {
    function isPair(address) external view returns (bool);
}

interface IBaseV1Core {
    function claimFees() external returns (uint, uint);
    function tokens() external returns (address, address);
}

interface IBribe {
    function notifyRewardAmount(address token, uint amount) external;
}

interface Voter {
    function attachTokenToGauge(uint _tokenId) external;
    function detachTokenFromGauge(uint _tokenId) external;
}

// Gauges are used to incentivize pools, they emit reward tokens over 7 days for staked LP tokens
contract Gauge {

    address public immutable stake; // the LP token that needs to be staked for rewards
    address public immutable _ve; // the ve token used for gauges
    address public immutable bribe;
    address public immutable voter;

    uint public derivedSupply;
    mapping(address => uint) public derivedBalances;

    uint constant DURATION = 7 days; // rewards are released over 7 days
    uint constant PRECISION = 10 ** 18;

    // default snx staking contract implementation
    mapping(address => uint) public rewardRate;
    mapping(address => uint) public periodFinish;
    mapping(address => uint) public lastUpdateTime;
    mapping(address => uint) public rewardPerTokenStored;

    mapping(address => mapping(address => uint)) public lastEarn;
    mapping(address => mapping(address => uint)) public userRewardPerTokenStored;
    mapping(address => mapping(address => uint)) public userRewards;

    mapping(address => uint) public tokenIds;

    uint public totalSupply;
    mapping(address => uint) public balanceOf;

    address[] public rewards;
    mapping(address => bool) public isReward;

    function claimFees() external returns (uint claimed0, uint claimed1) {
        (claimed0, claimed1) = IBaseV1Core(stake).claimFees();
        (address _token0, address _token1) = IBaseV1Core(stake).tokens();
        _safeApprove(_token0, bribe, claimed0);
        _safeApprove(_token1, bribe, claimed1);
        IBribe(bribe).notifyRewardAmount(_token0, claimed0);
        IBribe(bribe).notifyRewardAmount(_token1, claimed1);
    }


    /// @notice A checkpoint for marking balance
    struct Checkpoint {
       uint timestamp;
       uint balanceOf;
    }

    /// @notice A checkpoint for marking reward rate
    struct RewardPerTokenCheckpoint {
       uint timestamp;
       uint rewardPerToken;
    }

    /// @notice A checkpoint for marking supply
    struct SupplyCheckpoint {
       uint timestamp;
       uint supply;
    }

    /// @notice A record of balance checkpoints for each account, by index
    mapping (address => mapping (uint => Checkpoint)) public checkpoints;

    /// @notice The number of checkpoints for each account
    mapping (address => uint) public numCheckpoints;

    /// @notice A record of balance checkpoints for each token, by index
    mapping (uint => SupplyCheckpoint) public supplyCheckpoints;

    /// @notice The number of checkpoints
    uint public supplyNumCheckpoints;

    /// @notice A record of balance checkpoints for each token, by index
    mapping (address => mapping (uint => RewardPerTokenCheckpoint)) public rewardPerTokenCheckpoints;

    /// @notice The number of checkpoints for each token
    mapping (address => uint) public rewardPerTokenNumCheckpoints;

    // simple re-entrancy check
    uint _unlocked = 1;
    modifier lock() {
        require(_unlocked == 1);
        _unlocked = 2;
        _;
        _unlocked = 1;
    }

    constructor(address _stake, address _bribe, address  __ve, address _voter) {
        stake = _stake;
        bribe = _bribe;
        _ve = __ve;
        voter = _voter;
    }

    /**
     * @notice Determine the prior balance for an account as of a block number
     * @dev Block number must be a finalized block or else this function will revert to prevent misinformation.
     * @param account The address of the account to check
     * @param timestamp The timestamp to get the balance at
     * @return The balance the account had as of the given block
     */
    function getPriorBalanceIndex(address account, uint timestamp) public view returns (uint) {
        uint nCheckpoints = numCheckpoints[account];
        if (nCheckpoints == 0) {
            return 0;
        }

        // First check most recent balance
        if (checkpoints[account][nCheckpoints - 1].timestamp <= timestamp) {
            return (nCheckpoints - 1);
        }

        // Next check implicit zero balance
        if (checkpoints[account][0].timestamp > timestamp) {
            return 0;
        }

        uint lower = 0;
        uint upper = nCheckpoints - 1;
        while (upper > lower) {
            uint center = upper - (upper - lower) / 2; // ceil, avoiding overflow
            Checkpoint memory cp = checkpoints[account][center];
            if (cp.timestamp == timestamp) {
                return center;
            } else if (cp.timestamp < timestamp) {
                lower = center;
            } else {
                upper = center - 1;
            }
        }
        return lower;
    }

    function getPriorSupplyIndex(uint timestamp) public view returns (uint) {
        uint nCheckpoints = supplyNumCheckpoints;
        if (nCheckpoints == 0) {
            return 0;
        }

        // First check most recent balance
        if (supplyCheckpoints[nCheckpoints - 1].timestamp <= timestamp) {
            return (nCheckpoints - 1);
        }

        // Next check implicit zero balance
        if (supplyCheckpoints[0].timestamp > timestamp) {
            return 0;
        }

        uint lower = 0;
        uint upper = nCheckpoints - 1;
        while (upper > lower) {
            uint center = upper - (upper - lower) / 2; // ceil, avoiding overflow
            SupplyCheckpoint memory cp = supplyCheckpoints[center];
            if (cp.timestamp == timestamp) {
                return center;
            } else if (cp.timestamp < timestamp) {
                lower = center;
            } else {
                upper = center - 1;
            }
        }
        return lower;
    }

    function getPriorRewardPerToken(address token, uint timestamp) public view returns (uint, uint) {
        uint nCheckpoints = rewardPerTokenNumCheckpoints[token];
        if (nCheckpoints == 0) {
            return (0,0);
        }

        // First check most recent balance
        if (rewardPerTokenCheckpoints[token][nCheckpoints - 1].timestamp <= timestamp) {
            return (rewardPerTokenCheckpoints[token][nCheckpoints - 1].rewardPerToken, rewardPerTokenCheckpoints[token][nCheckpoints - 1].timestamp);
        }

        // Next check implicit zero balance
        if (rewardPerTokenCheckpoints[token][0].timestamp > timestamp) {
            return (0,0);
        }

        uint lower = 0;
        uint upper = nCheckpoints - 1;
        while (upper > lower) {
            uint center = upper - (upper - lower) / 2; // ceil, avoiding overflow
            RewardPerTokenCheckpoint memory cp = rewardPerTokenCheckpoints[token][center];
            if (cp.timestamp == timestamp) {
                return (cp.rewardPerToken, cp.timestamp);
            } else if (cp.timestamp < timestamp) {
                lower = center;
            } else {
                upper = center - 1;
            }
        }
        return (rewardPerTokenCheckpoints[token][lower].rewardPerToken, rewardPerTokenCheckpoints[token][lower].timestamp);
    }

    function _writeCheckpoint(address account, uint balance) internal {
      uint _timestamp = block.timestamp;
      uint _nCheckPoints = numCheckpoints[account];

      if (_nCheckPoints > 0 && checkpoints[account][_nCheckPoints - 1].timestamp == _timestamp) {
          checkpoints[account][_nCheckPoints - 1].balanceOf = balance;
      } else {
          checkpoints[account][_nCheckPoints] = Checkpoint(_timestamp, balance);
          numCheckpoints[account] = _nCheckPoints + 1;
      }
    }

    function _writeRewardPerTokenCheckpoint(address token, uint reward, uint timestamp) internal {
      uint _nCheckPoints = rewardPerTokenNumCheckpoints[token];

      if (_nCheckPoints > 0 && rewardPerTokenCheckpoints[token][_nCheckPoints - 1].timestamp == timestamp) {
        rewardPerTokenCheckpoints[token][_nCheckPoints - 1].rewardPerToken = reward;
      } else {
          rewardPerTokenCheckpoints[token][_nCheckPoints] = RewardPerTokenCheckpoint(timestamp, reward);
          rewardPerTokenNumCheckpoints[token] = _nCheckPoints + 1;
      }
    }

    function _writeSupplyCheckpoint() internal {
      uint _nCheckPoints = supplyNumCheckpoints;
      uint _timestamp = block.timestamp;

      if (_nCheckPoints > 0 && supplyCheckpoints[_nCheckPoints - 1].timestamp == _timestamp) {
        supplyCheckpoints[_nCheckPoints - 1].supply = derivedSupply;
      } else {
          supplyCheckpoints[_nCheckPoints] = SupplyCheckpoint(_timestamp, derivedSupply);
          supplyNumCheckpoints = _nCheckPoints + 1;
      }
    }

    function rewardsListLength() external view returns (uint) {
        return rewards.length;
    }

    // returns the last time the reward was modified or periodFinish if the reward has ended
    function lastTimeRewardApplicable(address token) public view returns (uint) {
        return Math.min(block.timestamp, periodFinish[token]);
    }

    function batchUserRewards(address token, address account, uint maxRuns) external {
        (rewardPerTokenStored[token], lastUpdateTime[token]) = _updateRewardPerToken(token);
        (userRewards[token][account], lastEarn[token][account]) = _batchUserRewards(token, account, maxRuns);
    }

    function getReward(address account, address[] memory tokens) public lock {
        require(msg.sender == account || msg.sender == voter);
        for (uint i = 0; i < tokens.length; i++) {
            (rewardPerTokenStored[tokens[i]], lastUpdateTime[tokens[i]]) = _updateRewardPerToken(tokens[i]);

            uint _reward = earned(tokens[i], account);
            userRewards[tokens[i]][account] = 0;
            lastEarn[tokens[i]][account] = block.timestamp;
            userRewardPerTokenStored[tokens[i]][account] = rewardPerTokenStored[tokens[i]];
            if (_reward > 0) _safeTransfer(tokens[i], account, _reward);
        }

        uint _derivedBalance = derivedBalances[account];
        derivedSupply -= _derivedBalance;
        _derivedBalance = derivedBalance(account);
        derivedBalances[account] = _derivedBalance;
        derivedSupply += _derivedBalance;

        _writeCheckpoint(account, derivedBalances[account]);
        _writeSupplyCheckpoint();
    }


    function rewardPerToken(address token) public view returns (uint) {
        if (derivedSupply == 0) {
            return rewardPerTokenStored[token];
        }
        return rewardPerTokenStored[token] + ((lastTimeRewardApplicable(token) - Math.min(lastUpdateTime[token], periodFinish[token])) * rewardRate[token] * PRECISION / derivedSupply);
    }

    function derivedBalance(address account) public view returns (uint) {
        uint _tokenId = tokenIds[account];
        uint _balance = balanceOf[account];
        uint _derived = _balance * 40 / 100;
        uint _adjusted = 0;
        if (account == ve(_ve).ownerOf(_tokenId)) {
            _adjusted = ve(_ve).balanceOfNFT(_tokenId);
            _adjusted = (totalSupply * _adjusted / erc20(_ve).totalSupply()) * 60 / 100;
        }
        return Math.min((_derived + _adjusted), _balance);
    }

    function _batchUserRewards(address token, address account, uint maxRuns) internal view returns (uint, uint) {
        uint _startTimestamp = lastEarn[token][account];
        if (numCheckpoints[account] == 0) {
            return (userRewards[token][account], _startTimestamp);
        }

        uint _startIndex = getPriorBalanceIndex(account, _startTimestamp);
        uint _endIndex = Math.min(numCheckpoints[account]-1, maxRuns);

        uint reward = userRewards[token][account];
        for (uint i = _startIndex; i < _endIndex; i++) {
            Checkpoint memory cp0 = checkpoints[account][i];
            Checkpoint memory cp1 = checkpoints[account][i+1];
            (uint _rewardPerTokenStored0,) = getPriorRewardPerToken(token, cp0.timestamp);
            (uint _rewardPerTokenStored1,) = getPriorRewardPerToken(token, cp1.timestamp);
            reward += cp0.balanceOf * (_rewardPerTokenStored1 - _rewardPerTokenStored0) / PRECISION;
            _startTimestamp = cp1.timestamp;
        }

        return (reward, _startTimestamp);
    }

    function batchRewardPerToken(address token, uint maxRuns) external {
        (rewardPerTokenStored[token], lastUpdateTime[token])  = _batchRewardPerToken(token, maxRuns);
    }

    function _batchRewardPerToken(address token, uint maxRuns) internal returns (uint, uint) {
        uint _startTimestamp = lastUpdateTime[token];
        uint reward = rewardPerTokenStored[token];

        if (supplyNumCheckpoints == 0) {
            return (reward, _startTimestamp);
        }

        uint _startIndex = getPriorSupplyIndex(_startTimestamp);
        uint _endIndex = Math.min(supplyNumCheckpoints-1, maxRuns);

        for (uint i = _startIndex; i < _endIndex; i++) {
            SupplyCheckpoint memory sp0 = supplyCheckpoints[i];
            if (sp0.supply > 0) {
                SupplyCheckpoint memory sp1 = supplyCheckpoints[i+1];
                (uint _reward, uint _endTime) = _calcRewardPerToken(token, sp1.timestamp, sp0.timestamp, sp0.supply, _startTimestamp);
                reward += _reward;
                _writeRewardPerTokenCheckpoint(token, reward, _endTime);
                _startTimestamp = _endTime;
            }
        }

        return (reward, _startTimestamp);
    }

    function _calcRewardPerToken(address token, uint timestamp1, uint timestamp0, uint supply, uint startTimestamp) internal view returns (uint, uint) {
        uint endTime = Math.max(timestamp1, startTimestamp);
        return (((Math.min(endTime, periodFinish[token]) - Math.min(Math.max(timestamp0, startTimestamp), periodFinish[token])) * rewardRate[token] * PRECISION / supply), endTime);
    }

    function _updateRewardPerToken(address token) internal returns (uint, uint) {
        uint _startTimestamp = lastUpdateTime[token];
        uint reward = rewardPerTokenStored[token];

        if (supplyNumCheckpoints == 0) {
            return (reward, _startTimestamp);
        }

        uint _startIndex = getPriorSupplyIndex(_startTimestamp);
        uint _endIndex = supplyNumCheckpoints-1;

        if (_endIndex - _startIndex > 1) {
            for (uint i = _startIndex; i < _endIndex-1; i++) {
                SupplyCheckpoint memory sp0 = supplyCheckpoints[i];
                if (sp0.supply > 0) {
                  SupplyCheckpoint memory sp1 = supplyCheckpoints[i+1];
                  (uint _reward, uint _endTime) = _calcRewardPerToken(token, sp1.timestamp, sp0.timestamp, sp0.supply, _startTimestamp);
                  reward += _reward;
                  _writeRewardPerTokenCheckpoint(token, reward, _endTime);
                  _startTimestamp = _endTime;
                }
            }
        }

        SupplyCheckpoint memory sp = supplyCheckpoints[_endIndex];
        if (sp.supply > 0) {
            (uint _reward,) = _calcRewardPerToken(token, lastTimeRewardApplicable(token), Math.max(sp.timestamp, _startTimestamp), sp.supply, _startTimestamp);
            reward += _reward;
            _writeRewardPerTokenCheckpoint(token, reward, block.timestamp);
            _startTimestamp = block.timestamp;
        }

        return (reward, _startTimestamp);
    }

    // earned is an estimation, it won't be exact till the supply > rewardPerToken calculations have run
    function earned(address token, address account) public view returns (uint) {
        uint _startTimestamp = lastEarn[token][account];
        if (numCheckpoints[account] == 0) {
            return userRewards[token][account];
        }

        uint _startIndex = getPriorBalanceIndex(account, _startTimestamp);
        uint _endIndex = numCheckpoints[account]-1;

        uint reward = userRewards[token][account];

        if (_endIndex - _startIndex > 1) {
            for (uint i = _startIndex; i < _endIndex-1; i++) {
                Checkpoint memory cp0 = checkpoints[account][i];
                Checkpoint memory cp1 = checkpoints[account][i+1];
                (uint _rewardPerTokenStored0,) = getPriorRewardPerToken(token, cp0.timestamp);
                (uint _rewardPerTokenStored1,) = getPriorRewardPerToken(token, cp1.timestamp);
                reward += cp0.balanceOf * (_rewardPerTokenStored1 - _rewardPerTokenStored0) / PRECISION;
            }
        }

        Checkpoint memory cp = checkpoints[account][_endIndex];
        (uint _rewardPerTokenStored,) = getPriorRewardPerToken(token, cp.timestamp);
        reward += cp.balanceOf * (rewardPerToken(token) - Math.max(_rewardPerTokenStored, userRewardPerTokenStored[token][account])) / PRECISION;

        return reward;
    }

    function deposit(uint amount, uint tokenId) public lock {
        require(amount > 0);
        if (tokenId > 0) {
            require(ve(_ve).ownerOf(tokenId) == msg.sender);
            if (balanceOf[msg.sender] == 0) Voter(voter).attachTokenToGauge(tokenId);
            tokenIds[msg.sender] = tokenId;
        }

        _safeTransferFrom(stake, msg.sender, address(this), amount);
        totalSupply += amount;
        balanceOf[msg.sender] += amount;

        uint _derivedBalance = derivedBalances[msg.sender];
        derivedSupply -= _derivedBalance;
        _derivedBalance = derivedBalance(msg.sender);
        derivedBalances[msg.sender] = _derivedBalance;
        derivedSupply += _derivedBalance;

        _writeCheckpoint(msg.sender, _derivedBalance);
        _writeSupplyCheckpoint();
    }

    function withdraw(uint amount) public lock {
        uint tokenId = tokenIds[msg.sender];

        totalSupply -= amount;
        balanceOf[msg.sender] -= amount;
        _safeTransfer(stake, msg.sender, amount);

        if (tokenId > 0 && balanceOf[msg.sender] == 0) {
            Voter(voter).detachTokenFromGauge(tokenId);
            tokenIds[msg.sender] = 0;
        }

        uint _derivedBalance = derivedBalances[msg.sender];
        derivedSupply -= _derivedBalance;
        _derivedBalance = derivedBalance(msg.sender);
        derivedBalances[msg.sender] = _derivedBalance;
        derivedSupply += _derivedBalance;

        _writeCheckpoint(msg.sender, derivedBalances[msg.sender]);
        _writeSupplyCheckpoint();
    }

    function left(address token) external view returns (uint) {
        if (block.timestamp >= periodFinish[token]) return 0;
        uint _remaining = periodFinish[token] - block.timestamp;
        return _remaining * rewardRate[token];
    }

    function notifyRewardAmount(address token, uint amount) external lock {
        (rewardPerTokenStored[token], lastUpdateTime[token]) = _updateRewardPerToken(token);

        if (block.timestamp >= periodFinish[token]) {
            _safeTransferFrom(token, msg.sender, address(this), amount);
            rewardRate[token] = amount / DURATION;
        } else {
            uint _remaining = periodFinish[token] - block.timestamp;
            uint _left = _remaining * rewardRate[token];
            require(amount > _left);
            _safeTransferFrom(token, msg.sender, address(this), amount);
            rewardRate[token] = (amount + _left) / DURATION;
        }
        require(rewardRate[token] > 0);
        periodFinish[token] = block.timestamp + DURATION;
        if (!isReward[token]) {
            isReward[token] = true;
            rewards.push(token);
        }
    }

    function _safeTransfer(address token, address to, uint256 value) internal {
        (bool success, bytes memory data) =
            token.call(abi.encodeWithSelector(erc20.transfer.selector, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))));
    }

    function _safeTransferFrom(address token, address from, address to, uint256 value) internal {
        (bool success, bytes memory data) =
            token.call(abi.encodeWithSelector(erc20.transferFrom.selector, from, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))));
    }

    function _safeApprove(address token, address spender, uint256 value) internal {
        (bool success, bytes memory data) =
            token.call(abi.encodeWithSelector(erc20.approve.selector, spender, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))));
    }
}

contract BaseV1GaugeFactory {
    address public last_gauge;

    function createGauge(address _pool, address _bribe, address _ve) external returns (address) {
        last_gauge = address(new Gauge(_pool, _bribe, _ve, msg.sender));
        return last_gauge;
    }

    function createGaugeSingle(address _pool, address _bribe, address _ve, address _voter) external returns (address) {
        last_gauge = address(new Gauge(_pool, _bribe, _ve, _voter));
        return last_gauge;
    }
}
