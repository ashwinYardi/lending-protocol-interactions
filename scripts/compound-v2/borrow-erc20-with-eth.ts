import { ethers } from "hardhat";
import * as CTokenAbi from "./abis/CToken.json";
import * as ERC20Abi from "../common/ERC20.json";
import * as CEthAbi from "./abis/CETH.json";
import * as ComptrollerAbi from "./abis/Comptroller.json";
import * as priceFeedAbi from "./abis/PriceFeed.json";
// This script has been resued from https://github.com/compound-developers github with some modifications.
async function main() {
  // Your Ethereum wallet private key
  const signer = (await ethers.getSigners())[0];

  const provider = ethers.provider;

  // Mainnet Contract for cETH (the collateral-supply process is different for cERC20 tokens)
  const cEthAddress = "0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5";
  const cEth = new ethers.Contract(cEthAddress, CEthAbi.abi, signer);

  // Mainnet Contract for the Compound Protocol's Comptroller
  const comptrollerAddress = "0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b";
  const comptroller = new ethers.Contract(
    comptrollerAddress,
    ComptrollerAbi.abi,
    signer
  );

  // Mainnet Contract for the Open Price Feed
  const priceFeedAddress = "0x6d2299c48a8dd07a872fdd0f8233924872ad1071";
  const priceFeed = new ethers.Contract(
    priceFeedAddress,
    priceFeedAbi.abi,
    signer
  );

  // Mainnet address of underlying token (like DAI or USDC)
  const underlyingAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F"; // Dai
  const underlying = new ethers.Contract(
    underlyingAddress,
    ERC20Abi.abi,
    signer
  );

  // Mainnet address for a cToken (like cDai, https://compound.finance/docs#networks)
  const cTokenAddress = "0x5d3a536e4d6dbd6114cc1ead35777bab948e3643"; // cDai
  const cToken = new ethers.Contract(cTokenAddress, CTokenAbi.abi, signer);
  const assetName = "DAI"; // for the log output lines
  const underlyingDecimals = 18; // Number of decimals defined in this ERC20 token's contract

  const e18 = BigInt(10 ** 18);
  const e8 = BigInt(10 ** 8);
  const e6 = BigInt(10 ** 6);

  const logBalances = () => {
    return new Promise<void>(async (resolve, reject) => {
      let myWalletEthBalance =
        (await provider.getBalance(await signer.getAddress())) / e18;
      let myWalletCEthBalance =
        (await cEth.balanceOf(await signer.getAddress())) / e8;
      let myWalletUnderlyingBalance =
        (await underlying.balanceOf(await signer.getAddress())) /
        BigInt(BigInt(Math.pow(10, underlyingDecimals)));

      console.log("My Wallet's  ETH Balance:", myWalletEthBalance);
      console.log("My Wallet's cETH Balance:", myWalletCEthBalance);
      console.log(
        `My Wallet's  ${assetName} Balance:`,
        myWalletUnderlyingBalance
      );

      resolve();
    });
  };

  await logBalances();

  const ethToSupplyAsCollateral = BigInt(1);

  console.log(
    "\nSupplying ETH to the protocol as collateral (you will get cETH in return)...\n"
  );
  let mint = await cEth.mint({
    value: (ethToSupplyAsCollateral * e18).toString(),
  });

  await logBalances();

  console.log(
    "\nEntering market (via Comptroller contract) for ETH (as collateral)..."
  );
  let markets = [cEthAddress]; // This is the cToken contract(s) for your collateral
  let enterMarkets = await comptroller.enterMarkets(markets);

  console.log("Calculating your liquid assets in the protocol...");
  let { 1: liquidity } = await comptroller.getAccountLiquidity(
    await signer.getAddress()
  );
  liquidity = liquidity / e18;

  console.log("Fetching cETH collateral factor...");
  let { 1: collateralFactor } = await comptroller.markets(cEthAddress);
  collateralFactor = (collateralFactor / e18) * BigInt(100); // Convert to percent

  console.log(`Fetching ${assetName} price from the price feed...`);
  let underlyingPriceInUsd = await priceFeed.price(assetName);
  underlyingPriceInUsd = underlyingPriceInUsd / e6; // Price feed provides price in USD with 6 decimal places

  console.log(`Fetching borrow rate per block for ${assetName} borrowing...`);
  let borrowRate = await cToken.borrowRatePerBlock();
  borrowRate = borrowRate / BigInt(Math.pow(10, underlyingDecimals));

  console.log(
    `\nYou have ${liquidity} of LIQUID assets (worth of USD) pooled in the protocol.`
  );
  console.log(
    `You can borrow up to ${collateralFactor}% of your TOTAL collateral supplied to the protocol as ${assetName}.`
  );
  console.log(`1 ${assetName} == ${BigInt(underlyingPriceInUsd).toString()} USD`);
  console.log(
    `You can borrow up to ${
      liquidity / underlyingPriceInUsd
    } ${assetName} from the protocol.`
  );
  console.log(
    `NEVER borrow near the maximum amount because your account will be instantly liquidated.`
  );
  console.log(
    `\nYour borrowed amount INCREASES (${borrowRate} * borrowed amount) ${assetName} per block.\nThis is based on the current borrow rate.\n`
  );

  const underlyingToBorrow = BigInt(50);
  console.log(`Now attempting to borrow ${underlyingToBorrow} ${assetName}...`);
  const scaledUpBorrowAmount = (
    underlyingToBorrow * BigInt(Math.pow(10, underlyingDecimals))
  ).toString();
  const trx = await cToken.borrow(scaledUpBorrowAmount);

  // console.log('Borrow Transaction', trx);

  await logBalances();

  console.log(
    `\nFetching ${assetName} borrow balance from c${assetName} contract...`
  );
  let balance = await cToken.borrowBalanceCurrent.staticCall(await signer.getAddress());
  balance = BigInt(balance.toString()) / BigInt(Math.pow(10, underlyingDecimals));
  console.log(`Borrow balance is ${balance} ${assetName}`);

  console.log(
    `\nThis part is when you do something with those borrowed assets!\n`
  );

  await logBalances();
}

main().catch((err) => {
  console.error(err);
});
