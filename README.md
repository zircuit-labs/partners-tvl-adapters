# TVL by User - Zircuit Adapters

This repository aims to serve as a source for all adapters we use to fetch TVL by users for protocols on the Zircuit Chain. The goal is to simplify the process of adding new protocols, making data ingestion straightforward and thereby making the data available for the Zircuit Ecosystem team.

## How to add new adapters?

The process to add a new adapters is provide a script similar to what you can see here in the [adapter example](https://github.com/zircuit-labs/partners-tvl-adapters/tree/main/adapters/tvl-snapshot-elara/).

Here is a onboarding checklist:

1.  Set up a subquery indexer (e.g. Goldsky Subgraph)
    1. Follow the docs here: https://docs.goldsky.com/guides/create-a-no-code-subgraph
    2. General Steps
        1. Create an account at app.goldsky.com
        2. Deploy a subgraph or migrate an existing subgraph - https://docs.goldsky.com/subgraphs/introduction
        3. Use the slugs `zircuit-testnet` and `zircuit` when deploying the config
2.  Prepare Subquery query code according to the Data Requirement section below.
3.  Submit your response as a Pull Request to: https://github.com/zircuit-labs/partners-tvl-adapters.git
    1. Copy the `example` adapter and create a new one inside the `adapters` folder following this pattern: `tvl-snapshot-<protocol_name>`
        - This code is just an example, you can use it as a reference to create your own adapter. Protocols are required to implement efficient adapters.
    2. Check the `adapters/tvl-snapshot-elara/src/index.ts` file for the correct format of the output file, conforming to the interfaces defined in the file.
    3. `index.ts` is the entry point for the adapter, it is responsible for fetching the data and converting it to the correct format. We should be able to run:
        ```
        cd adapters/tvl-snapshot-<protocol_name>
        npm install
        npm run compile
        npm run start
        ```
        and get the correct output file in the `out` folder.

### Data Requirements:
Goal: **Hourly snapshot of TVL by User by Asset**

Please read the instructions carefully, and contact us if you have any questions.

For each protocol, we are looking for the following:
1. Query that fetches all relevant events required to calculate User TVL in the Protocol at least at hourly level.
    - **Protocols are responsible for providing the correct data. Incorrect data can lead to users not being able to claim rewards.**
    - **Protocols are responsible of filtering non-user addresses, like smart contracts, pools, etc. Otherwise, the total points will be affected, blocking rewards.** (e.g. zero address, pool address, etc.)
2. Code that uses the above query, fetches all the data and converts it to csv file in below given format.
3. Balances should be formatted in wei. Do not convert it or truncate it.
4. Output file should be named `tvl-snapshot-<protocol_name>.csv`
5. Output file should be generated in the `out` folder in your adapter folder.


### Output Data Schema

| Data Field                | Notes                                                                                  |
|---------------------------|----------------------------------------------------------------------------------------|
| user                      | User address                                                                           |
| token_address             | Token address (underlying token, not pool token)                                       |
| block                     | Block number                                                                           |
| token_balance             | Token balance at the block                                                             |
| timestamp                 | Block timestamp                                                                        |

The output file should be a CSV file with the following format:

```
user,token_address,block,token_balance,timestamp
0xff...,0xeb4b0563aac65980245660496e76d03c90ad7b26,3330408,0,1736118043
0xff...,0x04627b24ede101b0a92211a92f996eda3fa6cc75,3332208,10000000000,1736118043
0xff...,0x50273860341bb80de359cd391bef9b2eb228753c,3332208,1920000000000000,1736118043
0xff...,0xeb4b0563aac65980245660496e76d03c90ad7b26,3332208,2545367800433000,1736118043
```