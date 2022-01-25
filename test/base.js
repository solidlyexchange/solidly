const { expect } = require("chai");
const { ethers } = require("hardhat");

function getCreate2Address(
  factoryAddress,
  [tokenA, tokenB],
  bytecode
) {
  const [token0, token1] = tokenA < tokenB ? [tokenA, tokenB] : [tokenB, tokenA]
  const create2Inputs = [
    '0xff',
    factoryAddress,
    keccak256(solidityPack(['address', 'address'], [token0, token1])),
    keccak256(bytecode)
  ]
  const sanitizedInputs = `0x${create2Inputs.map(i => i.slice(2)).join('')}`
  return getAddress(`0x${keccak256(sanitizedInputs).slice(-40)}`)
}

describe("core", function () {

  let token;
  let ust;
  let mim;
  let dai;
  let ve_underlying;
  let ve;
  let factory;
  let router;
  let pair;
  let pair2;
  let pair3;
  let owner;
  let gauge_factory;
  let gauge;
  let gauge2;
  let gauge3;
  let bribe;
  let bribe2;
  let bribe3;
  let minter;
  let ve_dist;
  let library;
  let staking;
  let owner2;
  let owner3;

  it("deploy base coins", async function () {
    [owner, owner2, owner3] = await ethers.getSigners(3);
    token = await ethers.getContractFactory("Token");
    ust = await token.deploy('ust', 'ust', 6, owner.address);
    await ust.mint(owner.address, ethers.BigNumber.from("1000000000000000000"));
    await ust.mint(owner2.address, ethers.BigNumber.from("1000000000000000000"));
    await ust.mint(owner3.address, ethers.BigNumber.from("1000000000000000000"));
    mim = await token.deploy('MIM', 'MIM', 18, owner.address);
    await mim.mint(owner.address, ethers.BigNumber.from("1000000000000000000000000000000"));
    await mim.mint(owner2.address, ethers.BigNumber.from("1000000000000000000000000000000"));
    await mim.mint(owner3.address, ethers.BigNumber.from("1000000000000000000000000000000"));
    dai = await token.deploy('DAI', 'DAI', 18, owner.address);
    await dai.mint(owner.address, ethers.BigNumber.from("1000000000000000000000000000000"));
    await dai.mint(owner2.address, ethers.BigNumber.from("1000000000000000000000000000000"));
    await dai.mint(owner3.address, ethers.BigNumber.from("1000000000000000000000000000000"));
    ve_underlying = await token.deploy('VE', 'VE', 18, owner.address);
    await ve_underlying.mint(owner.address, ethers.BigNumber.from("10000000000000000000000000"));
    await ve_underlying.mint(owner2.address, ethers.BigNumber.from("10000000000000000000000000"));
    await ve_underlying.mint(owner3.address, ethers.BigNumber.from("10000000000000000000000000"));
    vecontract = await ethers.getContractFactory("contracts/ve.sol:ve");
    ve = await vecontract.deploy(ve_underlying.address);

    await ust.deployed();
    await mim.deployed();
  });

  it("create lock", async function () {
    await ve_underlying.approve(ve.address, ethers.BigNumber.from("1000000000000000000"));
    await ve.create_lock(ethers.BigNumber.from("1000000000000000000"), 4 * 365 * 86400);
    expect(await ve.balanceOfNFT(1)).to.above(ethers.BigNumber.from("995063075414519385"));
    expect(await ve_underlying.balanceOf(ve.address)).to.be.equal(ethers.BigNumber.from("1000000000000000000"));
  });

  it("ve merge", async function () {
    await ve_underlying.approve(ve.address, ethers.BigNumber.from("1000000000000000000"));
    await ve.create_lock(ethers.BigNumber.from("1000000000000000000"), 4 * 365 * 86400);
    expect(await ve.balanceOfNFT(2)).to.above(ethers.BigNumber.from("995063075414519385"));
    expect(await ve_underlying.balanceOf(ve.address)).to.be.equal(ethers.BigNumber.from("2000000000000000000"));
    await ve.merge(2, 1);
    expect(await ve.balanceOfNFT(1)).to.above(ethers.BigNumber.from("1995063075414519385"));
    expect(await ve.balanceOfNFT(2)).to.equal(ethers.BigNumber.from("0"));
    expect((await ve.locked(2)).amount).to.equal(ethers.BigNumber.from("0"));
    expect(await ve.ownerOf(2)).to.equal('0x0000000000000000000000000000000000000000');
  });

  it("ve split", async function () {
    await ve.split(1, "400000000000000000"); // 1/5th

    expect(await ve.ownerOf(1)).to.equal(owner.address);
    expect(await ve.ownerOf(3)).to.equal(owner.address);
    expect(await ve.balanceOf(owner.address)).to.equal(2);
    expect(await ve.balanceOfNFT(1)).to.above("1595063075414519385");
    expect(await ve.balanceOfNFT(3)).to.above("395063075414519385");
    expect(await ve_underlying.balanceOf(ve.address)).to.be.equal(ethers.BigNumber.from("2000000000000000000"));
  });

  it("confirm ust deployment", async function () {
    expect(await ust.name()).to.equal("ust");
  });

  it("confirm mim deployment", async function () {
    expect(await mim.name()).to.equal("MIM");
  });

  it("deploy BaseV1Factory and test pair length", async function () {
    const BaseV1Factory = await ethers.getContractFactory("BaseV1Factory");
    factory = await BaseV1Factory.deploy();
    await factory.deployed();

    expect(await factory.allPairsLength()).to.equal(0);
  });

  it("deploy BaseV1Router and test factory address", async function () {
    const BaseV1Router = await ethers.getContractFactory("BaseV1Router01");
    router = await BaseV1Router.deploy(factory.address, owner.address);
    await router.deployed();

    expect(await router.factory()).to.equal(factory.address);
  });

  it("deploy pair via BaseV1Factory owner", async function () {
    const ust_1 = ethers.BigNumber.from("1000000");
    const mim_1 = ethers.BigNumber.from("1000000000000000000");
    const dai_1 = ethers.BigNumber.from("1000000000000000000");
    await mim.approve(router.address, mim_1);
    await ust.approve(router.address, ust_1);
    await router.addLiquidity(mim.address, ust.address, true, mim_1, ust_1, 0, 0, owner.address, Date.now());
    await mim.approve(router.address, mim_1);
    await ust.approve(router.address, ust_1);
    await router.addLiquidity(mim.address, ust.address, false, mim_1, ust_1, 0, 0, owner.address, Date.now());
    await mim.approve(router.address, mim_1);
    await dai.approve(router.address, dai_1);
    await router.addLiquidity(mim.address, dai.address, true, mim_1, dai_1, 0, 0, owner.address, Date.now());
    expect(await factory.allPairsLength()).to.equal(3);
  });

  it("deploy pair via BaseV1Factory owner2", async function () {
    const ust_1 = ethers.BigNumber.from("1000000");
    const mim_1 = ethers.BigNumber.from("1000000000000000000");
    const dai_1 = ethers.BigNumber.from("1000000000000000000");
    await mim.connect(owner2).approve(router.address, mim_1);
    await ust.connect(owner2).approve(router.address, ust_1);
    await router.connect(owner2).addLiquidity(mim.address, ust.address, true, mim_1, ust_1, 0, 0, owner.address, Date.now());
    await mim.connect(owner2).approve(router.address, mim_1);
    await ust.connect(owner2).approve(router.address, ust_1);
    await router.connect(owner2).addLiquidity(mim.address, ust.address, false, mim_1, ust_1, 0, 0, owner.address, Date.now());
    await mim.connect(owner2).approve(router.address, mim_1);
    await dai.connect(owner2).approve(router.address, dai_1);
    await router.connect(owner2).addLiquidity(mim.address, dai.address, true, mim_1, dai_1, 0, 0, owner.address, Date.now());
    expect(await factory.allPairsLength()).to.equal(3);
  });

  it("confirm pair for mim-ust", async function () {
    const create2address = await router.pairFor(mim.address, ust.address, true);
    const BaseV1Pair = await ethers.getContractFactory("BaseV1Pair");
    const address = await factory.getPair(mim.address, ust.address, true);
    const allpairs0 = await factory.allPairs(0);
    pair = await BaseV1Pair.attach(address);
    const address2 = await factory.getPair(mim.address, ust.address, false);
    pair2 = await BaseV1Pair.attach(address2);
    const address3 = await factory.getPair(mim.address, dai.address, true);
    pair3 = await BaseV1Pair.attach(address3);

    expect(pair.address).to.equal(create2address);
  });

  it("confirm tokens for mim-ust", async function () {
    [token0, token1] = await router.sortTokens(ust.address, mim.address);
    expect((await pair.token0()).toUpperCase()).to.equal(token0.toUpperCase());
    expect((await pair.token1()).toUpperCase()).to.equal(token1.toUpperCase());
  });

  it("mint & burn tokens for pair mim-ust", async function () {
    const ust_1 = ethers.BigNumber.from("1000000");
    const mim_1 = ethers.BigNumber.from("1000000000000000000");
    const before_balance = await ust.balanceOf(owner.address);
    await ust.transfer(pair.address, ust_1);
    await mim.transfer(pair.address, mim_1);
    await pair.mint(owner.address);
    expect(await pair.getAmountOut(ust_1, ust.address)).to.equal(ethers.BigNumber.from("982117769725505988"));
  });

  it("mint & burn tokens for pair mim-ust owner2", async function () {
    const ust_1 = ethers.BigNumber.from("1000000");
    const mim_1 = ethers.BigNumber.from("1000000000000000000");
    const before_balance = await ust.balanceOf(owner.address);
    await ust.connect(owner2).transfer(pair.address, ust_1);
    await mim.connect(owner2).transfer(pair.address, mim_1);
    await pair.connect(owner2).mint(owner2.address);
    expect(await pair.connect(owner2).getAmountOut(ust_1, ust.address)).to.equal(ethers.BigNumber.from("992220948146798746"));
  });

  it("BaseV1Router01 addLiquidity", async function () {
    const ust_1000 = ethers.BigNumber.from("100000000000");
    const mim_1000 = ethers.BigNumber.from("100000000000000000000000");
    const mim_100000000 = ethers.BigNumber.from("100000000000000000000000000");
    const dai_100000000 = ethers.BigNumber.from("100000000000000000000000000");
    const expected_2000 = ethers.BigNumber.from("2000000000000");
    await ust.approve(router.address, ust_1000);
    await mim.approve(router.address, mim_1000);
    await router.addLiquidity(mim.address, ust.address, true, mim_1000, ust_1000, mim_1000, ust_1000, owner.address, Date.now());
    await ust.approve(router.address, ust_1000);
    await mim.approve(router.address, mim_1000);
    await router.addLiquidity(mim.address, ust.address, false, mim_1000, ust_1000, mim_1000, ust_1000, owner.address, Date.now());
    await dai.approve(router.address, dai_100000000);
    await mim.approve(router.address, mim_100000000);
    await router.addLiquidity(mim.address, dai.address, true, mim_100000000, dai_100000000, 0, 0, owner.address, Date.now());
  });

  it("BaseV1Router01 addLiquidity owner2", async function () {
    const ust_1000 = ethers.BigNumber.from("100000000000");
    const mim_1000 = ethers.BigNumber.from("100000000000000000000000");
    const mim_100000000 = ethers.BigNumber.from("100000000000000000000000000");
    const dai_100000000 = ethers.BigNumber.from("100000000000000000000000000");
    const expected_2000 = ethers.BigNumber.from("2000000000000");
    await ust.connect(owner2).approve(router.address, ust_1000);
    await mim.connect(owner2).approve(router.address, mim_1000);
    await router.connect(owner2).addLiquidity(mim.address, ust.address, true, mim_1000, ust_1000, mim_1000, ust_1000, owner.address, Date.now());
    await ust.connect(owner2).approve(router.address, ust_1000);
    await mim.connect(owner2).approve(router.address, mim_1000);
    await router.connect(owner2).addLiquidity(mim.address, ust.address, false, mim_1000, ust_1000, mim_1000, ust_1000, owner.address, Date.now());
    await dai.connect(owner2).approve(router.address, dai_100000000);
    await mim.connect(owner2).approve(router.address, mim_100000000);
    await router.connect(owner2).addLiquidity(mim.address, dai.address, true, mim_100000000, dai_100000000, 0, 0, owner.address, Date.now());
  });

  it("BaseV1Router01 pair1 getAmountsOut & swapExactTokensForTokens", async function () {
    const ust_1 = ethers.BigNumber.from("1000000");
    const route = {from:ust.address, to:mim.address, stable:true}

    expect((await router.getAmountsOut(ust_1, [route]))[1]).to.be.equal(await pair.getAmountOut(ust_1, ust.address));

    const before = await mim.balanceOf(owner.address);
    const expected_output_pair = await pair.getAmountOut(ust_1, ust.address);
    const expected_output = await router.getAmountsOut(ust_1, [route]);
    await ust.approve(router.address, ust_1);
    await router.swapExactTokensForTokens(ust_1, expected_output[1], [route], owner.address, Date.now());
    const fees = await pair.fees()
    expect(await ust.balanceOf(fees)).to.be.equal(100);
    const b = await ust.balanceOf(owner.address);
    await pair.claimFees();
    expect(await ust.balanceOf(owner.address)).to.be.above(b);
  });

  it("BaseV1Router01 pair1 getAmountsOut & swapExactTokensForTokens owner2", async function () {
    const ust_1 = ethers.BigNumber.from("1000000");
    const route = {from:ust.address, to:mim.address, stable:true}

    expect((await router.getAmountsOut(ust_1, [route]))[1]).to.be.equal(await pair.getAmountOut(ust_1, ust.address));

    const before = await mim.balanceOf(owner2.address);
    const expected_output_pair = await pair.getAmountOut(ust_1, ust.address);
    const expected_output = await router.getAmountsOut(ust_1, [route]);
    await ust.connect(owner2).approve(router.address, ust_1);
    await router.connect(owner2).swapExactTokensForTokens(ust_1, expected_output[1], [route], owner2.address, Date.now());
    const fees = await pair.fees()
    expect(await ust.balanceOf(fees)).to.be.equal(101);
    const b = await ust.balanceOf(owner.address);
    await pair.connect(owner2).claimFees();
    expect(await ust.balanceOf(owner.address)).to.be.equal(b);
  });

  it("BaseV1Router01 pair2 getAmountsOut & swapExactTokensForTokens", async function () {
    const ust_1 = ethers.BigNumber.from("1000000");
    const route = {from:ust.address, to:mim.address, stable:false}

    expect((await router.getAmountsOut(ust_1, [route]))[1]).to.be.equal(await pair2.getAmountOut(ust_1, ust.address));

    const before = await mim.balanceOf(owner.address);
    const expected_output_pair = await pair.getAmountOut(ust_1, ust.address);
    const expected_output = await router.getAmountsOut(ust_1, [route]);
    await ust.approve(router.address, ust_1);
    await router.swapExactTokensForTokens(ust_1, expected_output[1], [route], owner.address, Date.now());
  });

  it("BaseV1Router01 pair3 getAmountsOut & swapExactTokensForTokens", async function () {
    const mim_1000000 = ethers.BigNumber.from("1000000000000000000000000");
    const route = {from:mim.address, to:dai.address, stable:true}

    expect((await router.getAmountsOut(mim_1000000, [route]))[1]).to.be.equal(await pair3.getAmountOut(mim_1000000, mim.address));

    const before = await mim.balanceOf(owner.address);
    const expected_output_pair = await pair3.getAmountOut(mim_1000000, mim.address);
    const expected_output = await router.getAmountsOut(mim_1000000, [route]);
    await mim.approve(router.address, mim_1000000);
    await router.swapExactTokensForTokens(mim_1000000, expected_output[1], [route], owner.address, Date.now());
  });

  it("deploy BaseV1Voter", async function () {
    const BaseV1GaugeFactory = await ethers.getContractFactory("BaseV1GaugeFactory");
    gauges_factory = await BaseV1GaugeFactory.deploy();
    const BaseV1Voter = await ethers.getContractFactory("BaseV1Voter");
    gauge_factory = await BaseV1Voter.deploy(ve.address, factory.address, gauges_factory.address);
    await gauge_factory.deployed();

    expect(await gauge_factory.length()).to.equal(0);
  });

  it("deploy BaseV1Minter", async function () {
    const VeDist = await ethers.getContractFactory("contracts/ve_dist.sol:ve_dist");
    ve_dist = await VeDist.deploy(ve.address, ve_underlying.address, owner.address);
    await ve_dist.deployed();

    const BaseV1Minter = await ethers.getContractFactory("BaseV1Minter");
    minter = await BaseV1Minter.deploy(gauge_factory.address, ve.address, ve_dist.address);
    await minter.deployed();
    await ve_dist.setDepositor(minter.address);
  });

  it("deploy BaseV1Factory gauge", async function () {
    const pair_1000 = ethers.BigNumber.from("1000000000");

    await gauge_factory.createGauge(pair.address);
    await gauge_factory.createGauge(pair2.address);
    await gauge_factory.createGauge(pair3.address);
    expect(await gauge_factory.gauges(pair.address)).to.not.equal(0x0000000000000000000000000000000000000000);

    sr = await ethers.getContractFactory("StakingRewards");
    staking = await sr.deploy(pair.address, ve_underlying.address);

    const gauge_address = await gauge_factory.gauges(pair.address);
    const bribe_address = await gauge_factory.bribes(gauge_address);

    const gauge_address2 = await gauge_factory.gauges(pair2.address);
    const bribe_address2 = await gauge_factory.bribes(gauge_address2);

    const gauge_address3 = await gauge_factory.gauges(pair3.address);
    const bribe_address3 = await gauge_factory.bribes(gauge_address3);

    const Gauge = await ethers.getContractFactory("Gauge");
    gauge = await Gauge.attach(gauge_address);
    gauge2 = await Gauge.attach(gauge_address2);
    gauge3 = await Gauge.attach(gauge_address3);

    const Bribe = await ethers.getContractFactory("Bribe");
    bribe = await Bribe.attach(bribe_address);
    bribe2 = await Bribe.attach(bribe_address2);
    bribe3 = await Bribe.attach(bribe_address3);

    await pair.approve(gauge.address, pair_1000);
    await pair.approve(staking.address, pair_1000);
    await pair2.approve(gauge2.address, pair_1000);
    await pair3.approve(gauge3.address, pair_1000);
    await gauge.deposit(pair_1000, 0);
    await staking.stake(pair_1000);
    await gauge2.deposit(pair_1000, 0);
    await gauge3.deposit(pair_1000, 0);
    expect(await gauge.totalSupply()).to.equal(pair_1000);
    expect(await gauge.earned(ve.address, owner.address)).to.equal(0);
  });

  it("fetch gauges with filters", async function () {
    [voter] = await ethers.getSigners(1);
    const gauges_factory_contract = await ethers.getContractFactory("BaseV1GaugeFactory");
    const gauges_factory_instance = await gauges_factory_contract.deploy();
    await gauges_factory_instance.deployed();

    expect(await gauges_factory_instance.gaugesLength()).to.equal(0);
    expect(await gauges_factory_instance.gaugesByPoolAddressLength(pair.address)).to.equal(0);
    expect(await gauges_factory_instance.gaugesByBribeAddressLength(pair.address)).to.equal(0);
    expect(await gauges_factory_instance.gaugesByVeAddressLength(pair.address)).to.equal(0);
    expect(await gauges_factory_instance.gaugesByVoterAddressLength(pair.address)).to.equal(0);

    await gauges_factory_instance.createGauge(pair.address, bribe.address, ve.address);
    await gauges_factory_instance.createGauge(pair2.address, bribe.address, ve.address);
    await gauges_factory_instance.createGauge(pair3.address, bribe.address, ve.address);

    const gauge_1 = await gauges_factory_instance.gauges(0)
    const gauge_2 = await gauges_factory_instance.gauges(1)
    const gauge_3 = await gauges_factory_instance.gauges(2)

    expect(await gauges_factory_instance.gaugesLength()).to.equal(3);
    expect(await gauges_factory_instance.gaugesByPoolAddressLength(pair.address)).to.equal(1);
    expect(await gauges_factory_instance.gaugesByBribeAddressLength(bribe.address)).to.equal(3);
    expect(await gauges_factory_instance.gaugesByVeAddressLength(ve.address)).to.equal(3);
    expect(await gauges_factory_instance.gaugesByVoterAddressLength(voter.address)).to.equal(3);

    expect(await gauges_factory_instance.gaugesByPoolAddress(pair.address, 0)).to.equal(gauge_1);
    expect(await gauges_factory_instance.gaugesByPoolAddress(pair2.address, 0)).to.equal(gauge_2);
    expect(await gauges_factory_instance.gaugesByPoolAddress(pair3.address, 0)).to.equal(gauge_3);

    expect(await gauges_factory_instance.gaugesByBribeAddress(bribe.address, 0)).to.equal(gauge_1);
    expect(await gauges_factory_instance.gaugesByBribeAddress(bribe.address, 1)).to.equal(gauge_2);
    expect(await gauges_factory_instance.gaugesByBribeAddress(bribe.address, 2)).to.equal(gauge_3);

    expect(await gauges_factory_instance.gaugesByVeAddress(ve.address, 0)).to.equal(gauge_1);
    expect(await gauges_factory_instance.gaugesByVeAddress(ve.address, 1)).to.equal(gauge_2);
    expect(await gauges_factory_instance.gaugesByVeAddress(ve.address, 2)).to.equal(gauge_3);

    expect(await gauges_factory_instance.gaugesByVoterAddress(voter.address, 0)).to.equal(gauge_1);
    expect(await gauges_factory_instance.gaugesByVoterAddress(voter.address, 1)).to.equal(gauge_2);
    expect(await gauges_factory_instance.gaugesByVoterAddress(voter.address, 2)).to.equal(gauge_3);
  });

  it("deploy BaseV1Factory gauge owner2", async function () {
    const pair_1000 = ethers.BigNumber.from("1000000000");
    const pair_2000 = ethers.BigNumber.from("2000000000");

    await pair.connect(owner2).approve(gauge.address, pair_1000);
    await pair.connect(owner2).approve(staking.address, pair_1000);
    await gauge.connect(owner2).deposit(pair_1000, 0);
    await staking.connect(owner2).stake(pair_1000);
    expect(await gauge.totalSupply()).to.equal(pair_2000);
    expect(await gauge.earned(ve.address, owner2.address)).to.equal(0);
  });

  it("withdraw gauge stake", async function () {
    const pair_1000 = ethers.BigNumber.from("1000000000");
    await gauge.withdraw(await gauge.balanceOf(owner.address));
    await gauge.connect(owner2).withdraw(await gauge.balanceOf(owner2.address));
    await staking.withdraw(await staking._balances(owner.address));
    await staking.connect(owner2).withdraw(await staking._balances(owner2.address));
    await gauge2.withdraw(await gauge2.balanceOf(owner.address));
    await gauge3.withdraw(await gauge3.balanceOf(owner.address));
    expect(await gauge.totalSupply()).to.equal(0);
    expect(await gauge2.totalSupply()).to.equal(0);
    expect(await gauge3.totalSupply()).to.equal(0);
  });

  it("add gauge & bribe rewards", async function () {
    const pair_1000 = ethers.BigNumber.from("1000000000");

    await ve_underlying.approve(gauge.address, pair_1000);
    await ve_underlying.approve(bribe.address, pair_1000);
    await ve_underlying.approve(staking.address, pair_1000);

    await gauge.notifyRewardAmount(ve_underlying.address, pair_1000);
    await bribe.notifyRewardAmount(ve_underlying.address, pair_1000);
    await staking.notifyRewardAmount(pair_1000);

    expect(await gauge.rewardRate(ve_underlying.address)).to.equal(ethers.BigNumber.from(1653));
    expect(await bribe.rewardRate(ve_underlying.address)).to.equal(ethers.BigNumber.from(1653));
    expect(await staking.rewardRate()).to.equal(ethers.BigNumber.from(1653));
  });

  it("exit & getReward gauge stake", async function () {
    const pair_1000 = ethers.BigNumber.from("1000000000");
    const supply = await pair.balanceOf(owner.address);
    await pair.approve(gauge.address, supply);
    await gauge.deposit(supply, 1);
    await gauge.withdraw(await gauge.balanceOf(owner.address));
    expect(await gauge.totalSupply()).to.equal(0);
    await pair.approve(gauge.address, supply);
    await gauge.deposit(pair_1000, 1);
    await pair.approve(staking.address, supply);
    await staking.stake(pair_1000);
  });

  it("gauge reset", async function () {
    await gauge_factory.reset(1);
  });

  it("gauge poke self", async function () {
    await gauge_factory.poke(1);
  });

  it("create lock 2", async function () {
    await ve_underlying.approve(ve.address, ethers.BigNumber.from("1000000000000000000"));
    await ve.create_lock(ethers.BigNumber.from("1000000000000000000"), 4 * 365 * 86400);
    expect(await ve.balanceOfNFT(1)).to.above(ethers.BigNumber.from("995063075414519385"));
    expect(await ve_underlying.balanceOf(ve.address)).to.be.equal(ethers.BigNumber.from("3000000000000000000"));
  });

  it("gauge vote & bribe balanceOf", async function () {
    await gauge_factory.vote(1, [pair.address, pair2.address], [5000,5000]);
    await gauge_factory.vote(3, [pair.address, pair2.address], [500000,500000]);
    console.log(await gauge_factory.usedWeights(1));
    console.log(await gauge_factory.usedWeights(3));
    expect(await gauge_factory.totalWeight()).to.not.equal(0);
    expect(await bribe.balanceOf(1)).to.not.equal(0);
  });

  it("gauge distribute based on voting", async function () {
    const pair_1000 = ethers.BigNumber.from("1000000000");
    await ve_underlying.approve(gauge_factory.address, pair_1000);
    await gauge_factory.notifyRewardAmount(pair_1000);
    await gauge_factory.updateAll();
    await gauge_factory.distro();
  });

  it("bribe claim rewards", async function () {
    await bribe.getReward(1, [ve_underlying.address]);
    await network.provider.send("evm_increaseTime", [691200])
    await network.provider.send("evm_mine")
    await bribe.getReward(1, [ve_underlying.address]);
  });

  it("BaseV1Router01 pair1 getAmountsOut & swapExactTokensForTokens", async function () {
    const ust_1 = ethers.BigNumber.from("1000000");
    const route = {from:ust.address, to:mim.address, stable:true}

    metadata = await pair.metadata()
    const roots = await ethers.getContractFactory("roots");
    root = await roots.deploy(metadata.dec0, metadata.dec1, metadata.st, metadata.t0, metadata.t1);
    await root.deployed();

    const before = await mim.balanceOf(owner.address);
    const expected_output_pair = await pair.getAmountOut(ust_1, ust.address);
    const expected_output = await router.getAmountsOut(ust_1, [route]);
    await ust.approve(router.address, ust_1);
    await router.swapExactTokensForTokens(ust_1, expected_output[1], [route], owner.address, Date.now());
    const fees = await pair.fees()
  });

  it("BaseV1Router01 pair2 getAmountsOut & swapExactTokensForTokens", async function () {
    const ust_1 = ethers.BigNumber.from("1000000");
    const route = {from:ust.address, to:mim.address, stable:false}

    const before = await mim.balanceOf(owner.address);
    const expected_output_pair = await pair.getAmountOut(ust_1, ust.address);
    const expected_output = await router.getAmountsOut(ust_1, [route]);
    await ust.approve(router.address, ust_1);
    await router.swapExactTokensForTokens(ust_1, expected_output[1], [route], owner.address, Date.now());
    const fees = await pair2.fees()
  });

  it("BaseV1Router01 pair1 getAmountsOut & swapExactTokensForTokens", async function () {
    const mim_1 = ethers.BigNumber.from("1000000000000000000");
    const route = {from:mim.address, to:ust.address, stable:true}

    const before = await ust.balanceOf(owner.address);
    const expected_output_pair = await pair.getAmountOut(mim_1, mim.address);
    const expected_output = await router.getAmountsOut(mim_1, [route]);
    await mim.approve(router.address, mim_1);
    await router.swapExactTokensForTokens(mim_1, expected_output[1], [route], owner.address, Date.now());
    const fees = await pair.fees()
  });

  it("BaseV1Router01 pair2 getAmountsOut & swapExactTokensForTokens", async function () {
    const mim_1 = ethers.BigNumber.from("1000000000000000000");
    const route = {from:mim.address, to:ust.address, stable:false}

    const before = await ust.balanceOf(owner.address);
    const expected_output = await router.getAmountsOut(mim_1, [route]);
    await mim.approve(router.address, mim_1);
    await router.swapExactTokensForTokens(mim_1, expected_output[1], [route], owner.address, Date.now());
  });

  it("BaseV1Router01 pair1>pair2 getAmountsOut & swapExactTokensForTokens", async function () {
    const mim_1 = ethers.BigNumber.from("1000000000000000000");
    const route = [{from:mim.address, to:ust.address, stable:false},{from:ust.address, to:mim.address, stable:true}]

    const before = (await mim.balanceOf(owner.address)).sub(mim_1);

    const expected_output = await router.getAmountsOut(mim_1, route);
    console.log(expected_output);
    await mim.approve(router.address, mim_1);
    await router.swapExactTokensForTokens(mim_1, expected_output[2], route, owner.address, Date.now());
    const after = await mim.balanceOf(owner.address);
    expect(after.sub(before)).to.equal(expected_output[2])
  });

  it("distribute and claim fees", async function () {

    await network.provider.send("evm_increaseTime", [691200])
    await network.provider.send("evm_mine")
    await bribe.getReward(1, [mim.address, ust.address]);

    await expect(gauge_factory.distributeFees([gauge.address])).to.be.revertedWith("");
  });

  it("staking rewards sense check", async function () {
    expect(await gauge.rewardRate(ve_underlying.address)).to.be.equal(await staking.rewardRate());
  });

  it("minter mint", async function () {
    console.log(await ve_dist.last_token_time());
    console.log(await ve_dist.timestamp());
    await minter.update_period();
    await gauge_factory.updateGauge(gauge.address);
    console.log(await ve_underlying.balanceOf(ve_dist.address));
    console.log(await ve_dist.claimable(1));
    const claimable = await gauge_factory.claimable(gauge.address);
    await ve_underlying.approve(staking.address, claimable);
    await staking.notifyRewardAmount(claimable);
    await gauge_factory.distro();
    await network.provider.send("evm_increaseTime", [1800])
    await network.provider.send("evm_mine")
    expect(await gauge.rewardRate(ve_underlying.address)).to.be.equal(await staking.rewardRate());
  });

  it("gauge claim rewards", async function () {
    await gauge.withdraw(await gauge.balanceOf(owner.address));
    await staking.withdraw(await staking._balances(owner.address));
    const pair_1000 = ethers.BigNumber.from("1000000000");
    await pair.approve(gauge.address, pair_1000);
    await gauge.deposit(pair_1000, 0);
    await staking.getReward();
    const before = await ve_underlying.balanceOf(owner.address)
    await gauge.batchUserRewards(ve_underlying.address, owner.address, 200);
    await gauge.batchUserRewards(ve_underlying.address, owner.address, 200);
    await gauge.batchUserRewards(ve_underlying.address, owner.address, 200);
    await gauge.batchRewardPerToken(ve_underlying.address, 200);
    await gauge.batchRewardPerToken(ve_underlying.address, 200);
    await gauge.batchRewardPerToken(ve_underlying.address, 200);
    await gauge.batchRewardPerToken(ve_underlying.address, 200);
    await gauge.batchRewardPerToken(ve_underlying.address, 200);
    const earned = await gauge.earned(ve_underlying.address, owner.address);
    await gauge.getReward(owner.address, [ve_underlying.address]);
    const after = await ve_underlying.balanceOf(owner.address)
    const received = after.sub(before);
    expect(received).to.be.above(earned)

    await gauge.withdraw(await gauge.balanceOf(owner.address));
    await pair.approve(gauge.address, pair_1000);
    await gauge.deposit(pair_1000, 1);
    await gauge.getReward(owner.address, [ve_underlying.address]);
    await gauge.withdraw(await gauge.balanceOf(owner.address));
    await pair.approve(gauge.address, pair_1000);
    await gauge.deposit(pair_1000, 0);
    await gauge.getReward(owner.address, [ve_underlying.address]);
    await gauge.withdraw(await gauge.balanceOf(owner.address));
    await pair.approve(gauge.address, pair_1000);
    await gauge.deposit(pair_1000, 1);
    await gauge.getReward(owner.address, [ve_underlying.address]);
    await gauge.withdraw(await gauge.balanceOf(owner.address));
    await pair.approve(gauge.address, pair_1000);
    await gauge.deposit(pair_1000, 0);
    await gauge.getReward(owner.address, [ve_underlying.address]);
    await gauge.withdraw(await gauge.balanceOf(owner.address));
    await pair.approve(gauge.address, pair_1000);
    await gauge.deposit(pair_1000, 1);
    await gauge.getReward(owner.address, [ve_underlying.address]);
    await gauge.withdraw(await gauge.balanceOf(owner.address));
    await pair.approve(gauge.address, pair_1000);
    await gauge.deposit(pair_1000, owner.address);
    await gauge.getReward(owner.address, [ve_underlying.address]);
    await network.provider.send("evm_increaseTime", [604800])
    await network.provider.send("evm_mine")
    await gauge.getReward(owner.address, [ve_underlying.address]);
    await gauge.withdraw(await gauge.balanceOf(owner.address));
  });

  it("gauge claim rewards (after expiry)", async function () {
    const pair_1000 = ethers.BigNumber.from("1000000000");
    await pair.approve(gauge.address, pair_1000);
    await gauge.deposit(pair_1000, 1);
    await gauge.getReward(owner.address, [ve_underlying.address]);
    await gauge.withdraw(await gauge.balanceOf(owner.address));
    await pair.approve(gauge.address, pair_1000);
    await gauge.deposit(pair_1000, 1);
    await gauge.getReward(owner.address, [ve_underlying.address]);
    await gauge.withdraw(await gauge.balanceOf(owner.address));
    await pair.approve(gauge.address, pair_1000);
    await gauge.deposit(pair_1000, 1);
    await gauge.getReward(owner.address, [ve_underlying.address]);
    await gauge.withdraw(await gauge.balanceOf(owner.address));
    await pair.approve(gauge.address, pair_1000);
    await gauge.deposit(pair_1000, 1);
    await gauge.getReward(owner.address, [ve_underlying.address]);
    await gauge.withdraw(await gauge.balanceOf(owner.address));
    await pair.approve(gauge.address, pair_1000);
    await gauge.deposit(pair_1000, 1);
    await gauge.getReward(owner.address, [ve_underlying.address]);
    await gauge.withdraw(await gauge.balanceOf(owner.address));
    await pair.approve(gauge.address, pair_1000);
    await gauge.deposit(pair_1000, 1);
    await gauge.getReward(owner.address, [ve_underlying.address]);
    await gauge.withdraw(await gauge.balanceOf(owner.address));
    await pair.approve(gauge.address, pair_1000);
    await gauge.deposit(pair_1000, 1);
    await gauge.getReward(owner.address, [ve_underlying.address]);
    await network.provider.send("evm_increaseTime", [604800])
    await network.provider.send("evm_mine")
    await gauge.getReward(owner.address, [ve_underlying.address]);
    await gauge.withdraw(await gauge.balanceOf(owner.address));
  });

  it("ve decay", async function () {
    const supply = await ve.totalSupply();
    expect(supply).to.be.above(0);
    await network.provider.send("evm_increaseTime", [4*365*86400])
    await network.provider.send("evm_mine")
    expect(await ve.balanceOfNFT(1)).to.be.equal(0);
    expect(await ve.totalSupply()).to.be.equal(0);
    await ve.withdraw(1);
  });

  it("BaseV1Router01 addLiquidity owner3", async function () {
    const ust_1000 = ethers.BigNumber.from("1000000000000");
    const mim_1000 = ethers.BigNumber.from("1000000000000000000000000");
    const mim_100000000 = ethers.BigNumber.from("100000000000000000000000000");
    const dai_100000000 = ethers.BigNumber.from("100000000000000000000000000");
    const expected_2000 = ethers.BigNumber.from("2000000000000");
    await ust.connect(owner3).approve(router.address, ust_1000);
    await mim.connect(owner3).approve(router.address, mim_1000);
    await router.connect(owner3).addLiquidity(mim.address, ust.address, true, mim_1000, ust_1000, 0, 0, owner3.address, Date.now());
  });

  it("deploy BaseV1Factory gauge owner3", async function () {
    const pair_1000 = ethers.BigNumber.from("1000000000");
    const pair_2000 = ethers.BigNumber.from("2000000000");

    await pair.connect(owner3).approve(gauge.address, pair_1000);
    await gauge.connect(owner3).deposit(pair_1000, 0);
  });

  it("gauge claim rewards owner3", async function () {
    await gauge.connect(owner3).withdraw(await gauge.balanceOf(owner3.address));
    const pair_1000 = ethers.BigNumber.from("1000000000");
    await pair.connect(owner3).approve(gauge.address, pair_1000);
    await gauge.connect(owner3).deposit(pair_1000, 0);
    const before = await ve_underlying.balanceOf(owner3.address)
    await gauge.batchUserRewards(ve_underlying.address, owner3.address, 200);
    await gauge.batchUserRewards(ve_underlying.address, owner3.address, 200);
    await gauge.connect(owner3).withdraw(await gauge.balanceOf(owner3.address));
    await gauge.batchUserRewards(ve_underlying.address, owner3.address, 200);
    await gauge.batchRewardPerToken(ve_underlying.address, 200);
    await pair.connect(owner3).approve(gauge.address, pair_1000);
    await gauge.connect(owner3).deposit(pair_1000, 0);
    await gauge.batchRewardPerToken(ve_underlying.address, 200);
    await gauge.batchRewardPerToken(ve_underlying.address, 200);
    await gauge.batchRewardPerToken(ve_underlying.address, 200);
    await gauge.batchRewardPerToken(ve_underlying.address, 200);
    const earned = await gauge.earned(ve_underlying.address, owner3.address);
    await gauge.connect(owner3).getReward(owner3.address, [ve_underlying.address]);
    await gauge.connect(owner3).withdraw(await gauge.balanceOf(owner3.address));
    await pair.connect(owner3).approve(gauge.address, pair_1000);
    await gauge.connect(owner3).deposit(pair_1000, 0);
    await gauge.connect(owner3).getReward(owner3.address, [ve_underlying.address]);
    await gauge.connect(owner3).withdraw(await gauge.balanceOf(owner3.address));
    await pair.connect(owner3).approve(gauge.address, pair_1000);
    await gauge.connect(owner3).deposit(pair_1000, 0);
    await gauge.connect(owner3).getReward(owner3.address, [ve_underlying.address]);
    await gauge.connect(owner3).getReward(owner3.address, [ve_underlying.address]);
    await gauge.connect(owner3).getReward(owner3.address, [ve_underlying.address]);
    await gauge.connect(owner3).getReward(owner3.address, [ve_underlying.address]);
    const after = await ve_underlying.balanceOf(owner3.address)
    const received = after.sub(before);
    expect(received).to.be.equal(0)

    await gauge.connect(owner3).withdraw(await gauge.balanceOf(owner.address));
    await pair.connect(owner3).approve(gauge.address, pair_1000);
    await gauge.connect(owner3).deposit(pair_1000, 1);
    await gauge.connect(owner3).getReward(owner3.address, [ve_underlying.address]);
  });

  it("minter mint", async function () {
    await network.provider.send("evm_increaseTime", [86400 * 7 * 2])
    await network.provider.send("evm_mine")
    await minter.update_period();
    await gauge_factory.updateGauge(gauge.address);
    const claimable = await gauge_factory.claimable(gauge.address);
    await ve_underlying.approve(staking.address, claimable);
    await staking.notifyRewardAmount(claimable);
    await gauge_factory.distro();
    expect(await gauge.rewardRate(ve_underlying.address)).to.be.equal(await staking.rewardRate());
    console.log(await gauge.rewardPerTokenStored(ve_underlying.address))
  });

  it("gauge claim rewards owner3 next cycle", async function () {
    await gauge.connect(owner3).withdraw(await gauge.balanceOf(owner3.address));
    const pair_1000 = ethers.BigNumber.from("1000000000");
    console.log(await gauge.rewardPerTokenStored(ve_underlying.address))
    await pair.connect(owner3).approve(gauge.address, pair_1000);
    await gauge.connect(owner3).deposit(pair_1000, 0);
    const before = await ve_underlying.balanceOf(owner3.address)
    const earned = await gauge.earned(ve_underlying.address, owner3.address);
    await gauge.connect(owner3).getReward(owner3.address, [ve_underlying.address]);
    const after = await ve_underlying.balanceOf(owner3.address)
    const received = after.sub(before);
    expect(received).to.be.above(0)
    console.log(await gauge.rewardPerTokenStored(ve_underlying.address))

    await gauge.connect(owner3).withdraw(await gauge.balanceOf(owner.address));
    await pair.connect(owner3).approve(gauge.address, pair_1000);
    await gauge.connect(owner3).deposit(pair_1000, 1);
    await gauge.connect(owner3).getReward(owner3.address, [ve_underlying.address]);
  });

});
