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

describe("minter", function () {

  let token;
  let ve_underlying;
  let ve;
  let owner;
  let minter;
  let ve_dist;

  it("deploy base", async function () {
    [owner] = await ethers.getSigners(1);
    token = await ethers.getContractFactory("Token");
    mim = await token.deploy('MIM', 'MIM', 18, owner.address);
    await mim.mint(owner.address, ethers.BigNumber.from("1000000000000000000000000000000"));
    ve_underlying = await token.deploy('VE', 'VE', 18, owner.address);
    vecontract = await ethers.getContractFactory("contracts/ve.sol:ve");
    ve = await vecontract.deploy(ve_underlying.address);
    await ve_underlying.mint(owner.address, ethers.BigNumber.from("10000000000000000000000000"));
    const BaseV1Factory = await ethers.getContractFactory("BaseV1Factory");
    factory = await BaseV1Factory.deploy();
    await factory.deployed();
    const BaseV1Router = await ethers.getContractFactory("BaseV1Router01");
    router = await BaseV1Router.deploy(factory.address, owner.address);
    await router.deployed();
    const BaseV1GaugeFactory = await ethers.getContractFactory("BaseV1GaugeFactory");
    gauges_factory = await BaseV1GaugeFactory.deploy();
    const BaseV1Voter = await ethers.getContractFactory("BaseV1Voter");
    const gauge_factory = await BaseV1Voter.deploy(ve.address, factory.address, gauges_factory.address);
    await gauge_factory.deployed();
    await ve_underlying.approve(ve.address, ethers.BigNumber.from("1000000000000000000"));
    await ve.create_lock(ethers.BigNumber.from("1000000000000000000"), 4 * 365 * 86400);
    const VeDist = await ethers.getContractFactory("contracts/ve_dist.sol:ve_dist");
    ve_dist = await VeDist.deploy(ve.address, ve_underlying.address, owner.address);
    await ve_dist.deployed();
    await ve.setVoter(gauge_factory.address);

    const BaseV1Minter = await ethers.getContractFactory("BaseV1Minter");
    minter = await BaseV1Minter.deploy(gauge_factory.address, ve.address, ve_dist.address);
    await minter.deployed();
    await ve_dist.setDepositor(minter.address);

    const mim_1 = ethers.BigNumber.from("1000000000000000000");
    const ve_underlying_1 = ethers.BigNumber.from("1000000000000000000");
    await ve_underlying.approve(router.address, ve_underlying_1);
    await mim.approve(router.address, mim_1);
    await router.addLiquidity(mim.address, ve_underlying.address, false, mim_1, ve_underlying_1, 0, 0, owner.address, Date.now());

    const pair = await router.pairFor(mim.address, ve_underlying.address, false);


    await gauge_factory.createGauge(pair);
    expect(await ve.balanceOfNFT(1)).to.above(ethers.BigNumber.from("995063075414519385"));
    expect(await ve_underlying.balanceOf(ve.address)).to.be.equal(ethers.BigNumber.from("1000000000000000000"));

    await gauge_factory.vote(1, [pair], [5000]);
  });

  it("initialize veNFT", async function () {
    await minter.initialize([owner.address],[ethers.BigNumber.from("1000000000000000000000000")], ethers.BigNumber.from("20000000000000000000000000"))
    expect(await ve.ownerOf(2)).to.equal(owner.address);
    expect(await ve.ownerOf(3)).to.equal("0x0000000000000000000000000000000000000000");
    await network.provider.send("evm_mine")
    expect(await ve_underlying.balanceOf(minter.address)).to.equal(ethers.BigNumber.from("19000000000000000000000000"));
  });

  it("minter weekly distribute", async function () {
    await minter.update_period();
    expect(await minter.weekly()).to.equal(ethers.BigNumber.from("20000000000000000000000000"));
    await network.provider.send("evm_increaseTime", [86400 * 7])
    await network.provider.send("evm_mine")
    await minter.update_period();
    expect(await ve_dist.claimable(1)).to.equal(0);
    expect(await minter.weekly()).to.equal(ethers.BigNumber.from("20000000000000000000000000"));
    await network.provider.send("evm_increaseTime", [86400 * 7])
    await network.provider.send("evm_mine")
    await minter.update_period();
    const claimable = await ve_dist.claimable(1);
    expect(claimable).to.be.above(ethers.BigNumber.from("230039145118808654"));
    const before = await ve.balanceOfNFT(1);
    await ve_dist.claim(1);
    const after = await ve.balanceOfNFT(1);
    expect(await ve_dist.claimable(1)).to.equal(0);

    const weekly = await minter.weekly();
    console.log(weekly);
    console.log(await minter.calculate_growth(weekly));
    console.log(await ve_underlying.totalSupply());
    console.log(await ve.totalSupply());

    await network.provider.send("evm_increaseTime", [86400 * 7])
    await network.provider.send("evm_mine")
    await minter.update_period();
    console.log(await ve_dist.claimable(1));
    await network.provider.send("evm_increaseTime", [86400 * 7])
    await network.provider.send("evm_mine")
    await minter.update_period();
    console.log(await ve_dist.claimable(1));
    await network.provider.send("evm_increaseTime", [86400 * 7])
    await network.provider.send("evm_mine")
    await minter.update_period();
    console.log(await ve_dist.claimable(1));
    await network.provider.send("evm_increaseTime", [86400 * 7])
    await network.provider.send("evm_mine")
    await minter.update_period();
    console.log(await ve_dist.claimable(1));
    await network.provider.send("evm_increaseTime", [86400 * 7])
    await network.provider.send("evm_mine")
    await minter.update_period();
    console.log(await ve_dist.claimable(1));
  });

});
