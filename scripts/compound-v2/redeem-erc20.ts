import { ethers } from "hardhat";
import * as CTokenAbi from "./abis/CToken.json";
import * as ERC20Abi from "../common/ERC20.json";

// This script has been resued from https://github.com/compound-developers github with some modifications for supply ERC20.
async function main() {
  const signer = (await ethers.getSigners())[0];

  // Mainnet Contract for cDAI (https://compound.finance/docs#networks)
  const cTokenContractAddress = "0x5d3a536e4d6dbd6114cc1ead35777bab948e3643";

  const cTokenContract = new ethers.Contract(
    cTokenContractAddress,
    CTokenAbi.abi,
    signer
  );

  // Mainnet Contract for the underlying token https://etherscan.io/address/0x6b175474e89094c44da98b954eedeac495271d0f
  const underlyingContractAddress =
    "0x6B175474E89094C44Da98b954EedeAC495271d0F";

  const underlyingContract = new ethers.Contract(
    underlyingContractAddress,
    ERC20Abi.abi,
    signer
  );

  const assetName = "DAI"; // for the log output lines
  const underlyingDecimals = 18; // Number of decimals defined in this ERC20 token's contract

  // See how many underlying ERC-20 tokens are in my wallet before we supply
  const tokenBalance =
    (await underlyingContract.balanceOf(await signer.getAddress())) /
    BigInt(1e18);
  console.log(`My wallet's ${assetName} Token Balance:`, tokenBalance);

  // 10 tokens
  const underlyingTokensToSupply = 10 * Math.pow(10, underlyingDecimals);

  const bal = await cTokenContract.balanceOfUnderlying(
    await signer.getAddress()
  );
  const balanceOfUnderlying = bal / BigInt(Math.pow(10, underlyingDecimals));

  let cTokenBalance =
    (await cTokenContract.balanceOf(await signer.getAddress())) / BigInt(1e8);
  console.log(
    `My wallet's c${assetName} Token Balance:`,
    cTokenBalance.toString()
  );

  if (cTokenBalance == BigInt(0)) {
    console.log(`No c${assetName} to redeem.`);
    return;
  }

  let erCurrent = await cTokenContract.exchangeRateCurrent();
  let exchangeRate = +erCurrent / Math.pow(10, 18 + underlyingDecimals - 8);
  console.log(
    `Current exchange rate from c${assetName} to ${assetName}:`,
    exchangeRate,
    "\n"
  );

  console.log(`Redeeming the c${assetName} for ${assetName}...`);

  // redeem (based on cTokens)
  console.log(`Exchanging all c${assetName} based on cToken amount...`, "\n");
  const tx = await cTokenContract.redeem(cTokenBalance * BigInt(1e8));

  // redeem (based on underlying)
  console.log(
    `Exchanging all c${assetName} based on underlying ${assetName} amount...`
  );
  let underlyingAmount =
    balanceOfUnderlying * BigInt(Math.pow(10, underlyingDecimals));

  await cTokenContract.redeemUnderlying(underlyingAmount);

  cTokenBalance = await cTokenContract.balanceOf(await signer.getAddress());
  cTokenBalance = cTokenBalance / BigInt(1e8);
  console.log(`My wallet's c${assetName} Token Balance:`, cTokenBalance);

  let underlyingBalance = await underlyingContract.balanceOf(
    await signer.getAddress()
  );

  underlyingBalance =
    underlyingBalance / BigInt(Math.pow(10, underlyingDecimals));

  console.log(
    `My wallet's ${assetName} Token Balance:`,
    underlyingBalance,
    "\n"
  );
}

main().catch((err) => {
  console.error(err);
});
