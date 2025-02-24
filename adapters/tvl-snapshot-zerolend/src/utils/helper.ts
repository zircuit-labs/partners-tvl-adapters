import { ZIRCUIT_RPC } from "../sdk/config";

const { ethers } = require("ethers");

const provider = new ethers.JsonRpcProvider(ZIRCUIT_RPC);

export const getBlockByTimestamp = async (targetTimestamp: any) => {
    const t1 = Date.now()

    let latestBlock = await provider.getBlock("latest");
    let earliestBlock = await provider.getBlock(1);

    let latestBlockNumber = latestBlock.number;
    let earliestBlockNumber = earliestBlock.number;

    while (earliestBlockNumber < latestBlockNumber) {
        let midBlockNumber = Math.floor((earliestBlockNumber + latestBlockNumber) / 2);
        let midBlock = await provider.getBlock(midBlockNumber);
        if (!midBlock) {
            console.error("Block not found!");
            return null;
        }

        if (midBlock.timestamp < targetTimestamp) {
            earliestBlockNumber = midBlockNumber + 1;
        } else {
            latestBlockNumber = midBlockNumber;
        }
    }
    // console.log("block", earliestBlockNumber );
    console.log(`block for ${targetTimestamp} is -> ${earliestBlockNumber}time taken ", ${Date.now() - t1} `);

    return earliestBlockNumber;
}



